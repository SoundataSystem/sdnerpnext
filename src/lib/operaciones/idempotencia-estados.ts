import "server-only";
import { prisma } from "@/lib/prisma";
import {
  validarTransicionOrdenVenta,
  validarTransicionCaja,
  validarTransicionOC,
  validarTransicionDevolucion,
  EstadoOrdenVenta,
  EstadoCaja,
  EstadoOC,
  EstadoDevolucion,
} from "@/lib/estados/maquina-estados";
import {
  verificarYRegistrarIdempotencia,
  generarClaveIdempotencia,
  OperacionDuplicadaError,
  TipoOperacionIdempotente,
  ResultadoIdempotencia,
} from "@/lib/idempotencia/claves";
import { generarCorrelationId } from "@/lib/eventos/outbox";
import { Prisma } from "@/generated/prisma/client";

export type EstadoOrden = "pendiente" | "completada" | "cancelada";

/**
 * Contexto de ejecución para operaciones con idempotencia y validación de estado.
 */
export interface ContextoOperacion {
  /** ID de correlación para tracing */
  correlationId?: string;
  /** Usuario que ejecuta la operación (opcional: operaciones de sistema) */
  actorId?: string;
  actorNombre: string;
  actorRol: string;
  /** Si se debe crear evento en outbox */
  crearEventoOutbox?: boolean;
  /** Metadata adicional para outbox/auditoría */
  metadata?: Record<string, unknown>;
}

/**
 * Resultado de una operación con validación de estado e idempotencia
 */
export interface ResultadoOperacion<T> {
  exito: boolean;
  dato?: T;
  error?: string;
  /** Si la operación ya fue procesada (idempotencia) */
  yaProcesada?: boolean;
  /** ID de la entidad creada/actualizada */
  entidadId?: string;
}

/**
 * Tipos de entidad para operaciones críticas
 */
export type EntidadCritica =
  | "orden_venta"
  | "caja_movimiento"
  | "orden_compra"
  | "devolucion_venta"
  | "devolucion_compra"
  | "stock_movimiento"
  | "ajuste_stock";

/**
 * Valida transición de estado según el tipo de entidad
 */
export function validarTransicionEntidad(
  entidad: EntidadCritica,
  estadoActual: string,
  estadoNuevoOAccion: string,
  contexto?: Record<string, unknown>,
): { valido: boolean; error?: string; estadoNuevo?: string } {
  switch (entidad) {
    case "orden_venta": {
      const resultado = validarTransicionOrdenVenta(
        estadoActual as "pendiente" | "completada" | "cancelada",
        estadoNuevoOAccion as "pendiente" | "completada" | "cancelada",
        contexto,
      );
      return { valido: resultado.valido, error: resultado.error, estadoNuevo: resultado.valido ? estadoNuevoOAccion : undefined };
    }
    case "caja_movimiento": {
      const resultado = validarTransicionCaja(
        estadoActual as "pendiente" | "cobrado" | "parcial" | "facturado" | "anulado",
        estadoNuevoOAccion as "pendiente" | "cobrado" | "parcial" | "facturado" | "anulado",
        contexto,
      );
      return { valido: resultado.valido, error: resultado.error, estadoNuevo: estadoNuevoOAccion };
    }
    case "orden_compra": {
      const resultado = validarTransicionOC(
        estadoActual as "borrador" | "pendiente" | "aprobada" | "enviada" | "recepcion_parcial" | "recepcion_completa" | "pendiente_ingreso_stock" | "ingresada" | "cerrada" | "cancelada",
        estadoNuevoOAccion as "aprobar" | "enviar" | "cancelar" | "cerrar",
      );
      return { valido: resultado.valido, error: resultado.error, estadoNuevo: resultado.estadoNuevo };
    }
    case "devolucion_venta":
    case "devolucion_compra": {
      const resultado = validarTransicionDevolucion(
        estadoActual as "pendiente" | "aprobada" | "rechazada",
        estadoNuevoOAccion as "pendiente" | "aprobada" | "rechazada",
      );
      return { valido: resultado.valido, error: resultado.error, estadoNuevo: estadoNuevoOAccion };
    }
    default:
      return { valido: false, error: `Entidad no soportada: ${entidad}` };
  }
}

