import { NextResponse } from "next/server";
import {
  procesarOutboxEventos,
  obtenerEstadisticasOutbox,
} from "@/lib/eventos/processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint de Vercel Cron para procesar el outbox.
 *
 * Protección (fail-closed):
 * - CRON_SECRET obligatorio en producción; sin él → 500 (nunca público).
 * - Authorization: Bearer <CRON_SECRET> inválido/ausente → 401.
 *   Vercel Cron envía ese header automáticamente con la variable CRON_SECRET.
 *
 * No expone detalles internos de la DB ni errores crudos al cliente.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail-closed también en desarrollo: un endpoint administrativo nunca
    // queda abierto por accidente.
    return new NextResponse(
      JSON.stringify({ error: "CRON_SECRET no configurado" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== secret) {
    return new NextResponse(null, { status: 401 });
  }

  try {
    const resultado = await procesarOutboxEventos();
    const stats = await obtenerEstadisticasOutbox();
    return NextResponse.json({
      ok: true,
      ...resultado,
      pendientes: stats.pendientes,
      fallidos_restantes: stats.fallidos,
      descartados_total: stats.descartados,
    });
  } catch {
    // Sin stack ni mensaje interno: solo señal de fallo para el monitor.
    return new NextResponse(null, { status: 500 });
  }
}
