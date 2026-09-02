import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Healthcheck endpoint - versión endurecida.
 * - En producción: solo expone { status: "ok" | "degraded" }
 * - En desarrollo: incluye checks detallados
 * - Protegido por HEALTHCHECK_TOKEN obligatorio en producción
 * - Nunca expone mensajes de error de Prisma/Postgres
 */
export async function GET(request: Request) {
  // Protección por token (obligatorio en producción)
  const expectedToken = process.env.HEALTHCHECK_TOKEN;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  
  // En producción, el token es obligatorio
  if (process.env.NODE_ENV === "production") {
    if (!expectedToken) {
      return new NextResponse(
        JSON.stringify({ error: "HEALTHCHECK_TOKEN no configurado" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    if (token !== expectedToken) {
      return new NextResponse(null, { status: 401 });
    }
    // Token válido: continúa a los checks y responde {status} mínimo.
  }

  const checks: Record<string, string> = {};

  // Variables de entorno (solo presencia, nunca valores)
  const envVars = [
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  for (const key of envVars) {
    checks[key] = process.env[key] ? "set" : "MISSING";
  }

  // Conexión a DB - sin exponer errores internos
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
    checks.db = "ok";
  } catch {
    checks.db = "error";
  }

  const allOk = Object.values(checks).every((v) => v === "set" || v === "ok");

  // En producción: respuesta mínima sin detalles internos
  if ((process.env.NODE_ENV as string) === "production") {
    return NextResponse.json(
      { status: allOk ? "ok" : "degraded" },
      { status: allOk ? 200 : 503 },
    );
  }

  // En desarrollo: detalles para debugging
  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", checks },
    { status: allOk ? 200 : 503 },
  );
}