/**
 * Obtiene y bloquea el estado actual de una entidad dentro de una transacción.
 * Retorna el estado actual y lanza error si la entidad no existe.
 * Usa SELECT ... FOR UPDATE para bloquear la fila.
 */
async function obtenerYBloquearEstado(
  tx: Prisma.TransactionClient,
  entidad: EntidadCritica,
  entidadId: string,
): Promise<string> {
  switch (entidad) {
    case "orden_venta": {
      const orden = await tx.$queryRaw<{ estado: string }[]>`
        SELECT estado FROM ordenes WHERE id = ${entidadId}::uuid FOR UPDATE
      `;
      if (!orden.length) throw new Error(`Orden de venta ${entidadId} no encontrada`);
      return orden[0].estado;
    }
    case "caja_movimiento": {
      const mov = await tx.$queryRaw<{ estado: string | null }[]>`
        SELECT estado FROM caja_movimientos WHERE id = ${entidadId}::uuid FOR UPDATE
      `;
      if (!mov.length) throw new Error(`Movimiento de caja ${entidadId} no encontrado`);
      return mov[0].estado ?? "pendiente";
    }
    case "orden_compra": {
      const oc = await tx.$queryRaw<{ estado: string }[]>`
        SELECT estado FROM ordenes_compra WHERE id = ${entidadId}::uuid FOR UPDATE
      `;
      if (!oc.length) throw new Error(`Orden de compra ${entidadId} no encontrada`);
      return oc[0].estado;
    }
    case "devolucion_venta": {
      const dev = await tx.$queryRaw<{ estado: string }[]>`
        SELECT estado FROM devoluciones_ventas WHERE id = ${entidadId}::uuid FOR UPDATE
      `;
      if (!dev.length) throw new Error(`Devolución de venta ${entidadId} no encontrada`);
      return dev[0].estado;
    }
    case "devolucion_compra": {
      const dev = await tx.$queryRaw<{ estado: string }[]>`
        SELECT estado FROM devoluciones_compra WHERE id = ${entidadId}::uuid FOR UPDATE
      `;
      if (!dev.length) throw new Error(`Devolución de compra ${entidadId} no encontrada`);
      return dev[0].estado;
    }
    case "stock_movimiento": {
      const mov = await tx.$queryRaw<{ tipo: string }[]>`
        SELECT tipo FROM movimientos_inventario WHERE id = ${entidadId}::uuid FOR UPDATE
      `;
      if (!mov.length) throw new Error(`Movimiento de inventario ${entidadId} no encontrado`);
      return mov[0].tipo;
    }
    case "ajuste_stock": {
      const ajuste = await tx.$queryRaw<{ estado: string }[]>`
        SELECT estado FROM ajustes_stock WHERE id = ${entidadId}::uuid FOR UPDATE
      `;
      if (!ajuste.length) throw new Error(`Ajuste de stock ${entidadId} no encontrado`);
      return ajuste[0].estado;
    }
    default:
      throw new Error(`Entidad no soportada para bloqueo de estado: ${entidad}`);
  }
}

/**
 * Determina si un error es un conflicto de serialización (Prisma P2034).
 * Ocurre bajo aislamiento Serializable cuando dos transacciones concurrentes
 * tienen dependencias de lectura/escritura incompatibles.
 */
