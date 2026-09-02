import { describe, it, expect, beforeEach } from "vitest";
import {
  crearOrden,
  getOrden,
  registrarCobro,
  cambiarEstadoOrden,
  facturarCajaMovimiento,
  anularCajaMovimiento,
  eliminarOrden,
  getProximoOrdenNumber,
} from "@/lib/ventas/repository";
import { getProximoNumero } from "@/lib/numeracion";
import { limpiarEsquema, prisma } from "@/test/integration/db";
import {
  crearVendedor,
  crearCliente,
  crearProducto,
  crearDeposito,
  setStock,
  crearConfiguracion,
  crearMetodoPago,
  crearPlanCuentaVentas,
} from "@/test/integration/fixtures";

const ANIO = new Date().getFullYear();

beforeEach(async () => {
  await limpiarEsquema();
});

type Linea = {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  serial: string;
};

// zod v4: `z.infer` es el OUTPUT del schema (los `.default()` son requeridos).
function ordenInput(
  cliente_id: string,
  items: Linea[],
  extra: Partial<{
    tipo_venta: "contado" | "tax_free" | "iva_incluido" | "delivery";
    moneda: "GS" | "USD";
    metodo_pago: string;
    costo_delivery: number;
  }> = {},
) {
  return {
    cliente_id,
    items,
    observaciones: "",
    is_tax_included: false,
    sucursal: "",
    moneda: "GS" as const,
    tipo_venta: "tax_free" as const,
    metodo_pago: "",
    ...extra,
  };
}

function cobroInput(orden_id: string, monto_pagado: number, metodo_pago: string) {
  return { orden_id, monto_pagado, metodo_pago, numero_factura: "" };
}

async function setupVenta({
  stock = 10,
  serial = "",
  metodoPago = "",
  precio = 1000,
  cantidad = 1,
}: {
  stock?: number;
  serial?: string;
  metodoPago?: string;
  precio?: number;
  cantidad?: number;
} = {}) {
  const vendedor = await crearVendedor();
  const cliente = await crearCliente();
  const producto = await crearProducto({ precio_base: precio });
  const deposito = await crearDeposito();
  await setStock(producto.id, deposito.id, stock);
  await crearConfiguracion();
  if (metodoPago) await crearMetodoPago({ nombre: metodoPago });
  if (serial) {
    await prisma.productoSerie.create({
      data: { producto_id: producto.id, serial, activo: true },
    });
  }
  const item = { producto_id: producto.id, cantidad, precio_unitario: precio, serial };
  return { vendedor, cliente, producto, deposito, item };
}

