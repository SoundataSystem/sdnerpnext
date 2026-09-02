import "server-only";
import { Prisma } from "@/generated/prisma/client";

/**
 * Tipo de operación que requiere idempotencia
 */
export type TipoOperacionIdempotente =
  | "cobro.registrado"
  | "pago.proveedor"
  | "stock.ingreso"
  | "aprobacion.oc"
  | "oc.enviada"
  | "oc.cancelada"
  | "oc.cerrada"
  | "aprobacion.cotizacion"
  | "aprobacion.devolucion"
  | "importacion.productos"
  | "importacion.clientes"
  | "importacion.proveedores"
  | "venta.creada"
  | "venta.completada"
  | "venta.cancelada"
  | "venta.cobrada"
  | "venta.facturada"
  | "venta.anulada"
  | "compra.creada"
  | "devolucion.creada"
  | "ajuste.creado"
  | "ajuste.aprobado"
  | "devolucion_venta.aprobada"
  | "devolucion_compra.aprobada"
  | "transferencia.creada"
  | "operacion_critica.ejecutada";

/**
 * Resultado de verificación/creación de clave de idempotencia
 */
export interface ResultadoIdempotencia {
  /** Si la operación ya fue procesada */
  yaProcesada: boolean;
  /** ID de la operación existente (si ya procesada) */
  operacionExistenteId?: string;
  /** Clave de idempotencia generada/usada */
  clave: string;
}

/**
 * Genera una clave de idempotencia determinística basada en parámetros de la operación.
 * Útil cuando el cliente no provee su propia clave.
 */
export function generarClaveIdempotencia(
  tipo: TipoOperacionIdempotente,
  parametros: Record<string, unknown>,
): string {
  const parametrosOrdenados = Object.entries(parametros)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join("&");
  return `${tipo}:${parametrosOrdenados}`;
}

/**
 * Error señalizado cuando la clave de idempotencia ya fue registrada por otra
 * ejecución. Se lanza DENTRO de la transacción para forzar su rollback
 * (PostgreSQL aborta la transacción tras una violación UNIQUE: no se puede
 * continuar con otras queries en la misma tx) y se captura FUERA para devolver
 * el resultado idempotente.
 */
export class OperacionDuplicadaError extends Error {
  constructor(
    public readonly clave: string,
    public readonly entidadIdExistente: string,
  ) {
    super(`Operación duplicada (clave de idempotencia ya registrada): ${clave}`);
    this.name = "OperacionDuplicadaError";
  }
}

/**
 * Verifica y registra una clave de idempotencia de forma ATÓMICA.
 *
 * Estrategia: intenta INSERT directo; si la clave ya existe (violación UNIQUE,
 * error P2002), significa que otro request ya registró/procesó la operación.
 * No hay ventana de race condition: el INSERT es el punto de sincronización
 * (equivalente a INSERT ... ON CONFLICT DO NOTHING RETURNING).
 *
 * Como las claves son determinísticas (incluyen entidad + acción + id), en un
 * conflicto la entidad existente es la misma que la del request actual.
 *
 * En conflicto lanza {@link OperacionDuplicadaError} para abortar la
 * transacción actual. Debe llamarse DENTRO de una transacción Prisma y el
 * llamador debe capturar ese error FUERA de ella.
 */
export async function verificarYRegistrarIdempotencia(
  tx: Prisma.TransactionClient,
  clave: string,
  tipo: TipoOperacionIdempotente,
  entidadId: string,
  entidadTipo: string,
): Promise<ResultadoIdempotencia> {
  try {
    await tx.idempotenciaClave.create({
      data: {
        clave,
        tipo,
        entidadId,
        entidadTipo,
      },
    });
    // INSERT exitoso: primera vez que se procesa esta operación
    return { yaProcesada: false, clave };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Conflicto UNIQUE: abortar la tx (Postgres la deja en estado aborted)
      // y señalizar duplicado al llamador.
      throw new OperacionDuplicadaError(clave, entidadId);
    }
    throw error;
  }
}

/**
 * Verifica si una clave de idempotencia ya existe (sin registrarla).
 * Útil para consultas de solo lectura.
 */
export async function existeClaveIdempotencia(
  tx: Prisma.TransactionClient,
  clave: string,
): Promise<{ existe: boolean; entidadId?: string; entidadTipo?: string }> {
  const existente = await tx.idempotenciaClave.findUnique({
    where: { clave },
    select: { entidadId: true, entidadTipo: true },
  });
  return {
    existe: !!existente,
    entidadId: existente?.entidadId,
    entidadTipo: existente?.entidadTipo,
  };
}

/**
 * Limpia claves de idempotencia antiguas (retención configurable).
 * Debe ejecutarse periódicamente como job de mantenimiento.
 */
export async function limpiarClavesIdempotenciaAntiguas(
  tx: Prisma.TransactionClient,
  diasAntiguedad = 90,
): Promise<number> {
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - diasAntiguedad);

  const resultado = await tx.idempotenciaClave.deleteMany({
    where: {
      createdAt: { lt: fechaLimite },
    },
  });
  return resultado.count;
}

/**
 * Obtiene estadísticas de claves de idempotencia para monitoreo.
 */
export async function obtenerEstadisticasIdempotencia(
  tx: Prisma.TransactionClient,
): Promise<{
  total: number;
  porTipo: Record<string, number>;
  masAntigua: Date | null;
  masReciente: Date | null;
}> {
  // Secuencial sobre el mismo cliente de transacción (pg deprecó query()
  // concurrente en un cliente ocupado).
  const total = await tx.idempotenciaClave.count();
  const porTipo = await tx.idempotenciaClave.groupBy({
    by: ["tipo"],
    _count: { tipo: true },
  });
  const masAntigua = await tx.idempotenciaClave.findFirst({
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  const masReciente = await tx.idempotenciaClave.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return {
    total,
    porTipo: Object.fromEntries(porTipo.map((p) => [p.tipo, p._count.tipo])),
    masAntigua: masAntigua?.createdAt ?? null,
    masReciente: masReciente?.createdAt ?? null,
  };
}

/**
 * Tipos de entidad para idempotencia (para trazabilidad)
 */
export const ENTIDADES_IDEMPOTENCIA = [
  "orden_venta",
  "orden_compra",
  "caja_movimiento",
  "pago_proveedor",
  "stock_movimiento",
  "orden_compra",
  "cotizacion",
  "devolucion_venta",
  "devolucion_compra",
  "ajuste_stock",
  "transferencia_stock",
  "producto",
  "cliente",
  "proveedor",
] as const;

/**
 * Genera una clave de idempotencia amigable para humanos (para debugging).
 */
export function generarClaveLegible(
  tipo: TipoOperacionIdempotente,
  identificador: string,
): string {
  return `idem_${tipo}_${identificador}_${Date.now().toString(36)}`;
}