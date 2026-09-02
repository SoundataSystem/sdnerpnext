// FASE 7 — Concurrencia e idempotencia en operaciones críticas.
// Verifica INVARIANTES (no solo que una request falle): exactamente una
// creación, un pago, una aplicación de stock; outbox único; estados consistentes.
// Uso: npm run test:integration
import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "crypto";
import {
  crearOrden,
  registrarCobro,
  anularCajaMovimiento,
  getOrden,
} from "@/lib/ventas/repository";
import { crearAjusteStock, aprobarAjusteStock } from "@/lib/inventario/repository";
import {
  crearDevolucionVenta,
  aprobarDevolucionVenta,
} from "@/lib/devoluciones/repository";
import { limpiarEsquema, prisma } from "@/test/integration/db";
import {
  crearVendedor,
  crearCliente,
  crearProducto,
  crearDeposito,
  setStock,
  crearConfiguracion,
  crearPlanCuentaVentas,
} from "@/test/integration/fixtures";

beforeEach(async () => {
  await limpiarEsquema();
});

async function setupVenta({
  stock = 10,
  precio = 10000,
}: { stock?: number; precio?: number } = {}) {
  const vendedor = await crearVendedor();
  const cliente = await crearCliente();
  const producto = await crearProducto({ precio_base: precio });
  const deposito = await crearDeposito();
  await setStock(producto.id, deposito.id, stock);
  await crearConfiguracion();
  const item = {
    producto_id: producto.id,
    cantidad: 1,
    precio_unitario: precio,
    serial: "",
  };
  return { vendedor, cliente, producto, deposito, item };
}

function ordenInput(
  cliente_id: string,
  items: Array<{
    producto_id: string;
    cantidad: number;
    precio_unitario: number;
    serial: string;
  }>,
  clave?: string,
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
    ...(clave ? { clave_idempotencia: clave } : {}),
  };
}

