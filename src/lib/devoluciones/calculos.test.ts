import { describe, it, expect } from "vitest";
import { calcularSubtotal, formatGs } from "./calculos";

describe("calcularSubtotal", () => {
  it("suma cantidad * precio_unitario", () => {
    expect(
      calcularSubtotal([
        { cantidad: 2, precio_unitario: 1500 },
        { cantidad: 1, precio_unitario: 900 },
      ]),
    ).toBe(3900);
  });

  it("devuelve 0 para una lista vacía", () => {
    expect(calcularSubtotal([])).toBe(0);
  });
});

describe("formatGs", () => {
  it("formatea con símbolo guaraní", () => {
    expect(formatGs(12345)).toMatch(/₲/);
  });
});