describe("crearOrden", () => {
  it("crea orden pendiente con número VTA secuencial, valida stock total y genera caja_movimientos", async () => {
    const { vendedor, cliente, producto, deposito, item } = await setupVenta({
      stock: 10,
      precio: 2000,
    });

    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);

    const orden = await getOrden(ordenId);
    expect(orden).not.toBeNull();
    expect(orden!.numero_orden).toMatch(new RegExp(`^VTA-${ANIO}-\\d{4}$`));
    expect(orden!.estado).toBe("pendiente");
    expect(orden!.estado_caja).toBe("pendiente_envio");
    expect(orden!.total).toBe(2000);
    expect(orden!.items).toHaveLength(1);
    expect(orden!.items[0].producto_id).toBe(producto.id);

    // La orden es un ticket informativo: no descuenta stock por depósito.
    const pd = await prisma.productoDeposito.findUnique({
      where: {
        producto_id_deposito_id: { producto_id: producto.id, deposito_id: deposito.id },
      },
    });
    expect(Number(pd!.stock)).toBe(10);

    const mov = await prisma.cajaMovimiento.findFirst({ where: { orden_id: ordenId } });
    expect(mov).not.toBeNull();
    expect(mov!.estado).toBe("pendiente");
    expect(Number(mov!.monto_total)).toBe(2000);

    const mi = await prisma.movimientoInventario.findFirst({
      where: { producto_id: producto.id, tipo: "salida" },
    });
    expect(mi).toBeNull();

    expect(await getProximoNumero(prisma, "orden", ANIO)).toBe(2);
  });

  it("asigna números consecutivos en órdenes sucesivas", async () => {
    const { vendedor, cliente, item } = await setupVenta({ stock: 50 });

    const a = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    const b = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    const c = await crearOrden(ordenInput(cliente.id, [item]), vendedor);

    const [oa, ob, oc] = [await getOrden(a), await getOrden(b), await getOrden(c)];
    const seqs = [oa!.numero_orden, ob!.numero_orden, oc!.numero_orden].map((n) =>
      Number(n.split("-")[2]),
    );
    expect(seqs).toEqual([1, 2, 3]);
    expect(new Set(seqs).size).toBe(3);
  });

  it("crea orden con delivery: total = subtotal + IVA + costo_delivery, guarda shipping_fee y tag DELIVERY:", async () => {
    const { vendedor, cliente, item } = await setupVenta({ stock: 10, precio: 2000 });

    const ordenId = await crearOrden(
      ordenInput(cliente.id, [item], { tipo_venta: "delivery", costo_delivery: 5000 }),
      vendedor,
    );

    const orden = await getOrden(ordenId);
    expect(orden!.total).toBe(7200); // 2000 + 200 (IVA) + 5000
    expect(orden!.shipping_fee).toBe(5000);
    expect(orden!.observaciones).toContain("DELIVERY:5000");

    const mov = await prisma.cajaMovimiento.findFirst({ where: { orden_id: ordenId } });
    expect(Number(mov!.monto_total)).toBe(7200);
  });

  it("no aplica costo_delivery en moneda USD", async () => {
    const { vendedor, cliente, item } = await setupVenta({ stock: 10, precio: 2000 });

    const ordenId = await crearOrden(
      ordenInput(cliente.id, [item], {
        tipo_venta: "delivery",
        moneda: "USD",
        costo_delivery: 5000,
      }),
      vendedor,
    );

    const orden = await getOrden(ordenId);
    expect(orden!.total).toBe(2200); // 2000 + 200 IVA (el costo se omite en USD)
    expect(orden!.shipping_fee).toBe(0);
  });

  it("marca el serial como vendido al crear la orden", async () => {
    const { vendedor, cliente, item, producto } = await setupVenta({
      stock: 5,
      serial: "SN-001",
    });

    await crearOrden(ordenInput(cliente.id, [item]), vendedor);

    const serie = await prisma.productoSerie.findFirst({
      where: { producto_id: producto.id, serial: "SN-001" },
    });
    expect(serie!.activo).toBe(false);
  });

  it("rechaza stock insuficiente y revierte la transacción (sin orden ni número consumido)", async () => {
    const { vendedor, cliente, item } = await setupVenta({ stock: 1 });

    await expect(
      crearOrden(ordenInput(cliente.id, [{ ...item, cantidad: 5 }]), vendedor),
    ).rejects.toThrow(/Stock insuficiente/);

    expect(await prisma.orden.count()).toBe(0);
    expect(await prisma.cajaMovimiento.count()).toBe(0);
    expect(await getProximoNumero(prisma, "orden", ANIO)).toBe(1);
  });

  it("rechaza producto inactivo", async () => {
    const { vendedor, cliente, item, producto } = await setupVenta();
    await prisma.producto.update({ where: { id: producto.id }, data: { activo: false } });

    await expect(crearOrden(ordenInput(cliente.id, [item]), vendedor)).rejects.toThrow(
      /Producto inactivo/,
    );
    expect(await prisma.orden.count()).toBe(0);
  });

  it(
    "asigna números únicos y consecutivos bajo creación concurrente",
    { timeout: 120_000 },
    async () => {
      const { vendedor, cliente, item } = await setupVenta({ stock: 100 });

      const resultados = await Promise.all(
        Array.from({ length: 6 }, () =>
          crearOrden(ordenInput(cliente.id, [item]), vendedor),
        ),
      );

      expect(resultados).toHaveLength(6);
      const nums = await prisma.orden.findMany({
        where: { id: { in: resultados } },
        select: { numero_orden: true },
      });
      const seqs = nums.map((o) => Number(o.numero_orden.split("-")[2])).sort((a, b) => a - b);
      expect(new Set(seqs).size).toBe(6);
      expect(seqs).toEqual(Array.from({ length: 6 }, (_, i) => i + 1));
    },
  );
});