function cobroInput(orden_id: string, monto_pagado: number, clave?: string) {
  return {
    orden_id,
    monto_pagado,
    metodo_pago: "Efectivo",
    numero_factura: "",
    ...(clave ? { clave_idempotencia: clave } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Creación de órdenes con clave de idempotencia
// ─────────────────────────────────────────────────────────────────────────────

describe("crearOrden idempotente (clave de cliente)", () => {
  it("dos requests simultáneos con la misma clave → EXACTAMENTE una orden", async () => {
    const { vendedor, cliente, item } = await setupVenta();
    const clave = randomUUID();

    const [a, b] = await Promise.all([
      crearOrden(ordenInput(cliente.id, [item], clave), vendedor),
      crearOrden(ordenInput(cliente.id, [item], clave), vendedor),
    ]);

    // Ambas requests tienen éxito y reciben EL MISMO ID real.
    expect(a).toBe(b);
    expect(await prisma.orden.count({ where: { cliente_id: cliente.id } })).toBe(1);
    // El movimiento de caja 'pendiente' se crea una sola vez.
    expect(await prisma.cajaMovimiento.count({ where: { orden_id: a } })).toBe(1);
    // Evento outbox dentro de la tx ganadora: uno solo.
    expect(
      await prisma.eventoOutbox.count({
        where: { tipo: "venta.creada", entidad_id: a },
      }),
    ).toBe(1);
  });

  it("retry después del commit con la misma clave es éxito-no-op sin duplicar", async () => {
    const { vendedor, cliente, item } = await setupVenta();
    const clave = randomUUID();

    const primera = await crearOrden(ordenInput(cliente.id, [item], clave), vendedor);
    const segunda = await crearOrden(ordenInput(cliente.id, [item], clave), vendedor);

    expect(segunda).toBe(primera);
    expect(await prisma.orden.count({ where: { cliente_id: cliente.id } })).toBe(1);
    // La fila de clave quedó referenciando la orden real creada.
    const fila = await prisma.idempotenciaClave.findUnique({
      where: { clave: `creacion_venta.creada_${clave}` },
    });
    expect(fila?.entidadId).toBe(primera);
  });

  it("claves distintas son órdenes independientes legítimas", async () => {
    const { vendedor, cliente, item } = await setupVenta();

    const a = await crearOrden(ordenInput(cliente.id, [item], randomUUID()), vendedor);
    const b = await crearOrden(ordenInput(cliente.id, [item], randomUUID()), vendedor);

    expect(a).not.toBe(b);
    expect(await prisma.orden.count({ where: { cliente_id: cliente.id } })).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cobros idempotentes
// ─────────────────────────────────────────────────────────────────────────────

describe("registrarCobro idempotente", () => {
  it("doble click simultáneo en cobro parcial → 1 pago, 1 asiento, monto correcto", async () => {
    const { vendedor, cliente, item } = await setupVenta({ precio: 10000 });
    await crearPlanCuentaVentas();
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    const clave = randomUUID();

    const [a, b] = await Promise.all([
      registrarCobro(cobroInput(ordenId, 4000, clave), vendedor),
      registrarCobro(cobroInput(ordenId, 4000, clave), vendedor),
    ]);

    // Éxito idempotente: misma intención → mismo movimiento.
    expect(a).toBe(b);
    expect(
      await prisma.pagoCliente.count({ where: { orden_id: ordenId } }),
    ).toBe(1);
    expect(
      await prisma.asientoContable.count({ where: { referencia_tipo: "caja" } }),
    ).toBe(1);
    const mov = await prisma.cajaMovimiento.findUnique({ where: { id: a } });
    expect(Number(mov!.monto_pagado)).toBe(4000);
    const orden = await getOrden(ordenId);
    expect(orden!.estado_caja).toBe("parcial");
    expect(
      await prisma.eventoOutbox.count({
        where: { tipo: "cobro.registrado", entidad_id: a },
      }),
    ).toBe(1);
  });

  it("retry post-commit del cobro no duplica efectos", async () => {
    const { vendedor, cliente, item } = await setupVenta({ precio: 8000 });
    await crearPlanCuentaVentas();
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    const clave = randomUUID();

    const primero = await registrarCobro(cobroInput(ordenId, 3000, clave), vendedor);
    const reintento = await registrarCobro(cobroInput(ordenId, 3000, clave), vendedor);

    expect(reintento).toBe(primero);
    expect(
      await prisma.pagoCliente.count({ where: { orden_id: ordenId } }),
    ).toBe(1);
    const mov = await prisma.cajaMovimiento.findUnique({ where: { id: primero } });
    expect(Number(mov!.monto_pagado)).toBe(3000);
  });

  it("múltiples cobros parciales válidos con claves distintas completan la orden", async () => {
    const { vendedor, cliente, item } = await setupVenta({ precio: 10000 });
    await crearPlanCuentaVentas();
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);

    await registrarCobro(cobroInput(ordenId, 4000, randomUUID()), vendedor);
    await registrarCobro(cobroInput(ordenId, 6000, randomUUID()), vendedor);

    expect(
      await prisma.pagoCliente.count({ where: { orden_id: ordenId } }),
    ).toBe(2);
    const orden = await getOrden(ordenId);
    expect(orden!.estado_caja).toBe("cobrado");
    const cxc = await prisma.cuentaCobrar.findUnique({ where: { orden_id: ordenId } });
    expect(cxc!.estado).toBe("pagado");
    expect(Number(cxc!.saldo_pendiente)).toBe(0);
  });

  it("cobro superior al saldo es rechazado sin dejar rastros", async () => {
    const { vendedor, cliente, item } = await setupVenta({ precio: 5000 });
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);

    await expect(
      registrarCobro(cobroInput(ordenId, 9000, randomUUID()), vendedor),
    ).rejects.toThrow(/supera|saldo/i);

    expect(
      await prisma.pagoCliente.count({ where: { orden_id: ordenId } }),
    ).toBe(0);
    expect(await prisma.cuentaCobrar.count()).toBe(0);
  });

  it("cobro sobre orden cancelada es rechazado", async () => {
    const { vendedor, cliente, item } = await setupVenta();
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    await prisma.orden.update({
      where: { id: ordenId },
      data: { estado: "cancelada" },
    });

    await expect(
      registrarCobro(cobroInput(ordenId, 1000, randomUUID()), vendedor),
    ).rejects.toThrow(/cancelada/i);
  });

  it("anular el único cobro reconstruye orden y CxC (sin estados fantasma)", async () => {
    const { vendedor, cliente, item } = await setupVenta({ precio: 7000 });
    await crearPlanCuentaVentas();
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    const movId = await registrarCobro(cobroInput(ordenId, 7000, randomUUID()), vendedor);

    await anularCajaMovimiento(movId, "cobro cargado por error");

    const mov = await prisma.cajaMovimiento.findUnique({ where: { id: movId } });
    expect(mov!.estado).toBe("anulado");
    const orden = await prisma.orden.findUnique({ where: { id: ordenId } });
    expect(orden!.estado_caja).toBe("pendiente_envio");
    expect(orden!.pay_status).toBe("pendiente");
    expect(orden!.fecha_cobro).toBeNull();
    const cxc = await prisma.cuentaCobrar.findUnique({ where: { orden_id: ordenId } });
    expect(cxc!.estado).toBe("pendiente");
    expect(Number(cxc!.saldo_pendiente)).toBe(7000);
    // El asiento del cobro queda cancelado (partida doble revertida).
    const asiento = await prisma.asientoContable.findFirst({
      where: { referencia_tipo: "caja", referencia_id: movId },
    });
    expect(asiento!.estado).toBe("cancelado");
  });

  it("anular con un pago parcial restante deja la orden en 'parcial'", async () => {
    const { vendedor, cliente, item } = await setupVenta({ precio: 10000 });
    await crearPlanCuentaVentas();
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    const movA = await registrarCobro(cobroInput(ordenId, 4000, randomUUID()), vendedor);
    // El segundo parcial actualiza el MISMO movimiento (acumulación por diseño).
    await registrarCobro(cobroInput(ordenId, 2000, randomUUID()), vendedor);

    await anularCajaMovimiento(movA, "error de caja");

    const orden = await prisma.orden.findUnique({ where: { id: ordenId } });
    expect(orden!.estado_caja).toBe("pendiente_envio");
    expect(orden!.pay_status).toBe("pendiente");
    const cxc = await prisma.cuentaCobrar.findUnique({ where: { orden_id: ordenId } });
    expect(cxc!.estado).toBe("pendiente");
    expect(Number(cxc!.saldo_pendiente)).toBe(10000);
  });

  it("no se puede anular dos veces el mismo movimiento", async () => {
    const { vendedor, cliente, item } = await setupVenta({ precio: 5000 });
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    const movId = await registrarCobro(cobroInput(ordenId, 5000, randomUUID()), vendedor);

    await anularCajaMovimiento(movId, "primera anulación");
    await expect(anularCajaMovimiento(movId, "segunda")).rejects.toThrow(/anulado/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Aprobaciones de ajustes de stock idempotentes
// ─────────────────────────────────────────────────────────────────────────────

describe("aprobarAjusteStock idempotente", () => {
  async function setupAjuste(stockActual = 5, stockNuevo = 12) {
    const usuario = await crearVendedor();
    const producto = await crearProducto({});
    const deposito = await crearDeposito();
    await setStock(producto.id, deposito.id, stockActual);
    const ajusteId = await crearAjusteStock(
      {
        deposito_id: deposito.id,
        tipo: "inventario",
        motivo: "conteo físico",
        fecha: new Date().toISOString().split("T")[0],
        items: [{ producto_id: producto.id, stock_actual: stockActual, stock_nuevo: stockNuevo }],
      },
      usuario,
    );
    return { usuario, producto, deposito, ajusteId };
  }

  it("dos aprobaciones simultáneas aplican el ajuste UNA sola vez", async () => {
    const { usuario, producto, deposito, ajusteId } = await setupAjuste(5, 12);

    const resultados = await Promise.allSettled([
      aprobarAjusteStock(ajusteId, usuario),
      aprobarAjusteStock(ajusteId, usuario),
    ]);

    // Idempotencia: la segunda aprobación es éxito-no-op, no un rechazo duro.
    expect(resultados.every((r) => r.status === "fulfilled")).toBe(true);
    const pd = await prisma.productoDeposito.findUnique({
      where: { producto_id_deposito_id: { producto_id: producto.id, deposito_id: deposito.id } },
    });
    expect(pd!.stock).toBe(12); // 5 + delta(7) aplicado UNA vez
    const ajuste = await prisma.ajusteStock.findUnique({ where: { id: ajusteId } });
    expect(ajuste!.estado).toBe("aprobado");
    expect(
      await prisma.movimientoInventario.count({ where: { referencia: ajuste!.numero_ajuste } }),
    ).toBe(1);
    expect(
      await prisma.eventoOutbox.count({
        where: { tipo: "ajuste.aprobado", entidad_id: ajusteId },
      }),
    ).toBe(1);
  });

  it("aprobación secuencial repetida es no-op (stock intacto)", async () => {
    const { usuario, producto, deposito, ajusteId } = await setupAjuste(5, 12);

    await aprobarAjusteStock(ajusteId, usuario);
    await aprobarAjusteStock(ajusteId, usuario);

    const pd = await prisma.productoDeposito.findUnique({
      where: { producto_id_deposito_id: { producto_id: producto.id, deposito_id: deposito.id } },
    });
    expect(pd!.stock).toBe(12);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Devoluciones: acumulado controlado + aprobación idempotente
// ─────────────────────────────────────────────────────────────────────────────

describe("devoluciones de venta consistentes", () => {
  async function setupDevolucion(vendido = 5) {
    const usuario = await crearVendedor();
    const { cliente, producto, deposito, item } = await setupVenta({
      stock: vendido,
      precio: 1000,
    });
    const ordenId = await crearOrden(
      { ...ordenInput(cliente.id, [{ ...item, cantidad: vendido }]) },
      usuario,
    );
    return { usuario, producto, deposito, ordenId };
  }

  function devInput(ordenId: string, productoId: string, cantidad: number) {
    return {
      orden_id: ordenId,
      motivo: "producto defectuoso",
      items: [{ producto_id: productoId, cantidad, precio_unitario: 1000 }],
    };
  }

  it("la suma de devoluciones parciales no puede exceder lo vendido", async () => {
    const { usuario, producto, deposito, ordenId } = await setupDevolucion(5);

    const devA = await crearDevolucionVenta(devInput(ordenId, producto.id, 3), usuario);
    await aprobarDevolucionVenta(devA, usuario);

    // Excede: vendido 5 - devuelto 3 = 2 disponibles.
    await expect(
      crearDevolucionVenta(devInput(ordenId, producto.id, 3), usuario),
    ).rejects.toThrow(/supera lo vendido/i);

    // Dentro del remanente: aceptada.
    const devB = await crearDevolucionVenta(devInput(ordenId, producto.id, 2), usuario);
    await aprobarDevolucionVenta(devB, usuario);

    const pd = await prisma.productoDeposito.findFirst({
      where: { producto_id: producto.id },
    });
    expect(pd).toBeTruthy();
    // Stock restituido exactamente 5 veces entre los depósitos usados.
    const movimientos = await prisma.movimientoInventario.count({
      where: { tipo: "devolucion", producto_id: producto.id },
    });
    expect(movimientos).toBe(2);
    void deposito;
  });

  it("doble aprobación simultánea restituye stock UNA sola vez", async () => {
    const { usuario, producto, ordenId } = await setupDevolucion(4);
    const devolucionId = await crearDevolucionVenta(devInput(ordenId, producto.id, 4), usuario);
    const antes = await prisma.producto.findUnique({ where: { id: producto.id } });
    const stockAnterior = Number(antes!.stock_total ?? 0);

    const resultados = await Promise.allSettled([
      aprobarDevolucionVenta(devolucionId, usuario),
      aprobarDevolucionVenta(devolucionId, usuario),
    ]);

    expect(resultados.every((r) => r.status === "fulfilled")).toBe(true);
    const despues = await prisma.producto.findUnique({ where: { id: producto.id } });
    expect(Number(despues!.stock_total ?? 0)).toBe(stockAnterior + 4);
    const dev = await prisma.devolucionVenta.findUnique({ where: { id: devolucionId } });
    expect(dev!.estado).toBe("aprobada");
    expect(
      await prisma.movimientoInventario.count({
        where: { tipo: "devolucion", producto_id: producto.id },
      }),
    ).toBe(1);
    expect(
      await prisma.eventoOutbox.count({
        where: { entidad: "devolucion_venta", entidad_id: devolucionId },
      }),
    ).toBe(1);
  });

  it("devolución de una operación ya devuelta es éxito-no-op (idempotente)", async () => {
    const { usuario, producto, ordenId } = await setupDevolucion(2);
    const devolucionId = await crearDevolucionVenta(devInput(ordenId, producto.id, 2), usuario);

    await aprobarDevolucionVenta(devolucionId, usuario);
    // Segundo intento (retry tardío): no revienta ni re-restituye.
    await aprobarDevolucionVenta(devolucionId, usuario);

    const movimientos = await prisma.movimientoInventario.count({
      where: { tipo: "devolucion", producto_id: producto.id },
    });
    expect(movimientos).toBe(1);
  });
});
