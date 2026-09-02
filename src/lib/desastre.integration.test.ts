// FASE 15 — Pruebas de desastre (doble submit, refresh, timeout, error post-commit).
// Suite de integración contra el esquema `test`: verifica que los locks y guards
// de estado resisten los escenarios catastróficos de operación.
// Uso: npm run test:integration
import { describe, it, expect, beforeEach } from "vitest";
import {
  crearOrden,
  registrarCobro,
  facturarCajaMovimiento,
  cambiarEstadoOrden,
  getOrden,
} from "@/lib/ventas/repository";
import { transicionEstadoOc, crearOrdenCompra } from "@/lib/compras/repository";
import { notificarYAcreditar } from "@/lib/sistema/hooks";
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

const UUID_INEXISTENTE = "00000000-0000-0000-0000-000000000000";

async function setupVenta({
  stock = 10,
  serial = "",
  precio = 1000,
  cantidad = 1,
}: {
  stock?: number;
  serial?: string;
  precio?: number;
  cantidad?: number;
} = {}) {
  const vendedor = await crearVendedor();
  const cliente = await crearCliente();
  const producto = await crearProducto({ precio_base: precio });
  const deposito = await crearDeposito();
  await setStock(producto.id, deposito.id, stock);
  await crearConfiguracion();
  if (serial) {
    await prisma.productoSerie.create({
      data: { producto_id: producto.id, serial, activo: true },
    });
  }
  const item = { producto_id: producto.id, cantidad, precio_unitario: precio, serial };
  return { vendedor, cliente, producto, deposito, item };
}

function ordenInput(cliente_id: string, items: Array<{ producto_id: string; cantidad: number; precio_unitario: number; serial: string }>) {
  return {
    cliente_id,
    items,
    observaciones: "",
    is_tax_included: false,
    sucursal: "",
    moneda: "GS" as const,
    tipo_venta: "tax_free" as const,
    metodo_pago: "",
  };
}