describe("registrarCobro", () => {
  async function crearOrdenCobrable(precio = 10000) {
    const { vendedor, cliente, item } = await setupVenta({ stock: 10, precio });
    await crearPlanCuentaVentas();
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    return { ordenId, vendedor, cliente, total: precio };
  }

  it("cobra el total: caja cobrado, pago creado, cuenta pagada y asiento balanceado", async () => {
    const { ordenId, vendedor } = await crearOrdenCobrable();

    const movId = await registrarCobro(cobroInput(ordenId, 10000, "Efectivo"), vendedor);

    const mov = await prisma.cajaMovimiento.findUnique({ where: { id: movId } });
    expect(mov!.estado).toBe("cobrado");
    expect(Number(mov!.monto_pagado)).toBe(10000);

    const orden = await getOrden(ordenId);
    expect(orden!.estado_caja).toBe("cobrado");
    expect(orden!.fecha_cobro).not.toBeNull();

    const pagos = await prisma.pagoCliente.findMany({ where: { orden_id: ordenId } });
    expect(pagos).toHaveLength(1);
    expect(Number(pagos[0].monto)).toBe(10000);

    const cxc = await prisma.cuentaCobrar.findUnique({ where: { orden_id: ordenId } });
    expect(cxc!.estado).toBe("pagado");
    expect(Number(cxc!.saldo_pendiente)).toBe(0);

    const asiento = await prisma.asientoContable.findFirst({
      where: { referencia_tipo: "caja", referencia_id: movId },
      include: { detalles: true },
    });
    expect(asiento).not.toBeNull();
    expect(asiento!.estado).toBe("contabilizado");
    expect(asiento!.numero_asiento).toMatch(new RegExp(`^AS-${ANIO}-\\d{4}$`));
    const debe = asiento!.detalles.reduce((s, d) => s + Number(d.debe ?? 0), 0);
    const haber = asiento!.detalles.reduce((s, d) => s + Number(d.haber ?? 0), 0);
    expect(debe).toBeGreaterThan(0);
    expect(debe).toBe(haber);
  });

  it("acumula pagos parciales y liquida al final", async () => {
    const { ordenId, vendedor } = await crearOrdenCobrable();

    const movId1 = await registrarCobro(cobroInput(ordenId, 4000, "Efectivo"), vendedor);
    const mov = await prisma.cajaMovimiento.findUnique({ where: { id: movId1 } });
    expect(Number(mov!.monto_pagado)).toBe(4000);
    const orden1 = await getOrden(ordenId);
    expect(orden1!.estado_caja).toBe("parcial");
    let cxc = await prisma.cuentaCobrar.findUnique({ where: { orden_id: ordenId } });
    expect(cxc!.estado).toBe("parcial");
    expect(Number(cxc!.saldo_pendiente)).toBe(6000);
    expect(await prisma.cuentaCobrar.count({ where: { orden_id: ordenId } })).toBe(1);

    const movId2 = await registrarCobro(cobroInput(ordenId, 6000, "Tarjeta"), vendedor);
    const mov2 = await prisma.cajaMovimiento.findUnique({ where: { id: movId2 } });
    expect(Number(mov2!.monto_pagado)).toBe(10000);
    const orden2 = await getOrden(ordenId);
    expect(orden2!.estado_caja).toBe("cobrado");
    cxc = await prisma.cuentaCobrar.findUnique({ where: { orden_id: ordenId } });
    expect(cxc!.estado).toBe("pagado");
    expect(Number(cxc!.saldo_pendiente)).toBe(0);

    const asientos = await prisma.asientoContable.count({
      where: { referencia_tipo: "caja", referencia_id: { in: [movId1, movId2] } },
    });
    expect(asientos).toBe(2);
  });

  it("rechaza un monto que supera el saldo y no registra el pago", async () => {
    const { ordenId, vendedor } = await crearOrdenCobrable();

    await expect(
      registrarCobro(cobroInput(ordenId, 15000, "Efectivo"), vendedor),
    ).rejects.toThrow(/supera/);

    expect(await prisma.pagoCliente.count({ where: { orden_id: ordenId } })).toBe(0);
    expect(await prisma.asientoContable.count()).toBe(0);
  });

  it("rechaza el cobro de una orden cancelada", async () => {
    const { ordenId, vendedor } = await crearOrdenCobrable();
    await cambiarEstadoOrden(ordenId, "cancelada");

    await expect(
      registrarCobro(cobroInput(ordenId, 10000, "Efectivo"), vendedor),
    ).rejects.toThrow(/cancelada/);
  });
});

describe("cambiarEstadoOrden", () => {
  it("cancela la orden: no altera stock (ticket informativo) y reactiva el serial", async () => {
    const { vendedor, cliente, producto, deposito, item } = await setupVenta({
      stock: 5,
      serial: "SN-002",
    });
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);

    await cambiarEstadoOrden(ordenId, "cancelada");

    // La orden no descuenta stock por depósito, así que sigue intacto.
    const pd = await prisma.productoDeposito.findUnique({
      where: {
        producto_id_deposito_id: { producto_id: producto.id, deposito_id: deposito.id },
      },
    });
    expect(Number(pd!.stock)).toBe(5);

    const serie = await prisma.productoSerie.findFirst({
      where: { producto_id: producto.id, serial: "SN-002" },
    });
    expect(serie!.activo).toBe(true);

    const orden = await getOrden(ordenId);
    expect(orden!.estado).toBe("cancelada");
  });

  it("cancelar dos veces es idempotente: la segunda es no-op exitoso (doble click)", async () => {
    const { vendedor, cliente, item } = await setupVenta({ stock: 5 });
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    await cambiarEstadoOrden(ordenId, "cancelada");

    // Idempotencia: el reintento/doble click no lanza error ni re-ejecuta
    // efectos (no reintenta reactivaciones de serial, etc.)
    await expect(cambiarEstadoOrden(ordenId, "cancelada")).resolves.toBeUndefined();

    const orden = await getOrden(ordenId);
    expect(orden!.estado).toBe("cancelada");
  });

  it("no permite cancelar una orden cobrada", async () => {
    const { vendedor, cliente, item } = await setupVenta({ stock: 5 });
    await crearPlanCuentaVentas();
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    await registrarCobro(cobroInput(ordenId, 1000, "Efectivo"), vendedor);

    await expect(cambiarEstadoOrden(ordenId, "cancelada")).rejects.toThrow(
      /No se puede cancelar una orden cobrada/,
    );
  });
});

