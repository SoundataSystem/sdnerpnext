import { describe, it, expect } from "vitest";
import {
  formatearCodigoGarantia,
  calcularVencimientoGarantia,
  serialesARestituir,
} from "./garantias";

describe("formatearCodigoGarantia", () => {
  it("F7-G2: genera formato G-AAAA-NNNN del doc", () => {
    expect(formatearCodigoGarantia(2026, 1)).toBe("G-2026-0001");
    expect(formatearCodigoGarantia(2026, 42)).toBe("G-2026-0042");
    expect(formatearCodigoGarantia(2026, 12345)).toBe("G-2026-12345");
  });
  it("F7-G2: nunca devuelve secuencia menor a 1", () => {
    expect(formatearCodigoGarantia(2026, 0)).toBe("G-2026-0001");
  });
});

describe("calcularVencimientoGarantia", () => {
  it("F7-G: suma meses manteniendo el día", () => {
    const base = new Date(2026, 0, 15);
    const vencimiento = calcularVencimientoGarantia(base, 12);
    expect(vencimiento.getFullYear()).toBe(2027);
    expect(vencimiento.getMonth()).toBe(0);
    expect(vencimiento.getDate()).toBe(15);
  });
});

describe("serialesARestituir", () => {
  const items = [
    { serial: "SN-100", serial_producto: null },
    { serial: null, serial_producto: "SN-200" },
    { serial: null, serial_producto: null },
    { serial: "SN-300", serial_producto: "SN-300" },
    { serial: "SN-400", serial_producto: null },
  ];

  it("F7-S2: restituye hasta la cantidad devuelta", () => {
    expect(serialesARestituir(items, 2)).toEqual(["SN-100", "SN-200"]);
  });
  it("F7-S2: no supera la cantidad ni incluye ítems sin serial", () => {
    expect(serialesARestituir(items, 99)).toEqual([
      "SN-100",
      "SN-200",
      "SN-300",
      "SN-400",
    ]);
  });
  it("F7-S2: evita duplicados", () => {
    const repetidos = [
      { serial: "SN-X", serial_producto: null },
      { serial: "SN-X", serial_producto: null },
    ];
    expect(serialesARestituir(repetidos, 5)).toEqual(["SN-X"]);
  });
});