function cobroInput(orden_id: string, monto_pagado: number) {
  return { orden_id, monto_pagado, metodo_pago: "Efectivo", numero_factura: "" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Doble submit / doble click: dos peticiones concurrentes sobre la misma entidad.
// El lock (SELECT ... FOR UPDATE) + releída del estado debe dejar 1 sola operación.
// ─────────────────────────────────────────────────────────────────────────────

describe("doble submit concurrente", () => {
  it("dos cobros concurrentes sobre la misma orden: 1 éxito, 1 rechazo, sin duplicados", async () => {
    const { vendedor, cliente, item } = await setupVenta({ stock: 10, precio: 10000 });
    await crearPlanCuentaVentas();
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);

    const resultados = await Promise.allSettled([
      registrarCobro(cobroInput(ordenId, 10000), vendedor),
      registrarCobro(cobroInput(ordenId, 10000), vendedor),
    ]);

    const ok = resultados.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(1);
    const failed = resultados.filter((r) => r.status === "rejected");
    expect(failed).toHaveLength(1);

    expect(await prisma.pagoCliente.count({ where: { orden_id: ordenId } })).toBe(1);
    const asientos = await prisma.asientoContable.count({
      where: { referencia_tipo: "caja" },
    });
    expect(asientos).toBe(1);
    const orden = await getOrden(ordenId);
    expect(orden!.estado_caja).toBe("cobrado");
    const cxc = await prisma.cuentaCobrar.findUnique({ where: { orden_id: ordenId } });
    expect(cxc!.estado).toBe("pagado");
  });

  it("dos facturaciones concurrentes del mismo movimiento: 1 éxito, 1 rechazo", async () => {
    const { vendedor, cliente, item } = await setupVenta({ stock: 10, precio: 5000 });
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    const movId = await registrarCobro(cobroInput(ordenId, 5000), vendedor);

    const resultados = await Promise.allSettled([
      facturarCajaMovimiento(movId, "001-001-0000001"),
      facturarCajaMovimiento(movId, "001-001-0000001"),
    ]);

    const ok = resultados.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(1);
    const mov = await prisma.cajaMovimiento.findUnique({ where: { id: movId } });
    expect(mov!.estado).toBe("facturado");
    expect(
      await prisma.cajaMovimiento.count({ where: { estado: "facturado" } }),
    ).toBe(1);
  });

  it("dos cancelaciones concurrentes: efectos aplicados una sola vez", async () => {
    const { vendedor, cliente, producto, deposito, item } = await setupVenta({
      stock: 7,
    });
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);

    const resultados = await Promise.allSettled([
      cambiarEstadoOrden(ordenId, "cancelada"),
      cambiarEstadoOrden(ordenId, "cancelada"),
    ]);

    // Idempotencia: el perdedor de la carrera termina en no-op exitoso
    // (yaProcesada) o rechazado por serialización; nunca duplica efectos.
    const ok = resultados.filter((r) => r.status === "fulfilled");
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(
      resultados.some((r) => r.status === "rejected"),
    ).toBe(false);
    const orden = await prisma.orden.findUnique({ where: { id: ordenId } });
    expect(orden!.estado).toBe("cancelada");
    // La orden no descuenta stock: el depósito queda intacto y sin movimientos.
    const pd = await prisma.productoDeposito.findUnique({
      where: {
        producto_id_deposito_id: { producto_id: producto.id, deposito_id: deposito.id },
      },
    });
    expect(Number(pd!.stock)).toBe(7);
    expect(
      await prisma.movimientoInventario.count({ where: { tipo: "entrada" } }),
    ).toBe(0);
  });

  it("dos 'enviar' concurrentes sobre una OC: 1 sola CxP", async () => {
    const admin = await crearVendedor({ rol: "admin", vendedor_codigo: "A-ADM", email: "admin-site15@test.local" });
    await crearConfiguracion();
    const producto = await crearProducto({ purchase_cost: 10000, activo: true });
    const proveedor = await prisma.proveedor.create({
      data: {
        supplier: "Prov F15",
        tax: `RUC-${Date.now()}`,
        phone: "1",
        address: "T",
        document_type: "RUC",
        term: "NET",
        condition_description: "",
        tiene_acuerdo_comercial: false,
      },
    });
    const ocId = await crearOrdenCompra(
      {
        proveedor_id: proveedor.id,
        items: [{ producto_id: producto.id, cantidad: 3, unit_price: 10000 }],
        is_tax_included: false,
        remarks: "TEST F15",
        warehouse: "",
      },
      admin,
    );
    await transicionEstadoOc(ocId, "aprobar");

    const resultados = await Promise.allSettled([
      transicionEstadoOc(ocId, "enviar"),
      transicionEstadoOc(ocId, "enviar"),
    ]);

    const ok = resultados.filter((r) => r.status === "fulfilled");
    expect(ok.length).toBeGreaterThanOrEqual(1);
    // Invariante crítico: aunque ambos requests "enviar" concluyan (uno real,
    // otro idempotente), la CxP se crea exactamente una vez.
    expect(await prisma.cuentaPagar.count({ where: { orden_compra_id: ocId } })).toBe(1);
    const oc = await prisma.ordenesCompra.findUnique({ where: { id: ocId } });
    expect(oc!.estado).toBe("enviada");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Refresh / reintento post-commit: si el cliente reenvía tras un commit exitoso
// (refresh, retry automático, doble click ya resuelto), el guard debe rechazar
// sin efectos secundarios adicionales.
// ─────────────────────────────────────────────────────────────────────────────

describe("refresh / reintento post-commit", () => {
  it("reintentar el cobro tras un cobro exitoso: rechazado, sin doble pago", async () => {
    const { vendedor, cliente, item } = await setupVenta({ stock: 10, precio: 8000 });
    await crearPlanCuentaVentas();
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);

    const movId = await registrarCobro(cobroInput(ordenId, 8000), vendedor);

    await expect(registrarCobro(cobroInput(ordenId, 8000), vendedor)).rejects.toThrow();
    const mov = await prisma.cajaMovimiento.findUnique({ where: { id: movId } });
    expect(mov!.estado).toBe("cobrado");
    expect(await prisma.pagoCliente.count({ where: { orden_id: ordenId } })).toBe(1);
  });

  it("reintentar la facturación tras facturar: rechazado", async () => {
    const { vendedor, cliente, item } = await setupVenta({ stock: 10, precio: 3000 });
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    const movId = await registrarCobro(cobroInput(ordenId, 3000), vendedor);
    await facturarCajaMovimiento(movId, "001-001-0000009");

    await expect(facturarCajaMovimiento(movId, "001-001-0000010")).rejects.toThrow(
      /factura/,
    );
    const mov = await prisma.cajaMovimiento.findUnique({ where: { id: movId } });
    expect(mov!.numero_factura).toBe("001-001-0000009");
  });

  it("reintentar la cancelación tras cancelar: no-op idempotente, sin movimientos de stock", async () => {
    const { vendedor, cliente, producto, deposito, item } = await setupVenta({
      stock: 9,
    });
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);
    await cambiarEstadoOrden(ordenId, "cancelada");

    // Idempotencia: el reintento post-commit es un no-op exitoso que no
    // re-ejecuta efectos (no reintenta reactivaciones de serial, etc.).
    await expect(cambiarEstadoOrden(ordenId, "cancelada")).resolves.toBeUndefined();
    // La orden no descuenta ni restituye stock: depósito intacto, sin movimientos.
    const pd = await prisma.productoDeposito.findUnique({
      where: {
        producto_id_deposito_id: { producto_id: producto.id, deposito_id: deposito.id },
      },
    });
    expect(Number(pd!.stock)).toBe(9);
    expect(
      await prisma.movimientoInventario.count({ where: { tipo: "entrada" } }),
    ).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Timeout de transacción: si una transacción excede el timeout, debe abortar y
// revertir por completo (sin datos parciales) y dejar el pool utilizable.
// ─────────────────────────────────────────────────────────────────────────────

describe("timeout de transacción", () => {
  it("una transacción que supera el timeout revierte TODO (sin estado parcial)", async () => {
    const nombre = `TEST_TIMEOUT_${Date.now()}`;

    await expect(
      prisma.$transaction(
        async (tx) => {
          await tx.metodoPago.create({
            data: { nombre, porcentaje_costo: 1, activo: true },
          });
          // Sobrepasa el timeout: la transacción debe abortarse antes del commit.
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await tx.metodoPago.create({
            data: { nombre: `${nombre}_SEGUNDO`, porcentaje_costo: 1, activo: true },
          });
        },
        { timeout: 300, maxWait: 300 },
      ),
    ).rejects.toThrow();

    // Rollback completo: ni la primera fila persiste.
    expect(await prisma.metodoPago.count({ where: { nombre } })).toBe(0);
    expect(await prisma.metodoPago.count({ where: { nombre: `${nombre}_SEGUNDO` } })).toBe(0);

    // El pool sigue usable tras el aborto.
    const posterior = await crearMetodoPagoHelper();
    expect(posterior).toMatch(/^POST/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error post-commit (best-effort): notificarYAcreditar corre tras el commit;
// si la notificación/auditoría falla, NO debe romper ni revertir la operación
// ya commiteada. La operación principal queda persistida.
// ─────────────────────────────────────────────────────────────────────────────

describe("error post-commit (best-effort)", () => {
  it("una falla interna en notificarYAcreditar no revierte la operación commiteada", async () => {
    const { vendedor, cliente, item } = await setupVenta({ stock: 10, precio: 6000 });
    await crearPlanCuentaVentas();
    const ordenId = await crearOrden(ordenInput(cliente.id, [item]), vendedor);

    // La acción "típica": el repo commitea y después avisa/audita post-commit.
    const movId = await registrarCobro(cobroInput(ordenId, 6000), vendedor);

    // Best-effort: aunque registrarActividad falle (usuario FK inexistente), el
    // hook no propaga el error.
    await notificarYAcreditar({
      usuario_id: UUID_INEXISTENTE,
      usuario_nombre: "Test",
      accion: "cobrada",
      entidad: "caja_movimiento",
      entidad_id: movId,
      detalle: "",
      notificar: {
        roles: ["admin"],
        tipo: "cobro_registrado",
        titulo: "Cobro",
        mensaje: "",
        entidad: "caja_movimiento",
        entidad_id: movId,
      },
    });

    // El commit de la operación principal sigue en pie.
    const mov = await prisma.cajaMovimiento.findUnique({ where: { id: movId } });
    expect(mov!.estado).toBe("cobrado");
    const orden = await getOrden(ordenId);
    expect(orden!.estado_caja).toBe("cobrado");
    expect(await prisma.pagoCliente.count({ where: { orden_id: ordenId } })).toBe(1);
  });
});

async function crearMetodoPagoHelper(): Promise<string> {
  const m = await prisma.metodoPago.create({
    data: { nombre: `POST_${Date.now()}`, porcentaje_costo: 0, activo: true },
  });
  return m.nombre;
}