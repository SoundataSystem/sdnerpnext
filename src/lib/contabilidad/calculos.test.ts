import { describe, it, expect } from "vitest";
import {
  bucketAntiguedad,
  calcularBalance,
  calcularEstadoResultados,
  construirMovimientosLibroDiario,
  diasVencido,
  saldoCuenta,
} from "./calculos";
import type { AsientoDTO, CuentaDTO } from "./repository";

function cuenta(overrides: Partial<CuentaDTO>): CuentaDTO {
  return {
    id: "cuenta-" + (overrides.codigo ?? "x"),
    codigo: "1",
    nombre: "Cuenta",
    tipo: "activo",
    nivel: 3,
    padre_id: null,
    activo: true,
    ...overrides,
  };
}

function asiento(overrides: Partial<AsientoDTO>): AsientoDTO {
  return {
    id: "asiento-" + Math.random().toString(36).slice(2),
    numero_asiento: "AS-2026-0001",
    fecha: "2026-01-15",
    concepto: "Venta",
    referencia_tipo: null,
    referencia_id: null,
    estado: "contabilizado",
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
    detalles: [],
    ...overrides,
  };
}

describe("saldoCuenta", () => {
  it("activo es deudora (debe - haber)", () => {
    const c = cuenta({ tipo: "activo" });
    expect(saldoCuenta(c, [{ debe: 100, haber: 30 }])).toBe(70);
  });

  it("pasivo es acreedora (haber - debe)", () => {
    const c = cuenta({ tipo: "pasivo" });
    expect(saldoCuenta(c, [{ debe: 30, haber: 100 }])).toBe(70);
  });

  it("gasto es deudora", () => {
    const c = cuenta({ tipo: "gasto" });
    expect(saldoCuenta(c, [{ debe: 50, haber: 0 }])).toBe(50);
  });

  it("ingreso es acreedora", () => {
    const c = cuenta({ tipo: "ingreso" });
    expect(saldoCuenta(c, [{ debe: 0, haber: 80 }])).toBe(80);
  });
});

describe("calcularBalance", () => {
  const caja = cuenta({ codigo: "1.1.01", tipo: "activo", nombre: "Caja" });
  const capital = cuenta({
    codigo: "3.1.01",
    tipo: "patrimonio",
    nombre: "Capital",
  });
  const ventas = cuenta({
    codigo: "4.1.01",
    tipo: "ingreso",
    nombre: "Ventas",
  });

  const a = asiento({
    detalles: [
      { id: "d1", asiento_id: "a1", cuenta_id: caja.id, debe: 1000, haber: 0 },
      { id: "d2", asiento_id: "a1", cuenta_id: ventas.id, debe: 0, haber: 1000 },
    ],
  });

  it("agrupa activos y patrimonio solo con contabilizados", () => {
    const res = calcularBalance([a], [caja, capital, ventas]);
    expect(res.totalActivos).toBe(1000);
    expect(res.totalPatrimonio).toBe(0);
  });

  it("incluye patrimonio cuando hay asiento de apertura", () => {
    const apertura = asiento({
      numero_asiento: "AS-2026-0000",
      detalles: [
        { id: "d3", asiento_id: "a2", cuenta_id: caja.id, debe: 5000, haber: 0 },
        { id: "d4", asiento_id: "a2", cuenta_id: capital.id, debe: 0, haber: 5000 },
      ],
    });
    const res = calcularBalance([a, apertura], [caja, capital, ventas]);
    expect(res.totalActivos).toBe(6000);
    expect(res.totalPatrimonio).toBe(5000);
    // El ingreso (₲1000) aún no se cerró a patrimonio → no cuadra
    expect(res.cuadrado).toBe(false);
  });

  it("respeta la fecha de corte", () => {
    const posterior = asiento({
      numero_asiento: "AS-2026-0002",
      fecha: "2026-02-01",
      detalles: [
        { id: "d5", asiento_id: "a3", cuenta_id: caja.id, debe: 100, haber: 0 },
        { id: "d6", asiento_id: "a3", cuenta_id: ventas.id, debe: 0, haber: 100 },
      ],
    });
    const res = calcularBalance([a, posterior], [caja, capital, ventas], "2026-01-31");
    expect(res.totalActivos).toBe(1000);
  });

  it("ignora borradores", () => {
    const borrador = asiento({
      estado: "borrador",
      detalles: [
        { id: "d7", asiento_id: "a4", cuenta_id: caja.id, debe: 999, haber: 0 },
        { id: "d8", asiento_id: "a4", cuenta_id: ventas.id, debe: 0, haber: 999 },
      ],
    });
    const res = calcularBalance([a, borrador], [caja, capital, ventas]);
    expect(res.totalActivos).toBe(1000);
  });
});

