// FASE 7 — Formateo determinista: la zona horaria fijada elimina el
// mismatch de hidratación (#418) entre SSR (UTC) y navegador (es-PY).
import { describe, it, expect } from "vitest";
import { fechaCorta, fechaHora, numero } from "@/lib/formato";

describe("fechaCorta / fechaHora (America/Asuncion fija)", () => {
  it("convierte al día calendario de Paraguay, no al UTC", () => {
    // 2026-08-25T02:30Z == 2026-08-24 22:30 en Asuncion (UTC-4 en agosto).
    const iso = "2026-08-25T02:30:00Z";
    expect(fechaCorta(iso)).toContain("24/8/26");
    expect(fechaHora(iso)).toContain("24/8/26");
    // Paraguay: UTC-3 fijo (DST abolida en 2024).
    expect(fechaHora(iso)).toContain("23:30");
  });

  it("acepta Date y string por igual", () => {
    const d = new Date("2026-01-15T12:00:00Z");
    expect(fechaCorta(d)).toBe(fechaCorta(d.toISOString()));
    expect(fechaHora(d)).toBe(fechaHora(d.toISOString()));
  });

  it("formato estable: mismo input → mismo output siempre", () => {
    const iso = "2025-12-31T23:59:59Z";
    expect(fechaCorta(iso)).toBe(fechaCorta(iso));
  });
});

describe("numero (agrupación es-PY)", () => {
  it("agrupa con puntos", () => {
    expect(numero(1234567)).toBe("1.234.567");
  });
  it("acepta string decimal", () => {
    expect(numero("1234.5")).toBe("1.234,5");
  });
  it("valores no finitos pasan sin excepción", () => {
    expect(String(numero(NaN))).toBe("NaN");
  });
});
