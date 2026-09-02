import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Processor del outbox (patrón Transactional Outbox).
 *
 * Estados: PENDIENTE → PROCESANDO → PROCESADO | FALLIDO → (reintento) | DESCARTADO
 *
 * Garantías:
 * - Claim atómico con `FOR UPDATE SKIP LOCKED`: dos workers concurrentes
 *   nunca procesan el mismo evento (el segundo no ve las filas bloqueadas).
 * - `procesado_en` se usa como timestamp de ÚLTIMO INTENTO: permite detectar
 *   eventos atascados en PROCESANDO (crash del worker a mitad de proceso) y
 *   reclamarlos de nuevo sin migraciones.
 * - Tras MAX_INTENTOS fallidos el evento pasa a DESCARTADO (no se reintenta
 *   infinitamente; queda visible para monitoreo/post-mortem).
 */

export const OUTBOX_MAX_INTENTOS = 5;

/** Eventos en PROCESANDO más viejos que esto se consideran atascados. */
const STUCK_PROCESANDO_MS = 10 * 60 * 1000;

/** Handler de publicación de un evento (inyectable para tests). */
export type PublicadorEvento = (evento: {
  id: string;
  tipo: string;
  correlation_id: string;
  entidad: string;
  entidad_id: string;
  datos_nuevos: unknown;
  metadata: unknown;
}) => Promise<void>;

/**
 * Publicación por defecto:
 * - Si OUTBOX_WEBHOOK_URL está configurado → POST JSON al webhook
 *   (con HMAC opcional via OUTBOX_WEBHOOK_SECRET). Falla → reintento.
 * - Si no hay URL → no-op (marca PROCESADO, ver AUDITORIA_FASE7.md §F7-10).
 */
export const publicadorDefault: PublicadorEvento = async (evento) => {
  const url = process.env.OUTBOX_WEBHOOK_URL?.trim();
  if (!url) return;
  const secret = process.env.OUTBOX_WEBHOOK_SECRET?.trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-Id": evento.correlation_id,
        "X-Outbox-Tipo": evento.tipo,
        ...(secret ? { "X-Outbox-Secret": secret } : {}),
      },
      body: JSON.stringify(evento),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Webhook ${res.status} ${body.slice(0, 500)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
};

interface EventoClaim {
  id: string;
  tipo: string;
  correlation_id: string;
  entidad: string;
  entidad_id: string;
  datos_nuevos: unknown;
  metadata: unknown;
  intentos: number;
}

/**
 * Reclama hasta `limite` eventos de forma atómica entre workers concurrentes.
 * Incluye recuperación de PROCESANDO atascados.
 */
async function reclamarEventos(limite: number): Promise<EventoClaim[]> {
  const stuckMs = Math.floor(STUCK_PROCESANDO_MS / 1000);
  return prisma.$queryRawUnsafe<EventoClaim[]>(
    `UPDATE eventos_outbox
       SET estado = 'PROCESANDO'::"EstadoEventoOutbox",
           intentos = intentos + 1,
           procesado_en = now()
     WHERE id IN (
       SELECT id FROM eventos_outbox
        WHERE (estado = 'PENDIENTE' AND intentos < $2)
           OR (estado = 'PROCESANDO' AND procesado_en < now() - make_interval(secs => $3))
        ORDER BY created_at ASC
        LIMIT $1
          FOR UPDATE SKIP LOCKED
     )
     RETURNING id, tipo, correlation_id, entidad, entidad_id,
               datos_nuevos, metadata, intentos`,
    limite,
    OUTBOX_MAX_INTENTOS,
    stuckMs,
  );
}

/**
 * Procesa un lote del outbox. Retorna cuántos se publicaron y cuántos fallaron.
 */
export async function procesarOutboxEventos(
  limite = 100,
  publicador: PublicadorEvento = publicadorDefault,
): Promise<{ procesados: number; fallidos: number; descartados: number }> {
  let procesados = 0;
  let fallidos = 0;
  let descartados = 0;

  const eventos = await reclamarEventos(limite);

  for (const evento of eventos) {
    try {
      await publicador({
        id: evento.id,
        tipo: evento.tipo,
        correlation_id: evento.correlation_id,
        entidad: evento.entidad,
        entidad_id: evento.entidad_id,
        datos_nuevos: evento.datos_nuevos,
        metadata: evento.metadata,
      });
      await prisma.eventoOutbox.update({
        where: { id: evento.id },
        data: { estado: "PROCESADO", procesado_en: new Date() },
      });
      procesados++;
    } catch (error) {
      const mensajeError =
        error instanceof Error ? error.message : String(error);
      const agotado = evento.intentos >= OUTBOX_MAX_INTENTOS;
      await prisma.eventoOutbox.update({
        where: { id: evento.id },
        data: {
          estado: agotado ? "DESCARTADO" : "FALLIDO",
          ultimo_error: mensajeError.slice(0, 2000),
          procesado_en: new Date(),
        },
      });
      if (agotado) descartados++;
      else fallidos++;
      console.error(`[OUTBOX] Error procesando evento ${evento.id}:`, mensajeError);
    }
  }

  return { procesados, fallidos, descartados };
}

/**
 * Reencola eventos FALLIDO que no superaron el límite de reintentos.
 */
export async function reintentarEventosFallidos(
  limite = 50,
): Promise<{ reintentados: number }> {
  const resultado = await prisma.eventoOutbox.updateMany({
    where: {
      estado: "FALLIDO",
      intentos: { lt: OUTBOX_MAX_INTENTOS },
    },
    data: { estado: "PENDIENTE", ultimo_error: null },
  });
  return { reintentados: resultado.count };
}

/**
 * Elimina eventos procesados antiguos (retención configurable).
 */
export async function limpiarEventosProcesados(
  diasAntiguedad = 30,
): Promise<number> {
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - diasAntiguedad);

  const resultado = await prisma.eventoOutbox.deleteMany({
    where: {
      estado: "PROCESADO",
      procesado_en: { lt: fechaLimite },
    },
  });
  return resultado.count;
}

/**
 * Estadísticas del outbox para monitoreo.
 */
export async function obtenerEstadisticasOutbox(): Promise<{
  pendientes: number;
  procesando: number;
  procesados: number;
  fallidos: number;
  descartados: number;
  masAntiguoPendiente: Date | null;
}> {
  // Secuencial: mismo cliente Prisma, queries concurrentes no seguras con pg.
  const pendientes = await prisma.eventoOutbox.count({ where: { estado: "PENDIENTE" } });
  const procesando = await prisma.eventoOutbox.count({ where: { estado: "PROCESANDO" } });
  const procesados = await prisma.eventoOutbox.count({ where: { estado: "PROCESADO" } });
  const fallidos = await prisma.eventoOutbox.count({ where: { estado: "FALLIDO" } });
  const descartados = await prisma.eventoOutbox.count({ where: { estado: "DESCARTADO" } });
  const masAntiguo = await prisma.eventoOutbox.findFirst({
    where: { estado: "PENDIENTE" },
    orderBy: { created_at: "asc" },
    select: { created_at: true },
  });

  return {
    pendientes,
    procesando,
    procesados,
    fallidos,
    descartados,
    masAntiguoPendiente: masAntiguo?.created_at ?? null,
  };
}