describe("facturarCajaMovimiento", () => {
  it("factura solo movimientos cobrados", async () => {
    const { vendedor, cliente, item } = await setupVenta({ stock: 5 });
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    const mov = await prisma.cajaMovimiento.findFirst({ where: { orden_id: ordenId } });

    await expect(facturarCajaMovimiento(mov!.id, "001-001-0000001")).rejects.toThrow(
      /Solo se pueden facturar movimientos cobrados/,
    );
  });

  it("cobra y factura: estado facturado y número de factura en orden y movimiento", async () => {
    const { vendedor, cliente, item } = await setupVenta({ stock: 5 });
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    const movId = await registrarCobro(cobroInput(ordenId, 1000, "Efectivo"), vendedor);

    await facturarCajaMovimiento(movId, "001-001-0000001");

    const mov = await prisma.cajaMovimiento.findUnique({ where: { id: movId } });
    expect(mov!.estado).toBe("facturado");
    expect(mov!.numero_factura).toBe("001-001-0000001");
    const orden = await getOrden(ordenId);
    expect(orden!.estado_caja).toBe("facturado");
    expect(orden!.numero_factura).toBe("001-001-0000001");
  });
});

describe("anularCajaMovimiento", () => {
  it("anula el movimiento cobrado y cancela su asiento contable", async () => {
    const { vendedor, cliente, item } = await setupVenta({ stock: 5 });
    await crearPlanCuentaVentas();
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    const movId = await registrarCobro(cobroInput(ordenId, 1000, "Efectivo"), vendedor);

    await anularCajaMovimiento(movId, "Cobro duplicado");

    const mov = await prisma.cajaMovimiento.findUnique({ where: { id: movId } });
    expect(mov!.estado).toBe("anulado");
    const asiento = await prisma.asientoContable.findFirst({
      where: { referencia_tipo: "caja", referencia_id: movId },
    });
    expect(asiento!.estado).toBe("cancelado");
    expect(asiento!.concepto).toContain("[ANULADO]");
  });

  it("no permite anular un movimiento facturado", async () => {
    const { vendedor, cliente, item } = await setupVenta({ stock: 5 });
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    const movId = await registrarCobro(cobroInput(ordenId, 1000, "Efectivo"), vendedor);
    await facturarCajaMovimiento(movId, "001-001-0000001");

    await expect(anularCajaMovimiento(movId, "Error")).rejects.toThrow(/facturado/);
  });
});

describe("eliminarOrden", () => {
  it("no altera stock, guarda snapshot en eliminaciones_ordenes y elimina la orden", async () => {
    const { vendedor, cliente, producto, deposito, item } = await setupVenta({ stock: 7 });
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    const orden = await getOrden(ordenId);

    const res = await eliminarOrden(ordenId, "Prueba de eliminación", vendedor);
    expect(res.numero_orden).toBe(orden!.numero_orden);

    expect(await prisma.orden.findUnique({ where: { id: ordenId } })).toBeNull();
    // La orden no descontó stock: el depósito queda intacto.
    const pd = await prisma.productoDeposito.findUnique({
      where: {
        producto_id_deposito_id: { producto_id: producto.id, deposito_id: deposito.id },
      },
    });
    expect(Number(pd!.stock)).toBe(7);

    const elim = await prisma.eliminacionOrden.findFirst({ where: { orden_id: ordenId } });
    expect(elim).not.toBeNull();
    expect(elim!.motivo).toBe("Prueba de eliminación");
    const snapshot = elim!.datos_orden as { numero_orden: string };
    expect(snapshot.numero_orden).toBe(orden!.numero_orden);
  });

  it("no permite eliminar una orden inexistente", async () => {
    await expect(
      eliminarOrden("00000000-0000-0000-0000-000000000000", "Motivo", {
        id: "00000000-0000-0000-0000-000000000000",
        nombre: "A",
        apellido: "B",
      }),
    ).rejects.toThrow(/Orden no encontrada/);
  });
});

describe("getProximoOrdenNumber", () => {
  it("devuelve la estimación sin consumir el número", async () => {
    expect(await getProximoOrdenNumber()).toMatch(new RegExp(`^VTA-${ANIO}-\\d{4}$`));
    expect(await getProximoNumero(prisma, "orden", ANIO)).toBe(1);
  });
});
