import "server-only";
import { prisma } from "@/lib/prisma";
import { registrarEventoOutbox } from "@/lib/eventos/outbox";

export interface ActividadDTO {
  id: string;
  usuario_nombre: string;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  detalle: string | null;
  created_at: string;
}

export interface LogAuditoriaDTO {
  id: string;
  tabla_afectada: string;
  registro_id: string;
  accion: string;
  usuario_id: string | null;
  datos_anteriores: unknown;
  datos_nuevos: unknown;
  created_at: string;
}

/**
 * Parámetros extendidos para registrarActividad con soporte de outbox.
 */
export interface RegistrarActividadParams {
  usuario_id: string;
  usuario_nombre: string;
  accion: string;
  entidad: string;
  entidad_id?: string;
  detalle?: string;
  datos_previos?: unknown;
  datos_nuevos?: unknown;
  /** Si se proporciona, también crea evento en outbox para procesamiento asíncrono */
  crearEventoOutbox?: boolean;
  /** Tipo de evento para outbox (usa TIPOS_EVENTO para consistencia) */
  tipoEventoOutbox?: string;
  /** Correlation ID para tracing (se genera automático si no se provee) */
  correlationId?: string;
  /** Metadata adicional para el evento outbox */
  metadataOutbox?: Record<string, unknown>;
}

/**
 * Mapea acciones de auditoría a tipos de evento de dominio estándar.
 */
function mapearAccionATipoEvento(accion: string): string {
  const mapa: Record<string, string> = {
    creada: "creada",
    creado: "creada",
    actualizada: "actualizada",
    actualizado: "actualizado",
    eliminada: "eliminada",
    eliminad: "eliminada",
    aprobada: "aprobada",
    aprobado: "aprobado",
    rechazada: "rechazada",
    rechazado: "rechazado",
    anulada: "anulada",
    anulado: "anulado",
    cobrada: "cobrada",
    facturada: "facturada",
    recibida: "recibida",
    recibido: "recibido",
    enviada: "enviada",
    enviado: "enviado",
  };
  return mapa[accion.toLowerCase()] ?? "actualizada";
}

/**
 * Registra una actividad y, opcionalmente, un evento en el outbox para procesamiento asíncrono.
 * Si se pasa un cliente Prisma de transacción (tx), usa esa transacción; si no, crea una propia.
 */
export async function registrarActividad(
  params: RegistrarActividadParams,
  tx?: import("@/generated/prisma/client").Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma;
  const correlationId = params.correlationId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;

  // Operaciones base (actividadLog + logAuditoria)
  const operacionesBase = [
    client.actividadLog.create({
      data: {
        usuario_id: params.usuario_id,
        usuario_nombre: params.usuario_nombre,
        accion: params.accion,
        entidad: params.entidad,
        entidad_id: params.entidad_id ?? null,
        detalle: params.detalle ?? null,
        datos_previos: params.datos_previos
          ? (params.datos_previos as object)
          : undefined,
        datos_nuevos: params.datos_nuevos
          ? (params.datos_nuevos as object)
          : undefined,
      },
    }),
    client.logAuditoria.create({
      data: {
        tabla_afectada: params.entidad,
        registro_id: params.entidad_id ?? "",
        accion: params.accion === "eliminada" ? "DELETE" : "INSERT",
        datos_anteriores: params.datos_previos
          ? (params.datos_previos as object)
          : undefined,
        datos_nuevos: params.datos_nuevos
          ? (params.datos_nuevos as object)
          : undefined,
        usuario_id: params.usuario_id,
      },
    }),
  ];

  // Si se solicita outbox, agregar evento
  const operaciones = params.crearEventoOutbox
    ? [
        ...operacionesBase,
        client.eventoOutbox.create({
          data: {
            tipo: params.tipoEventoOutbox ?? mapearAccionATipoEvento(params.accion),
            correlation_id: params.correlationId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`,
            actor_id: params.usuario_id,
            actor_nombre: params.usuario_nombre,
            entidad: params.entidad,
            entidad_id: params.entidad_id ?? "",
            datos_anteriores: params.datos_previos as import("@/generated/prisma/client").Prisma.InputJsonValue | undefined,
            datos_nuevos: params.datos_nuevos as import("@/generated/prisma/client").Prisma.InputJsonValue | undefined,
            metadata: params.metadataOutbox as import("@/generated/prisma/client").Prisma.InputJsonValue | undefined,
          },
        }),
      ]
    : operacionesBase;

  if (tx) {
    // SECUENCIAL, no Promise.all: las operaciones comparten el MISMO cliente
    // de transacción y pg deprecó query() concurrente sobre un cliente
    // ocupado (warning "client is already executing a query", se rompe en
    // pg@9). Dentro de una tx el orden es determinista e íntegro igualmente.
    for (const op of operaciones) {
      await op;
    }
  } else {
    await client.$transaction(operaciones);
  }
}

export interface PaginadoDTO<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function paginar<T>(items: T[], total: number, page: number, pageSize: number): PaginadoDTO<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getActividad(
  page = 1,
  pageSize = 25,
): Promise<PaginadoDTO<ActividadDTO>> {
  const p = Math.max(1, Math.trunc(page));
  const size = Math.max(1, Math.trunc(pageSize));
  const [rows, total] = await Promise.all([
    prisma.actividadLog.findMany({
      orderBy: { created_at: "desc" },
      skip: (p - 1) * size,
      take: size,
    }),
    prisma.actividadLog.count(),
  ]);
  return paginar(
    rows.map((r) => ({
      id: r.id,
      usuario_nombre: r.usuario_nombre,
      accion: r.accion,
      entidad: r.entidad,
      entidad_id: r.entidad_id,
      detalle: r.detalle,
      created_at: r.created_at.toISOString(),
    })),
    total,
    p,
    size,
  );
}

export async function getLogsAuditoria(
  page = 1,
  pageSize = 25,
): Promise<PaginadoDTO<LogAuditoriaDTO>> {
  const p = Math.max(1, Math.trunc(page));
  const size = Math.max(1, Math.trunc(pageSize));
  const [rows, total] = await Promise.all([
    prisma.logAuditoria.findMany({
      orderBy: { created_at: "desc" },
      skip: (p - 1) * size,
      take: size,
    }),
    prisma.logAuditoria.count(),
  ]);
  return paginar(
    rows.map((r) => ({
      id: r.id,
      tabla_afectada: r.tabla_afectada,
      registro_id: r.registro_id,
      accion: r.accion,
      usuario_id: r.usuario_id,
      datos_anteriores: r.datos_anteriores,
      datos_nuevos: r.datos_nuevos,
      created_at: r.created_at.toISOString(),
    })),
    total,
    p,
    size,
  );
}