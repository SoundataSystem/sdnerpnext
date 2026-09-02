import { describe, it, expect } from "vitest";
import { calcularCostoTotal, garantiaVigente, formatGs } from "./calculos";

describe("calcularCostoTotal", () => {
  it("suma mano de obra y repuestos", () => {
    expect(calcularCostoTotal(50000, 12000)).toBe(62000);
  });

  it("ignora valores negativos", () => {
    expect(calcularCostoTotal(-100, 100)).toBe(100);
  });
});

describe("garantiaVigente", () => {
  it("es vigente si el vencimiento es hoy o mayor", () => {
    expect(garantiaVigente("2027-01-01", "2026-08-13")).toBe(true);
  });

  it("no es vigente cuando venció", () => {
    expect(garantiaVigente("2025-01-01", "2026-08-13")).toBe(false);
  });
});

describe("formatGs", () => {
  it("formatea con símbolo guaraní", () => {
    expect(formatGs(12345)).toMatch(/₲/);
  });
});