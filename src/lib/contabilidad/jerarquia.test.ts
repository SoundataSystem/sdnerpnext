import { describe, it, expect } from "vitest";
import {
  calcularNivelCuenta,
  validarCodigoJerarquico,
  cuentaEsDescendienteOIgual,
} from "./jerarquia";

describe("calcularNivelCuenta", () => {
  it("F9: deriva el nivel de la cantidad de segmentos del código", () => {
    expect(calcularNivelCuenta("1", null)).toBe(1);
    expect(calcularNivelCuenta("1.1", null)).toBe(2);
    expect(calcularNivelCuenta("1.1.01", null)).toBe(3);
  });
  it("F9: con padre, el nivel es padre.nivel + 1", () => {
    expect(calcularNivelCuenta("1.1.01", 2)).toBe(3);
    expect(calcularNivelCuenta("1.1.01", 0)).toBe(1);
  });
});

describe("validarCodigoJerarquico", () => {
  it("F9: el código hijo debe empezar por el prefijo del padre", () => {
    expect(validarCodigoJerarquico("1.1", "1")).toBeNull();
    expect(validarCodigoJerarquico("1.1.01", "1.1")).toBeNull();
    expect(validarCodigoJerarquico("1", "1.1")).not.toBeNull();
    expect(validarCodigoJerarquico("10.1", "1")).not.toBeNull();
    expect(validarCodigoJerarquico("1.1", null)).toBeNull();
  });
});

describe("cuentaEsDescendienteOIgual", () => {
  const mapa = new Map<string, string | null>([
    ["1", null],
    ["1.1", "1"],
    ["1.1.1", "1.1"],
    ["1.2", "1"],
    ["2", null],
  ]);

  it("F9: detecta descendencia directa e indirecta", () => {
    expect(cuentaEsDescendienteOIgual("1.1", "1", mapa)).toBe(true);
    expect(cuentaEsDescendienteOIgual("1.1.1", "1", mapa)).toBe(true);
    expect(cuentaEsDescendienteOIgual("1.2", "1.1", mapa)).toBe(false);
    expect(cuentaEsDescendienteOIgual("2", "1", mapa)).toBe(false);
  });
  it("F9: se detecta a sí misma (evita auto-paternidad)", () => {
    expect(cuentaEsDescendienteOIgual("1.1", "1.1", mapa)).toBe(true);
  });
});
