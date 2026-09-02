import { describe, it, expect } from "vitest";
import {
  lineasAsientoCobro,
  asientoBalanceado,
  type LineaAsiento,
} from "./lineas-asiento";

function cuadrar(lineas: LineaAsiento[]): boolean {
  return asientoBalanceado(lineas);
}

describe("lineasAsientoCobro", () => {
  it("F6-1: primer pago contado (cubre el total) reconoce ingreso completo", () => {
    const lineas = lineasAsientoCobro({
      pagadoAnterior: 0,
      cobrado: true,
      montoPagado: 100,
      montoTotal: 100,
      saldo: 0,
      tieneCxc: true,
    });
    expect(lineas).toEqual([
      { cuenta: "caja", debe: 100, haber: 0 },
      { cuenta: "ventas", debe: 0, haber: 100 },
    ]);
    expect(cuadrar(lineas)).toBe(true);
  });

  it("F6-1: primera cuota parcial: caja + CxC vs ventas total", () => {
    const lineas = lineasAsientoCobro({
      pagadoAnterior: 0,
      cobrado: false,
      montoPagado: 60,
      montoTotal: 100,
      saldo: 40,
      tieneCxc: true,
    });
    expect(lineas).toEqual([
      { cuenta: "caja", debe: 60, haber: 0 },
      { cuenta: "ventas", debe: 0, haber: 100 },
      { cuenta: "cxc", debe: 40, haber: 0 },
    ]);
    expect(cuadrar(lineas)).toBe(true);
  });

  it("F6-1: segunda cuota que completa la orden salda la CxC (no duplica ventas)", () => {
    const lineas = lineasAsientoCobro({
      pagadoAnterior: 60,
      cobrado: true,
      montoPagado: 40,
      montoTotal: 100,
      saldo: 0,
      tieneCxc: true,
    });
    expect(lineas).toEqual([
      { cuenta: "caja", debe: 40, haber: 0 },
      { cuenta: "cxc", debe: 0, haber: 40 },
    ]);
    expect(cuadrar(lineas)).toBe(true);
  });

  it("F6-1: cuota intermedia parcial salda parcialmente la CxC", () => {
    const lineas = lineasAsientoCobro({
      pagadoAnterior: 30,
      cobrado: false,
      montoPagado: 30,
      montoTotal: 100,
      saldo: 40,
      tieneCxc: true,
    });
    expect(lineas).toEqual([
      { cuenta: "caja", debe: 30, haber: 0 },
      { cuenta: "cxc", debe: 0, haber: 30 },
    ]);
    expect(cuadrar(lineas)).toBe(true);
  });

  it("F6-1: acumulado de cuotas 60 + 40 = 100 queda cuadrado", () => {
    const primera = lineasAsientoCobro({
      pagadoAnterior: 0,
      cobrado: false,
      montoPagado: 60,
      montoTotal: 100,
      saldo: 40,
      tieneCxc: true,
    });
    const segunda = lineasAsientoCobro({
      pagadoAnterior: 60,
      cobrado: true,
      montoPagado: 40,
      montoTotal: 100,
      saldo: 0,
      tieneCxc: true,
    });
    const acumulado = [...primera, ...segunda];
    const debe = acumulado.reduce((s, l) => s + l.debe, 0);
    const haber = acumulado.reduce((s, l) => s + l.haber, 0);
    const cxc = acumulado
      .filter((l) => l.cuenta === "cxc")
      .reduce((s, l) => s + l.debe - l.haber, 0);
    expect(debe).toBe(haber);
    expect(cxc).toBe(0);
    expect(
      acumulado.filter((l) => l.cuenta === "ventas").reduce((s, l) => s + l.haber, 0),
    ).toBe(100);
  });

  it("F6-1: sin cuenta CxC en el plan de cuentas el asiento sigue balanceado", () => {
    const parcial = lineasAsientoCobro({
      pagadoAnterior: 0,
      cobrado: false,
      montoPagado: 60,
      montoTotal: 100,
      saldo: 40,
      tieneCxc: false,
    });
    expect(cuadrar(parcial)).toBe(true);
  });

  it("F6-1: asientoBalanceado detecta líneas desbalanceadas", () => {
    expect(
      asientoBalanceado([
        { cuenta: "caja", debe: 40, haber: 0 },
        { cuenta: "ventas", debe: 0, haber: 100 },
      ]),
    ).toBe(false);
  });
});