describe("calcularEstadoResultados", () => {
  const ventas = cuenta({
    codigo: "4.1.01",
    tipo: "ingreso",
    nombre: "Ventas",
  });
  const sueldos = cuenta({
    codigo: "5.1.01",
    tipo: "gasto",
    nombre: "Sueldos",
  });

  it("calcula utilidad = ingresos - gastos", () => {
    const a = asiento({
      detalles: [
        { id: "d1", asiento_id: "a1", cuenta_id: ventas.id, debe: 0, haber: 1000 },
        { id: "d2", asiento_id: "a1", cuenta_id: sueldos.id, debe: 400, haber: 0 },
      ],
    });
    const res = calcularEstadoResultados([a], [ventas, sueldos]);
    expect(res.totalIngresos).toBe(1000);
    expect(res.totalGastos).toBe(400);
    expect(res.utilidad).toBe(600);
  });
});

describe("construirMovimientosLibroDiario", () => {
  const caja = cuenta({ codigo: "1.1.01", tipo: "activo", nombre: "Caja" });
  const ventas = cuenta({
    codigo: "4.1.01",
    tipo: "ingreso",
    nombre: "Ventas",
  });

  const a = asiento({
    numero_asiento: "AS-2026-0001",
    detalles: [
      { id: "d1", asiento_id: "a1", cuenta_id: caja.id, debe: 500, haber: 0, cuenta: caja },
      { id: "d2", asiento_id: "a1", cuenta_id: ventas.id, debe: 0, haber: 500, cuenta: ventas },
    ],
  });

  it("aplanar detalles con cuenta poblada", () => {
    const movs = construirMovimientosLibroDiario([a]);
    expect(movs).toHaveLength(2);
    expect(movs[0].cuenta_codigo).toBe("1.1.01");
    expect(movs[0].debe).toBe(500);
    expect(movs[1].haber).toBe(500);
  });

  it("filtra por cuenta y rango de fechas", () => {
    const movs = construirMovimientosLibroDiario([a], {
      cuentaId: caja.id,
      desde: "2026-01-01",
      hasta: "2026-01-31",
    });
    expect(movs).toHaveLength(1);
    expect(movs[0].cuenta_id).toBe(caja.id);
  });
});

describe("diasVencido", () => {
  const hoy = new Date("2026-02-10T12:00:00");

  it("es 0 cuando no hay fecha de vencimiento", () => {
    expect(diasVencido(null, hoy)).toBe(0);
  });

  it("es 0 cuando vence hoy", () => {
    expect(diasVencido("2026-02-10", hoy)).toBe(0);
  });

  it("es negativo cuando aún no vence", () => {
    expect(diasVencido("2026-02-20", hoy)).toBe(-10);
  });

  it("es positivo cuando está vencida", () => {
    expect(diasVencido("2026-01-31", hoy)).toBe(10);
  });
});

describe("bucketAntiguedad", () => {
  const hoy = new Date("2026-02-10T12:00:00");

  it("clasifica corriente", () => {
    expect(bucketAntiguedad("2026-02-15", hoy)).toBe("corriente");
  });

  it("clasifica 1-30", () => {
    expect(bucketAntiguedad("2026-01-25", hoy)).toBe("1-30");
  });

  it("clasifica 31-60", () => {
    expect(bucketAntiguedad("2026-01-01", hoy)).toBe("31-60");
  });

  it("clasifica 61-90", () => {
    expect(bucketAntiguedad("2025-12-01", hoy)).toBe("61-90");
  });

  it("clasifica 90+", () => {
    expect(bucketAntiguedad("2025-10-01", hoy)).toBe("90+");
  });

  it("sin fecha es corriente", () => {
    expect(bucketAntiguedad(null, hoy)).toBe("corriente");
  });
});
