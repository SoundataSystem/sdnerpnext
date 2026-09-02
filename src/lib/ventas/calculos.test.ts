import { describe, it, expect } from "vitest";
import {
  calcularSubtotal,
  calcularTotal,
  calcularVenta,
  roundMoney,
  saldoPendiente,
  estadoCobroOrden,
  formatGs,
  parseDeliveryDeObservaciones,
  conDeliveryEnObservaciones,
  sinDeliveryEnObservaciones,
} from "./calculos";

describe("calcularSubtotal", () => {
  it("suma cantidad * precio", () => {
    expect(
      calcularSubtotal([
        { cantidad: 2, precio_unitario: 1500 },
        { cantidad: 1, precio_unitario: 800 },
      ]),
    ).toBe(3800);
  });

  it("devuelve 0 para una lista vacía", () => {
    expect(calcularSubtotal([])).toBe(0);
  });
});

describe("calcularTotal", () => {
  it("es igual al subtotal cuando no hay cargos", () => {
    expect(calcularTotal(1000)).toBe(1000);
  });

  it("incluye cargos y descuento", () => {
    expect(calcularTotal(1000, { shipping_fee: 100, descuento: 200 })).toBe(
      900,
    );
  });

  it("nunca es negativo", () => {
    expect(calcularTotal(100, { descuento: 500 })).toBe(0);
  });
});

describe("saldoPendiente", () => {
  it("nunca es negativo", () => {
    expect(saldoPendiente(500, 600)).toBe(0);
    expect(saldoPendiente(500, 200)).toBe(300);
  });
});

describe("estadoCobroOrden", () => {
  it("cobrado cuando el pago cubre el total", () => {
    expect(estadoCobroOrden(500, 500)).toBe("cobrado");
  });

  it("parcial cuando el pago es insuficiente", () => {
    expect(estadoCobroOrden(500, 300)).toBe("parcial");
  });
});

describe("formatGs", () => {
  it("formatea guarany con símbolo", () => {
    expect(formatGs(12345)).toMatch(/₲/);
    expect(formatGs(0)).toBe("₲ 0");
  });
});

describe("calcularVenta", () => {
  const base = {
    costo_operativo_porcentaje: 0,
    comision_porcentaje: 0,
  };

  it("contado suma IVA 10% sobre el subtotal", () => {
    const r = calcularVenta(1000, { ...base, tipo_venta: "contado" });
    expect(r.iva).toBe(100);
    expect(r.base).toBe(1100);
    expect(r.total).toBe(1100);
  });

  it("tax_free e iva_incluido no suman IVA extra", () => {
    const t = calcularVenta(1000, { ...base, tipo_venta: "tax_free" });
    expect(t.iva).toBe(0);
    expect(t.total).toBe(1000);
    const i = calcularVenta(1000, { ...base, tipo_venta: "iva_incluido" });
    expect(i.iva).toBe(91); // PROD QA: 1000 - round(1000/1.1), total sigue 1000 (IVA incluido)
    expect(i.total).toBe(1000);
    const m = calcularVenta(1000, { ...base, tipo_venta: "mayor" });
    expect(m.iva).toBe(0);
    expect(m.total).toBe(1000);
  });

  it("delivery suma IVA como contado", () => {
    const r = calcularVenta(1000, { ...base, tipo_venta: "delivery" });
    expect(r.iva).toBe(100);
    expect(r.total).toBe(1100);
  });

  it("delivery con costo: total = subtotal + IVA + costo_delivery", () => {
    const r = calcularVenta(1000, {
      ...base,
      tipo_venta: "delivery",
      costo_delivery: 25000,
    });
    expect(r.iva).toBe(100);
    expect(r.total).toBe(26100);
    expect(r.costo_delivery).toBe(25000);
  });

  it("costo_delivery se ignora fuera del tipo delivery", () => {
    const r = calcularVenta(1000, {
      ...base,
      tipo_venta: "contado",
      costo_delivery: 5000,
    });
    expect(r.costo_delivery).toBe(0);
    expect(r.total).toBe(1100);
  });

  it("el costo operativo se deriva del total cobrado, sin inflarlo", () => {
    const r = calcularVenta(1000, {
      tipo_venta: "contado",
      costo_operativo_porcentaje: 6,
      comision_porcentaje: 0,
    });
    // totalCobrado = subtotal + IVA = 1100; costo = 1100 × 6/106 = 62
    expect(r.total).toBe(1100);
    expect(r.costo_operativo).toBe(62);
    expect(r.base).toBe(1038);
  });

  it("calcula la comisión del vendedor sobre el total cobrado", () => {
    const r = calcularVenta(1000, {
      tipo_venta: "contado",
      costo_operativo_porcentaje: 0,
      comision_porcentaje: 3,
    });
    expect(r.comision_vendedor).toBe(33);
  });
});

describe("roundMoney", () => {
  it("redondea al entero más cercano", () => {
    expect(roundMoney(3.3)).toBe(3);
    expect(roundMoney(3.5)).toBe(4);
  });
});

describe("delivery en observaciones", () => {
  it("parsea el tag histórico DELIVERY:<monto>", () => {
    expect(
      parseDeliveryDeObservaciones(
        "IVA INCLUIDO | DELIVERY:25000 | CONTADO | Pago: Tienda Naranja",
      ),
    ).toBe(25000);
    expect(parseDeliveryDeObservaciones(null)).toBe(0);
    expect(parseDeliveryDeObservaciones("CONTADO | Pago: Efectivo")).toBe(0);
  });

  it("conDeliveryEnObservaciones antepone el tag y quita duplicados", () => {
    expect(conDeliveryEnObservaciones("nota del vendedor", 25000)).toBe(
      "DELIVERY:25000 | nota del vendedor",
    );
    expect(
      conDeliveryEnObservaciones("DELIVERY:10000 | nota", 25000),
    ).toBe("DELIVERY:25000 | nota");
    expect(conDeliveryEnObservaciones("nota", 0)).toBe("nota");
  });

  it("sinDeliveryEnObservaciones deja solo el texto del usuario", () => {
    expect(
      sinDeliveryEnObservaciones("DELIVERY:25000 | nota del vendedor"),
    ).toBe("nota del vendedor");
  });
});