// FASE 7 — Processor del outbox: estados, recuperación de atascos,
// descarte tras agotar reintentos y concurrencia entre workers.
import { describe, it, expect, beforeEach } from "vitest";
import {
  procesarOutboxEventos,
  reintentarEventosFallidos,
  OUTBOX_MAX_INTENTOS,
  type PublicadorEvento,
} from "@/lib/eventos/processor";
import { limpiarEsquema, prisma } from "@/test/integration/db";

beforeEach(async () => {
  await limpiarEsquema();
});

async function crearEvento(tipo = "venta.creada") {
  return prisma.eventoOutbox.create({
    data: {
      tipo,
      correlation_id: "corr-" + Math.random().toString(36).slice(2),
      actor_nombre: "test",
      entidad: "orden_venta",
      entidad_id: "00000000-0000-0000-0000-000000000001",
    },
  });
}

describe("procesarOutboxEventos", () => {
  it("PENDIENTE → PROCESADO con el publicador por defecto", async () => {
    const ev = await crearEvento();

    const res = await procesarOutboxEventos();

    expect(res.procesados).toBe(1);
    const fila = await prisma.eventoOutbox.findUnique({ where: { id: ev.id } });
    expect(fila!.estado).toBe("PROCESADO");
    expect(fila!.procesado_en).toBeTruthy();
    expect(fila!.intentos).toBe(1);
  });

  it("fallo de publicación → FALLIDO con ultimo_error", async () => {
    const ev = await crearEvento();
    const publicadorFalla: PublicadorEvento = async () => {
      throw new Error("broker caído");
    };

    const res = await procesarOutboxEventos(100, publicadorFalla);

    expect(res.fallidos).toBe(1);
    const fila = await prisma.eventoOutbox.findUnique({ where: { id: ev.id } });
    expect(fila!.estado).toBe("FALLIDO");
    expect(fila!.ultimo_error).toContain("broker caído");
  });

  it("agota los reintentos y pasa a DESCARTADO", async () => {
    const ev = await crearEvento();
    const publicadorFalla: PublicadorEvento = async () => {
      throw new Error("fallo persistente");
    };

    for (let i = 0; i < OUTBOX_MAX_INTENTOS; i++) {
      await reintentarEventosFallidos(); // FALLIDO → PENDIENTE
      await procesarOutboxEventos(100, publicadorFalla);
    }

    const fila = await prisma.eventoOutbox.findUnique({ where: { id: ev.id } });
    expect(fila!.estado).toBe("DESCARTADO");
    expect(fila!.intentos).toBe(OUTBOX_MAX_INTENTOS);
  });

  it("recupera eventos atascados en PROCESANDO (crash simulado)", async () => {
    const ev = await crearEvento();
    // Simula un worker que murió a mitad de proceso hace 20 minutos.
    await prisma.eventoOutbox.update({
      where: { id: ev.id },
      data: {
        estado: "PROCESANDO",
        intentos: 3,
        procesado_en: new Date(Date.now() - 20 * 60 * 1000),
      },
    });

    const res = await procesarOutboxEventos();

    expect(res.procesados).toBe(1);
    const fila = await prisma.eventoOutbox.findUnique({ where: { id: ev.id } });
    expect(fila!.estado).toBe("PROCESADO");
    expect(fila!.intentos).toBe(4);
  });

  it("NO reclama PROCESING reciente (otro worker lo está llevando)", async () => {
    const ev = await crearEvento();
    await prisma.eventoOutbox.update({
      where: { id: ev.id },
      data: { estado: "PROCESANDO", intentos: 1, procesado_en: new Date() },
    });

    const res = await procesarOutboxEventos();

    expect(res.procesados).toBe(0);
    const fila = await prisma.eventoOutbox.findUnique({ where: { id: ev.id } });
    expect(fila!.estado).toBe("PROCESANDO");
  });

  it("dos workers concurrentes: cada evento se publica EXACTAMENTE una vez", async () => {
    const total = 8;
    const ids: string[] = [];
    for (let i = 0; i < total; i++) {
      ids.push((await crearEvento()).id);
    }

    const publicadosPorWorker: string[][] = [[], []];
    const publicadorContador =
      (registro: string[]): PublicadorEvento =>
      async (evento) => {
        registro.push(evento.id);
      };

    const [a, b] = await Promise.all([
      procesarOutboxEventos(100, publicadorContador(publicadosPorWorker[0])),
      procesarOutboxEventos(100, publicadorContador(publicadosPorWorker[1])),
    ]);

    expect(a.procesados + b.procesados).toBe(total);

    const todos = [...publicadosPorWorker[0], ...publicadosPorWorker[1]];
    // Invariante: sin duplicados entre workers (SKIP LOCKED).
    expect(new Set(todos).size).toBe(total);
    expect(todos.sort()).toEqual([...ids].sort());

    const estados = await prisma.eventoOutbox.groupBy({
      by: ["estado"],
      _count: { estado: true },
    });
    const procesado = estados.find((e) => e.estado === "PROCESADO");
    expect(procesado!._count.estado).toBe(total);
  });

  it("reintentarEventosFallidos reencola sin tocar DESCARTADO", async () => {
    const fallido = await crearEvento();
    const descartado = await crearEvento();
    await prisma.eventoOutbox.update({
      where: { id: fallido.id },
      data: { estado: "FALLIDO", intentos: 2, ultimo_error: "x" },
    });
    await prisma.eventoOutbox.update({
      where: { id: descartado.id },
      data: { estado: "DESCARTADO", intentos: OUTBOX_MAX_INTENTOS },
    });

    const res = await reintentarEventosFallidos();

    expect(res.reintentados).toBe(1);
    expect(
      (await prisma.eventoOutbox.findUnique({ where: { id: fallido.id } }))!.estado,
    ).toBe("PENDIENTE");
    expect(
      (await prisma.eventoOutbox.findUnique({ where: { id: descartado.id } }))!.estado,
    ).toBe("DESCARTADO");
  });
});
