// Webhook E2E — valida publicadorDefault con fetch mockeado
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { procesarOutboxEventos, OUTBOX_MAX_INTENTOS } from "@/lib/eventos/processor";
import { limpiarEsquema, prisma } from "@/test/integration/db";

const WEBHOOK_URL = "https://example.com/outbox-hook";

async function crearEvento(tipo = "venta.creada") {
  return prisma.eventoOutbox.create({
    data: {
      tipo,
      correlation_id: "corr-" + Math.random().toString(36).slice(2),
      actor_nombre: "test",
      entidad: "orden_venta",
      entidad_id: "00000000-0000-0000-0000-000000000001",
      datos_nuevos: { total: 1000 },
      metadata: { request_id: "req-1" },
    },
  });
}

describe("outbox webhook E2E (publicadorDefault)", () => {
  const envOrig = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await limpiarEsquema();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.OUTBOX_WEBHOOK_URL;
    delete process.env.OUTBOX_WEBHOOK_SECRET;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...envOrig };
    vi.restoreAllMocks();
  });

  it("sin OUTBOX_WEBHOOK_URL → no-op, evento PROCESADO sin fetch", async () => {
    const ev = await crearEvento();
    // sin URL el default es no-op
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    const res = await procesarOutboxEventos();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.procesados).toBe(1);
    const fila = await prisma.eventoOutbox.findUnique({ where: { id: ev.id } });
    expect(fila!.estado).toBe("PROCESADO");
  });

  it("con URL y webhook 200 → PROCESADO, fetch con headers y body correctos", async () => {
    process.env.OUTBOX_WEBHOOK_URL = WEBHOOK_URL;
    process.env.OUTBOX_WEBHOOK_SECRET = "s3cr3t";
    const ev = await crearEvento("cobro.registrado");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const res = await procesarOutboxEventos();

    expect(res.procesados).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(WEBHOOK_URL);
    expect((opts.headers as Record<string, string>)["X-Correlation-Id"]).toBe(ev.correlation_id);
    expect((opts.headers as Record<string, string>)["X-Outbox-Tipo"]).toBe("cobro.registrado");
    expect((opts.headers as Record<string, string>)["X-Outbox-Secret"]).toBe("s3cr3t");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body as string);
    expect(body.id).toBe(ev.id);
    expect(body.tipo).toBe("cobro.registrado");
    expect(body.entidad_id).toBe(ev.entidad_id);
    expect(body.datos_nuevos).toEqual({ total: 1000 });

    const fila = await prisma.eventoOutbox.findUnique({ where: { id: ev.id } });
    expect(fila!.estado).toBe("PROCESADO");
    expect(fila!.intentos).toBe(1);
  });

  it("webhook 500 → FALLIDO con ultimo_error, tras 5 reintentos → DESCARTADO", async () => {
    process.env.OUTBOX_WEBHOOK_URL = WEBHOOK_URL;
    fetchMock.mockResolvedValue(new Response("internal error", { status: 500 }));

    const ev = await crearEvento();
    // primer intento falla
    let res = await procesarOutboxEventos();
    expect(res.fallidos).toBe(1);
    let fila = await prisma.eventoOutbox.findUnique({ where: { id: ev.id } });
    expect(fila!.estado).toBe("FALLIDO");
    expect(fila!.ultimo_error).toContain("Webhook 500");

    // reintentos hasta agotar
    for (let i = 1; i < OUTBOX_MAX_INTENTOS; i++) {
      await prisma.eventoOutbox.update({ where: { id: ev.id }, data: { estado: "PENDIENTE" } });
      res = await procesarOutboxEventos();
    }
    fila = await prisma.eventoOutbox.findUnique({ where: { id: ev.id } });
    expect(fila!.estado).toBe("DESCARTADO");
    expect(fila!.intentos).toBe(OUTBOX_MAX_INTENTOS);
    expect(fetchMock).toHaveBeenCalledTimes(OUTBOX_MAX_INTENTOS);
  });

  it("sin SECRET no envía header X-Outbox-Secret", async () => {
    process.env.OUTBOX_WEBHOOK_URL = WEBHOOK_URL;
    delete process.env.OUTBOX_WEBHOOK_SECRET;
    await crearEvento();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    await procesarOutboxEventos();

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["X-Outbox-Secret"]).toBeUndefined();
    expect(headers["X-Correlation-Id"]).toBeDefined();
  });

  it("webhook timeout/abort → FALLIDO", async () => {
    process.env.OUTBOX_WEBHOOK_URL = WEBHOOK_URL;
    fetchMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));

    const ev = await crearEvento();
    const res = await procesarOutboxEventos();

    expect(res.fallidos).toBe(1);
    const fila = await prisma.eventoOutbox.findUnique({ where: { id: ev.id } });
    expect(fila!.estado).toBe("FALLIDO");
    expect(fila!.ultimo_error).toMatch(/Abort/i);
  });
});