export function esConflictoSerializacion(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

const MAX_INTENTOS_SERIALIZACION = 3;
const BACKOFF_BASE_MS = 50;

/**
 * Ejecuta una operación crítica con validación de estado, idempotencia y outbox.
 * Todo se ejecuta en una transacción atómica (Serializable) con reintento
 * automático ante conflictos de serialización (P2034): el reintento es seguro
 * porque la clave de idempotencia se inserta dentro de la misma tx (si el
 * intento anterior hizo commit, el reintento termina en no-op duplicado; si
 * abortó, la clave no existe y la operación corre limpio).
 */
export async function ejecutarOperacionCritica<T>(
  entidad: EntidadCritica,
  _tipoIdempotencia: TipoOperacionIdempotente,
  claveIdempotencia: string,
  entidadId: string,
  validarEstado: (estadoActual: string) => { valido: boolean; error?: string; estadoNuevo?: string },
  ejecutar: (tx: Prisma.TransactionClient) => Promise<{ entidadId: string; tipoEventoOutbox: string; datosAnteriores?: Record<string, unknown>; datosNuevos?: Record<string, unknown> }>,
  contexto: ContextoOperacion,
): Promise<ResultadoOperacion<{ entidadId: string }>> {
  let ultimoError: unknown;
  for (let intento = 1; intento <= MAX_INTENTOS_SERIALIZACION; intento++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Verificar idempotencia (INSERT atómico; en conflicto lanza
        //    OperacionDuplicadaError y aborta esta tx)
        await verificarYRegistrarIdempotencia(
          tx,
          claveIdempotencia,
          _tipoIdempotencia,
          entidadId,
          "operacion_critica",
        );

        // 2. Leer y bloquear el estado actual dentro de la transacción
        const estadoActual = await obtenerYBloquearEstado(tx, entidad, entidadId);

        // 3. Validar transición de estado
        const validacion = validarEstado(estadoActual);
        if (!validacion.valido) {
          throw new Error(validacion.error ?? "Transición de estado inválida");
        }

        // 4. Ejecutar la lógica de negocio
        const resultado = await ejecutar(tx);

        // 5. Registrar evento en outbox (usando tx, no prisma) - un solo evento
        const correlationId = contexto.correlationId ?? generarCorrelationId();
        await tx.eventoOutbox.create({
          data: {
            tipo: _tipoIdempotencia,
            correlation_id: correlationId,
            actor_id: contexto.actorId || null,
          actor_nombre: contexto.actorNombre,
          actor_rol: contexto.actorRol,
          entidad,
          entidad_id: resultado.entidadId,
          datos_anteriores: undefined,
          datos_nuevos: { entidadId: resultado.entidadId, tipo: "ejecutada" },
          metadata: { entidad, claveIdempotencia },
        },
      });

      return {
        exito: true,
        dato: { entidadId: resultado.entidadId },
        entidadId: resultado.entidadId,
      };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (error instanceof OperacionDuplicadaError) {
        // La operación ya fue procesada por otro request (ej: doble click).
        // Respuesta idempotente: éxito sin re-ejecutar efectos.
        return {
          exito: true,
          yaProcesada: true,
          entidadId: error.entidadIdExistente,
        };
      }
      if (
        esConflictoSerializacion(error) &&
        intento < MAX_INTENTOS_SERIALIZACION
      ) {
        // Conflicto Serializable: la tx abortó completa; reintentar con
        // backoff exponencial corto.
        ultimoError = error;
        await new Promise((resolve) =>
          setTimeout(resolve, BACKOFF_BASE_MS * 2 ** (intento - 1)),
        );
        continue;
      }
      throw error;
    }
  }
  throw ultimoError ?? new Error("Operación crítica agotó sus reintentos");
}

/**
 * Genera una clave de idempotencia para una operación crítica específica
 */
export function generarClaveOperacionCritica(
  entidad: EntidadCritica,
  accion: string,
  identificador: string,
): string {
  return `critica_${entidad}_${accion}_${identificador}`;
}

/**
 * Ejecuta una CREACIÓN crítica con idempotencia y outbox, en transacción
 * Serializable con reintento ante P2034.
 *
 * A diferencia de {@link ejecutarOperacionCritica}, NO valida ni bloquea el
 * estado previo de la entidad (la entidad todavía no existe: una creación no
 * puede usar obtenerYBloquearEstado). El punto de sincronización es el INSERT
 * atómico de la clave de idempotencia:
 * - Request A + B simultáneos con la misma clave → exactamente UNA creación;
 *   el perdedor recibe éxito-no-op ({yaProcesada:true}) con el ID real creado
 *   por el ganador (la fila de clave se actualiza al ID dentro de la tx).
 * - Retry tras timeout/commit → no-op idempotente, sin duplicar efectos.
 *
 * La clave debe ser proporcionada explícitamente por el cliente (UUID por
 * intención de submit) o generada determinísticamente por el llamador cuando
 * el dominio lo permita.
 */
export async function ejecutarCreacionCritica(
  _tipoIdempotencia: TipoOperacionIdempotente,
  claveIdempotencia: string,
  entidadTipo: string,
  entidadIdReferencia: string,
  ejecutar: (tx: Prisma.TransactionClient) => Promise<{
    entidadId: string;
    datosNuevos?: Record<string, unknown>;
  }>,
  contexto: ContextoOperacion,
): Promise<ResultadoOperacion<{ entidadId: string }> & { entidadId: string }> {
  const claveCompleta = `creacion_${_tipoIdempotencia}_${claveIdempotencia}`;
  let ultimoError: unknown;
  for (let intento = 1; intento <= MAX_INTENTOS_SERIALIZACION; intento++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Clave de idempotencia: INSERT atómico como punto de sincronización.
        //    En conflicto (P2002) PostgreSQL ABORTA la tx: no se puede consultar
        //    nada más dentro de ella (25P02), por eso se lanza la señal de
        //    duplicado sin tocar la BD y el ID real se resuelve FUERA.
        try {
          await tx.idempotenciaClave.create({
            data: {
              clave: claveCompleta,
              tipo: _tipoIdempotencia,
              entidadId: entidadIdReferencia,
              entidadTipo,
            },
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            throw new OperacionDuplicadaError(claveCompleta, "");
          }
          throw error;
        }

        // 2. Lógica de negocio de creación (dentro de la misma tx).
        const resultado = await ejecutar(tx);

        // 3. La clave pasa a referenciar el ID real de la entidad creada
        //    (trazabilidad: un retry posterior recupera ese ID).
        await tx.idempotenciaClave.update({
          where: { clave: claveCompleta },
          data: { entidadId: resultado.entidadId },
        });

        // 4. Evento outbox dentro de la MISMA transacción.
        const correlationId = contexto.correlationId ?? generarCorrelationId();
        await tx.eventoOutbox.create({
          data: {
            tipo: _tipoIdempotencia,
            correlation_id: correlationId,
            actor_id: contexto.actorId || null,
            actor_nombre: contexto.actorNombre,
            actor_rol: contexto.actorRol,
            entidad: entidadTipo,
            entidad_id: resultado.entidadId,
            datos_nuevos: (resultado.datosNuevos ?? {
              entidadId: resultado.entidadId,
            }) as Prisma.InputJsonValue,
            metadata: { claveIdempotencia: claveCompleta },
          },
        });

        return {
          exito: true,
          dato: { entidadId: resultado.entidadId },
          entidadId: resultado.entidadId,
        };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (error instanceof OperacionDuplicadaError) {
        // Duplicado: recuperar el ID REAL de la entidad que creó el request
        // ganador (fuera de la tx abortada; el ganador actualiza la fila con
        // su ID al commitear). Polling corto por si el perdedor llegó antes
        // del commit del ganador (doble click verdaderamente simultáneo).
        const entidadIdReal = await resolverEntidadDeClave(
          claveCompleta,
          entidadIdReferencia,
        );
        return {
          exito: true,
          yaProcesada: true,
          entidadId: entidadIdReal,
        };
      }
      if (
        esConflictoSerializacion(error) &&
        intento < MAX_INTENTOS_SERIALIZACION
      ) {
        ultimoError = error;
        await new Promise((resolve) =>
          setTimeout(resolve, BACKOFF_BASE_MS * 2 ** (intento - 1)),
        );
        continue;
      }
      throw error;
    }
  }
  throw ultimoError ?? new Error("Creación crítica agotó sus reintentos");
}

/**
 * Resuelve el ID real asociado a una clave de creación ya registrada.
 * Consulta FUERA de cualquier transacción (la tx del perdedor quedó abortada).
 */
async function resolverEntidadDeClave(
  claveCompleta: string,
  referencia: string,
): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const fila = await prisma.idempotenciaClave.findUnique({
      where: { clave: claveCompleta },
      select: { entidadId: true },
    });
    if (fila?.entidadId && fila.entidadId !== referencia) {
      return fila.entidadId;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return referencia;
}

/**
 * Tipos de operación idempotente para operaciones críticas
 */
export type TipoOperacionCritica =
  | "orden_venta.crear"
  | "orden_venta.completar"
  | "orden_venta.cancelar"
  | "caja_movimiento.cobrar"
  | "caja_movimiento.facturar"
  | "caja_movimiento.anular"
  | "orden_compra.aprobar"
  | "orden_compra.enviar"
  | "orden_compra.cerrar"
  | "devolucion.aprobar"
  | "devolucion.rechazar"
  | "stock.ajustar"
  | "stock.transferir";