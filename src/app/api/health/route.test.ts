// FASE 7 — Healthcheck: fail-closed en producción, token obligatorio.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(async () => [{ "1": 1 }]),
  },
}));

import { GET } from "@/app/api/health/route";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", "x");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "x");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "x");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "x");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function requestConToken(token?: string): Request {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request("http://localhost/api/health", { headers });
}

describe("healthcheck de producción", () => {
  it("sin HEALTHCHECK_TOKEN configurado → fail-closed (500)", async () => {
    delete process.env.HEALTHCHECK_TOKEN;
    const res = await GET(requestConToken());
    expect(res.status).toBe(500);
  });

  it("token ausente → 401", async () => {
    process.env.HEALTHCHECK_TOKEN = "secreto";
    const res = await GET(requestConToken());
    expect(res.status).toBe(401);
  });

  it("token inválido → 401 (nunca expone detalle)", async () => {
    process.env.HEALTHCHECK_TOKEN = "secreto";
    const res = await GET(requestConToken("otro-token"));
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("");
  });

  it("token válido → 200 con payload mínimo {status}", async () => {
    process.env.HEALTHCHECK_TOKEN = "secreto";
    const res = await GET(requestConToken("secreto"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
    // No filtra variables ni checks internos en producción.
    expect(Object.keys(body)).toEqual(["status"]);
  });

  it("DB caída + token válido → 503 degraded sin detalles", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("ECONNREFUSED secreto"),
    );
    process.env.HEALTHCHECK_TOKEN = "secreto";
    const res = await GET(requestConToken("secreto"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
  });
});
