import { describe, it, expect } from "vitest";
import {
  calcularSubtotal,
  calcularTotal,
  formatGs,
} from "./calculos";

describe("calcularSubtotal", () => {
  it("suma cantidad * precio_unitario", () => {
    expect(
      calcularSubtotal([
        { cantidad: 2, precio_unitario: 1500 },
        { cantidad: 3, precio_unitario: 1000 },
      ]),
    ).toBe(6000);
  });

  it("devuelve 0 para una lista vacía", () => {
    expect(calcularSubtotal([])).toBe(0);
  });
});

describe("calcularTotal", () => {
  it("resta el descuento del subtotal", () => {
    expect(calcularTotal(10000, 1500)).toBe(8500);
  });

  it("sin descuento el total es el subtotal", () => {
    expect(calcularTotal(10000, 0)).toBe(10000);
  });

  it("nunca es negativo", () => {
    expect(calcularTotal(100, 500)).toBe(0);
  });
});

describe("formatGs", () => {
  it("formatea con símbolo guaraní", () => {
    expect(formatGs(12345)).toMatch(/₲/);
    expect(formatGs(0)).toBe("₲ 0");
  });
});
