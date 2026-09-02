import { describe, it, expect } from "vitest";
import {
  calcularSubtotal,
  calcularImpuestos,
  calcularCostoOperativo,
  calcularTotal,
  saldoPendiente,
  formatGs,
} from "./calculos";

describe("calcularSubtotal", () => {
  it("suma cantidad * precio", () => {
    expect(
      calcularSubtotal([
        { cantidad: 3, unit_price: 1000 },
        { cantidad: 2, unit_price: 500 },
      ]),
    ).toBe(4000);
  });
});

describe("calcularImpuestos", () => {
  it("aplica 10% cuando no incluye impuesto", () => {
    expect(calcularImpuestos(1000, false)).toBe(100);
  });

  it("no agrega impuesto cuando la OC lo incluye", () => {
    expect(calcularImpuestos(1000, true)).toBe(0);
  });
});

describe("calcularCostoOperativo", () => {
  it("calcula el porcentaje del subtotal", () => {
    expect(calcularCostoOperativo(10000, 5)).toBe(500);
  });
});

describe("calcularTotal", () => {
  it("suma subtotal + impuestos + costo operativo", () => {
    expect(calcularTotal(1000, 100, 50)).toBe(1150);
  });

  it("nunca es negativo", () => {
    expect(calcularTotal(0, 0, -999)).toBe(0);
  });
});

describe("saldoPendiente", () => {
  it("nunca es negativo", () => {
    expect(saldoPendiente(500, 600)).toBe(0);
    expect(saldoPendiente(500, 200)).toBe(300);
  });
});

describe("formatGs", () => {
  it("formatea guarany con símbolo", () => {
    expect(formatGs(0)).toBe("₲ 0");
    expect(formatGs(12345)).toMatch(/₲/);
  });
});