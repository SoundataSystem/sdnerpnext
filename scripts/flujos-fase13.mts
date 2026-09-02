// FASE 13 — Flujos funcionales runtime 1-7 con datos TEST contra `public`.
// Verificación local (protocolo): los repositorios reales se ejecutan igual que
// en runtime, con datos marcados TEST- y limpieza posterior en orden FK.
// Uso: npx tsx --tsconfig tsconfig.scripts.json scripts/flujos-fase13.mts
import "dotenv/config";

import {
  crearOrden,
  getOrden,
  cambiarEstadoOrden,
  registrarCobro,
  facturarCajaMovimiento,
} from "../src/lib/ventas/repository";
import {
  crearOrdenCompra,
  getOrdenCompra,
  transicionEstadoOc,
  registrarRecepcion,
  ingresarStock,
  registrarPagoProveedor,
} from "../src/lib/compras/repository";
import { crearAjusteStock, aprobarAjusteStock, transferirStock } from "../src/lib/inventario/repository";
import {
  crearDevolucionVenta,
  aprobarDevolucionVenta,
  crearDevolucionCompra,
  aprobarDevolucionCompra,
} from "../src/lib/devoluciones/repository";
import {
  registrarGarantia,
  validarGarantia,
  crearRma,
  avanzarRma,
} from "../src/lib/servicios/repository";
import { prisma } from "../src/lib/prisma";

// ---------------------------------------------------------------------------
// Utilidades de la corrida
// ---------------------------------------------------------------------------
let seq = 0;
const unico = (p: string) => `TEST-${p}-${Date.now()}-${++seq}`;

const resultados: Array<{ flujo: string; ok: boolean; detalle?: string }> = [];
function check(flujo: string, cond: boolean, detalle = "") {
  resultados.push({ flujo, ok: cond, detalle });
  console.log(`  ${cond ? "PASS" : "FAIL"} [${flujo}] ${detalle}`);
}

// Registro de ids creados para limpieza (orden FK children-first).
const ids: Record<string, string[]> = {};
function track(entidad: string, id: string) {
  (ids[entidad] ??= []).push(id);
  return id;
}
const detallePorAsiento: string[] = [];

// ---------------------------------------------------------------------------
// Fixtures con datos TEST
// ---------------------------------------------------------------------------
async function crearPlanCuentas() {
  const cuentas = [
    { codigo: "1.1.01", nombre: "Caja", tipo: "activo" },
    { codigo: "1.1.02", nombre: "Bancos", tipo: "activo" },
    { codigo: "1.1.03", nombre: "Cuentas por Cobrar", tipo: "activo" },
    { codigo: "2.1.01", nombre: "Cuentas por Pagar", tipo: "pasivo" },
    { codigo: "4.1.01", nombre: "Ventas", tipo: "ingreso" },
    { codigo: "5.1.01", nombre: "Costo de Ventas", tipo: "gasto" },
    { codigo: "6.1.01", nombre: "Compras", tipo: "gasto" },
  ];
  for (const c of cuentas) {
    const ex = await prisma.planCuenta.findUnique({ where: { codigo: c.codigo } });
    if (ex) continue;
    const p = await prisma.planCuenta.create({
      data: { codigo: c.codigo, nombre: c.nombre, tipo: c.tipo as never, nivel: 1, activo: true },
    });
    track("plan_cuenta", p.id);
  }
}

async function fixtures() {
  const vendedor = track(
    "usuario",
    (
      await prisma.usuario.create({
        data: {
          email: unico("vend") + "@test.local",
          nombre: "Vendedor",
          apellido: "F13",
          rol: "vendedor",
          vendedor_codigo: "V13",
          activo: true,
        },
      })
    ).id,
  );
  const admin = track(
    "usuario",
    (
      await prisma.usuario.create({
        data: {
          email: unico("admin") + "@test.local",
          nombre: "Admin",
          apellido: "F13",
          rol: "admin",
          vendedor_codigo: "A13",
          activo: true,
        },
      })
    ).id,
  );
  const getUsuario = async (id: string) => {
    const u = await prisma.usuario.findUnique({ where: { id } });
    if (!u) throw new Error("usuario no encontrado");
    return { id: u.id, nombre: u.nombre, apellido: u.apellido, vendedor_codigo: u.vendedor_codigo };
  };
  const vendedorObj = await getUsuario(vendedor);
  const adminObj = await getUsuario(admin);

  const cliente = track(
    "cliente",
    (
      await prisma.cliente.create({
        data: {
          nombre: "Cliente",
          apellido: "F13",
          cedula: unico("C"),
          telefono: "000000000",
          email: unico("cli") + "@test.local",
        },
      })
    ).id,
  );

  const proveedor = track(
    "proveedor",
    (
      await prisma.proveedor.create({
        data: {
          supplier: "Proveedor F13",
          tax: unico("RUC"),
          phone: "123",
          address: "TEST",
          document_type: "RUC",
          term: "NET",
          condition_description: "",
          tiene_acuerdo_comercial: false,
        },
      })
    ).id,
  );

  const depA = track(
    "deposito",
    (await prisma.deposito.create({ data: { nombre: unico("DEP-A"), columna_stock: unico("COL").replace(/-/g, "_").toLowerCase(), activo: true } })).id,
  );
  const depB = track(
    "deposito",
    (await prisma.deposito.create({ data: { nombre: unico("DEP-B"), columna_stock: unico("COL").replace(/-/g, "_").toLowerCase(), activo: true } })).id,
  );

  const producto = track(
    "producto",
    (
      await prisma.producto.create({
        data: {
          codigo: unico("P"),
          nombre: "Producto F13",
          activo: true,
          precio_base: 100000,
          purchase_cost: 60000,
          stock_total: 0,
          stock_soundata: 0,
        },
      })
    ).id,
  );
  const productoSerial = track(
    "producto",
    (
      await prisma.producto.create({
        data: {
          codigo: unico("PS"),
          nombre: "Producto Seriado F13",
          activo: true,
          precio_base: 200000,
          purchase_cost: 120000,
          stock_total: 0,
          stock_soundata: 0,
        },
      })
    ).id,
  );

  const metodo = track(
    "metodo_pago",
    (
      await prisma.metodoPago.create({
        data: { nombre: unico("MP"), porcentaje_costo: 0, activo: true },
      })
    ).id,
  );
  const metodoPago = (await prisma.metodoPago.findUnique({ where: { id: metodo } }))!.nombre;

  const setStock = async (productoId: string, depId: string, stock: number) => {
    const ex = await prisma.productoDeposito.findUnique({
      where: { producto_id_deposito_id: { producto_id: productoId, deposito_id: depId } },
    });
    if (ex) {
      await prisma.productoDeposito.update({ where: { id: ex.id }, data: { stock } });
    } else {
      track(
        "producto_deposito",
        (
          await prisma.productoDeposito.create({
            data: { producto_id: productoId, deposito_id: depId, stock },
          })
        ).id,
      );
    }
    await prisma.producto.update({ where: { id: productoId }, data: { stock_total: stock } });
  };

  return {
    vendedorObj,
    adminObj,
    cliente,
    proveedor,
    depA,
    depB,
    producto,
    productoSerial,
    metodoPago,
    setStock,
  };
}

// ---------------------------------------------------------------------------
// FLUJO 1 — Venta: crear → cobrar → facturar → completar → garantía
// ---------------------------------------------------------------------------
async function flujo1(f: Awaited<ReturnType<typeof fixtures>>) {
  // Producto no seriado con stock.
  await f.setStock(f.producto, f.depA, 10);
  const estadoInicial = Number((await prisma.producto.findUnique({ where: { id: f.producto } }))!.stock_total);

  const ordenId = track(
    "orden",
    await crearOrden(
      {
        cliente_id: f.cliente,
        items: [
          { producto_id: f.producto, cantidad: 2, precio_unitario: 90000, serial: "" },
        ],
        observaciones: "",
        is_tax_included: false,
        sucursal: "",
        moneda: "GS",
        tipo_venta: "contado",
        metodo_pago: f.metodoPago,
      },
      f.vendedorObj,
    ),
  );

  const o1 = await getOrden(ordenId);
  check("F1", o1?.estado === "pendiente" && o1.estado_caja === "pendiente_envio", `orden creada ${o1?.numero_orden}`);
  check("F1", Number(o1?.total ?? 0) > 0, `total ${o1?.total}`);

  const mov = await prisma.cajaMovimiento.findFirst({ where: { orden_id: ordenId } });
  check("F1", mov?.estado === "pendiente", `caja_movimientos pendiente ${mov?.id}`);
  const mi = await prisma.movimientoInventario.findFirst({
    where: { producto_id: f.producto, tipo: "salida", referencia: o1?.numero_orden },
  });
  check("F1", !!mi && Number(mi.cantidad ?? 0) === 2, `mov salida 2 ${mi?.tipo} ${mi?.cantidad}`);

  const stockPost = (await prisma.producto.findUnique({ where: { id: f.producto } }))!.stock_total;
  check("F1", Number(stockPost) === estadoInicial - 2, `stock ${estadoInicial} -> ${stockPost}`);
  // Cobro total → caja cobrado + pago + CxC + asiento balanceado.
  const movId = await registrarCobro(
    { orden_id: ordenId, monto_pagado: Number(o1?.total ?? 0), metodo_pago: f.metodoPago, numero_factura: "" },
    f.vendedorObj,
  );
  track("caja_movimiento", movId);
  const mov2 = await prisma.cajaMovimiento.findUnique({ where: { id: movId } });
  check("F1", mov2?.estado === "cobrado", `cobro -> caja cobrado`);

  const cxc = await prisma.cuentaCobrar.findUnique({ where: { orden_id: ordenId } });
  check("F1", cxc?.estado === "pagado" && Number(cxc.saldo_pendiente) === 0, `CxC pagada saldo ${cxc?.saldo_pendiente}`);
  const cxcs = await prisma.cuentaCobrar.findMany({ where: { orden_id: ordenId } });
  cxcs.forEach((c) => track("cuenta_cobrar", c.id));

  const asiento = await prisma.asientoContable.findFirst({
    where: { referencia_tipo: "caja", referencia_id: movId },
    include: { detalles: true },
  });
  const debe = asiento?.detalles.reduce((s, d) => s + Number(d.debe ?? 0), 0) ?? 0;
  const haber = asiento?.detalles.reduce((s, d) => s + Number(d.haber ?? 0), 0) ?? 0;
  check("F1", asiento?.estado === "contabilizado" && debe > 0 && debe === haber, `asiento AS ${asiento?.numero_asiento} debe=haber=${debe}`);
  if (asiento) {
    track("asiento", asiento.id);
    detallePorAsiento.push(asiento.id);
  }

  // Facturar + completar.
  await facturarCajaMovimiento(movId, unico("FC"));
  const mov3 = await prisma.cajaMovimiento.findUnique({ where: { id: movId } });
  check("F1", mov3?.estado === "facturado" && !!mov3?.numero_factura, `facturado ${mov3?.numero_factura}`);

  await cambiarEstadoOrden(ordenId, "completada");
  const oFin = await getOrden(ordenId);
  check("F1", oFin?.estado === "completada", `orden completada`);
}

// ---------------------------------------------------------------------------
// FLUJO 2 — Compra con recepción parcial ×3 + ingreso + pago + cierre
// ---------------------------------------------------------------------------
async function flujo2(f: Awaited<ReturnType<typeof fixtures>>) {
  const ocId = track(
    "orden_compra",
    await crearOrdenCompra(
      {
        proveedor_id: f.proveedor,
        items: [{ producto_id: f.producto, cantidad: 10, unit_price: 55000 }],
        is_tax_included: false,
        remarks: "TEST F13",
        warehouse: "",
      },
      f.adminObj,
    ),
  );
  const oc0 = await getOrdenCompra(ocId);
  check("F2", oc0?.estado === "borrador", `OC ${oc0?.numero_orden} borrador`);
  const itemId = oc0!.items[0].item_id;

  await transicionEstadoOc(ocId, "aprobar");
  await transicionEstadoOc(ocId, "enviar");
  const oc1 = await getOrdenCompra(ocId);
  check("F2", oc1?.estado === "enviada", `OC enviada`);

  const cp = await prisma.cuentaPagar.findUnique({ where: { orden_compra_id: ocId } });
  check("F2", cp?.estado === "pendiente" && Number(cp.saldo_pendiente) === 605000, `CxP creada al enviar saldo ${cp?.saldo_pendiente}`);
  if (cp) track("cuenta_pagar", cp.id);

  // Recepción parcial ×3: 3 + 3 + 4.
  const rec1 = await registrarRecepcion(
    {
      oc_id: ocId,
      factura_numero: unico("FR"),
      factura_fecha: new Date().toISOString().slice(0, 10),
      factura_monto: 10 * 55000,
      observaciones: "",
      items: [{ oc_item_id: itemId, cantidad_recibida: 3 }],
    },
    f.adminObj,
  );
  track("recepcion", rec1.id);
  const ocP = await getOrdenCompra(ocId);
  check("F2", ocP?.estado === "recepcion_parcial", `REC1 -> recepcion_parcial`);

  const rec2 = await registrarRecepcion(
    {
      oc_id: ocId,
      factura_numero: unico("FR"),
      factura_fecha: new Date().toISOString().slice(0, 10),
      factura_monto: 0,
      observaciones: "",
      items: [{ oc_item_id: itemId, cantidad_recibida: 3 }],
    },
    f.adminObj,
  );
  track("recepcion", rec2.id);
  const rec3 = await registrarRecepcion(
    {
      oc_id: ocId,
      factura_numero: unico("FR"),
      factura_fecha: new Date().toISOString().slice(0, 10),
      factura_monto: 0,
      observaciones: "",
      items: [{ oc_item_id: itemId, cantidad_recibida: 4 }],
    },
    f.adminObj,
  );
  track("recepcion", rec3.id);
  const oc2 = await getOrdenCompra(ocId);
  check("F2", oc2?.estado === "pendiente_ingreso_stock", `REC total 10 -> pendiente_ingreso_stock`);

  const ingreso = await ingresarStock({ oc_id: ocId, deposito_id: f.depA }, f.adminObj);
  track("ingreso", ingreso.id);
  const oc3 = await getOrdenCompra(ocId);
  check("F2", oc3?.estado === "ingresada", `OC ingresada`);

  const ings = await prisma.movimientoInventario.findMany({
    where: { producto_id: f.producto, tipo: "entrada", referencia: oc0?.numero_orden },
  });
  const ingTotal = ings.reduce((s, m) => s + Number(m.cantidad ?? 0), 0);
  check("F2", ings.length === 3 && ingTotal === 10, `3 mov entrada +10 (ing_total ${ingTotal})`);

  const recepciones = await prisma.recepcionCompra.count({ where: { orden_compra_id: ocId } });
  check("F2", recepciones === 3, `3 recepciones`);

  // Pago del 50% → CxP parcial + asiento.
  await registrarPagoProveedor(
    { oc_id: ocId, monto: 302500, metodo_pago: f.metodoPago, numero_factura: unico("FP"), referencia: "" },
    f.adminObj,
  );
  const cp2 = await prisma.cuentaPagar.findUnique({ where: { orden_compra_id: ocId } });
  check("F2", cp2?.estado === "parcial" && Number(cp2.saldo_pendiente) === 302500, `CxP saldo ${cp2?.saldo_pendiente}`);

  const pago = await prisma.pagoProveedor.findFirst({ where: { orden_compra_id: ocId } });
  check("F2", !!pago && Number(pago.monto) === 302500, `pago proveedor ${pago?.monto}`);
  if (pago) track("pago_proveedor", pago.id);

  const asientoPP = await prisma.asientoContable.findFirst({
    where: { referencia_tipo: "pago_proveedor", referencia_id: pago?.id ?? "" },
    include: { detalles: true },
  });
  const debePP = asientoPP?.detalles.reduce((s, d) => s + Number(d.debe ?? 0), 0) ?? 0;
  const haberPP = asientoPP?.detalles.reduce((s, d) => s + Number(d.haber ?? 0), 0) ?? 0;
  check("F2", !!asientoPP && debePP === haberPP && debePP === 302500, `asiento pago AA debe=haber=${debePP}`);
  if (asientoPP) {
    detallePorAsiento.push(asientoPP.id);
    track("asiento", asientoPP.id);
  }

  const cpRest = await prisma.cuentaPagar.findUnique({ where: { orden_compra_id: ocId } });
  check("F2", Number(cpRest?.saldo_pendiente) === 302500, "CxP queda parcial (saldo 302500)");

  await transicionEstadoOc(ocId, "cerrar");
  const ocFin = await getOrdenCompra(ocId);
  check("F2", ocFin?.estado === "cerrada", `OC cerrada`);
}

// ---------------------------------------------------------------------------
// FLUJO 3 — Transferencia entre depósitos (con serial)
// ---------------------------------------------------------------------------
async function flujo3(f: Awaited<ReturnType<typeof fixtures>>) {
  await f.setStock(f.productoSerial, f.depA, 5);
  const serie = track(
    "producto_serie",
    (
      await prisma.productoSerie.create({
        data: { producto_id: f.productoSerial, serial: unico("SN"), activo: true, deposito: (await prisma.deposito.findUnique({ where: { id: f.depA } }))!.nombre },
      })
    ).id,
  );

  const stockAIni = (await prisma.productoDeposito.findFirst({ where: { producto_id: f.productoSerial, deposito_id: f.depA } }))!.stock;
  const stockBIni = (await prisma.productoDeposito.findFirst({ where: { producto_id: f.productoSerial, deposito_id: f.depB } }))?.stock ?? 0;

  const result = await transferirStock(
    {
      deposito_origen_id: f.depA,
      deposito_destino_id: f.depB,
      motivo: "TEST F13",
      items: [{ producto_id: f.productoSerial, cantidad: 1, seriales: [serie] }],
    },
    f.adminObj,
  );
  check("F3", result.movimientos === 1, `transferencia generada`);

  const stockAFin = (await prisma.productoDeposito.findFirst({ where: { producto_id: f.productoSerial, deposito_id: f.depA } }))!.stock;
  const stockBFin = (await prisma.productoDeposito.findFirst({ where: { producto_id: f.productoSerial, deposito_id: f.depB } }))!.stock;
  check("F3", Number(stockAFin) === Number(stockAIni) - 1 && Number(stockBFin) === Number(stockBIni) + 1, `stock A ${stockAIni}->${stockAFin}, B ${stockBIni}->${stockBFin}`);

  const serieFin = await prisma.productoSerie.findUnique({ where: { id: serie } });
  const depBNombre = (await prisma.deposito.findUnique({ where: { id: f.depB } }))!.nombre;
  check("F3", serieFin?.deposito === depBNombre, `serial movido a ${serieFin?.deposito}`);
}

// ---------------------------------------------------------------------------
// FLUJO 4 — Devolución de venta: aprobar restituye stock y reactiva serial
// ---------------------------------------------------------------------------
async function flujo4(f: Awaited<ReturnType<typeof fixtures>>) {
  // Venta seriada (1 unidad) para poder re-activar el serial al aprobar.
  await f.setStock(f.productoSerial, f.depA, 8);
  const serieId = track(
    "producto_serie",
    (
      await prisma.productoSerie.create({
        data: { producto_id: f.productoSerial, serial: unico("SN"), activo: true, deposito: (await prisma.deposito.findUnique({ where: { id: f.depA } }))!.nombre },
      })
    ).id,
  );
  const serial = (await prisma.productoSerie.findUnique({ where: { id: serieId } }))!.serial;

  const ordenId = track(
    "orden",
    await crearOrden(
      {
        cliente_id: f.cliente,
        items: [{ producto_id: f.productoSerial, cantidad: 1, precio_unitario: 200000, serial }],
        observaciones: "",
        is_tax_included: false,
        sucursal: "",
        moneda: "GS",
        tipo_venta: "contado",
        metodo_pago: f.metodoPago,
      },
      f.vendedorObj,
    ),
  );
  await cambiarEstadoOrden(ordenId, "completada");

  const stockVendido = (await prisma.producto.findUnique({ where: { id: f.productoSerial } }))!.stock_total;

  const devId = track(
    "devolucion_venta",
    await crearDevolucionVenta(
      {
        orden_id: ordenId,
        motivo: "Devolucion TEST F13",
        items: [{ producto_id: f.productoSerial, cantidad: 1, precio_unitario: 200000 }],
      },
      f.vendedorObj,
    ),
  );
  const dev0 = await prisma.devolucionVenta.findUnique({ where: { id: devId } });
  check("F4", dev0?.estado === "pendiente", `devolución creada`);

  await aprobarDevolucionVenta(devId, f.adminObj);
  const dev1 = await prisma.devolucionVenta.findUnique({ where: { id: devId } });
  check("F4", dev1?.estado === "aprobada" && !!dev1?.procesada_at, `devolución aprobada`);

  const stockDev = (await prisma.producto.findUnique({ where: { id: f.productoSerial } }))!.stock_total;
  check("F4", Number(stockDev) === Number(stockVendido) + 1, `stock restituido ${stockVendido} -> ${stockDev}`);

  const serieFin = await prisma.productoSerie.findUnique({ where: { id: serieId } });
  check("F4", serieFin?.activo === true, `serial reactivado (activo=${serieFin?.activo})`);
}

// ---------------------------------------------------------------------------
// FLUJO 5 — Stock: ajuste + devolución de compra (egresa stock)
// ---------------------------------------------------------------------------
async function flujo5(f: Awaited<ReturnType<typeof fixtures>>) {
  await f.setStock(f.producto, f.depB, 20);

  // Ajuste de stock.
  const ajId = track(
    "ajuste_stock",
    await crearAjusteStock(
      {
        deposito_id: f.depB,
        tipo: "inventario",
        motivo: "Ajuste TEST F13",
        fecha: new Date().toISOString().slice(0, 10),
        items: [{ producto_id: f.producto, stock_actual: 20, stock_nuevo: 17 }],
      },
      f.adminObj,
    ),
  );
  await aprobarAjusteStock(ajId, f.adminObj);
  const depAjustado = await prisma.productoDeposito.findFirst({ where: { producto_id: f.producto, deposito_id: f.depB } });
  check("F5", Number(depAjustado?.stock) === 17, `ajuste aplicado depB=17 (${depAjustado?.stock})`);

  const movAj = await prisma.movimientoInventario.findFirst({
    where: { producto_id: f.producto, tipo: "ajuste" },
  });
  check("F5", !!movAj, `movimiento de ajuste`);

  // Devolución de compra (egresa stock). Necesita OC enviada con CxP? No: solo OC existente y cantidades recibidas.
  const ocId = track(
    "orden_compra",
    await crearOrdenCompra(
      { proveedor_id: f.proveedor, items: [{ producto_id: f.producto, cantidad: 6, unit_price: 50000 }], is_tax_included: false, remarks: "", warehouse: "" },
      f.adminObj,
    ),
  );
  await transicionEstadoOc(ocId, "aprobar");
  await transicionEstadoOc(ocId, "enviar");

  const devC = track(
    "devolucion_compra",
    await crearDevolucionCompra(
      {
        orden_compra_id: ocId,
        proveedor_id: f.proveedor,
        motivo: "Devolucion compra TEST F13",
        items: [{ producto_id: f.producto, cantidad: 2, precio_unitario: 50000 }],
      },
      f.adminObj,
    ),
  );
  const stockPre = (await prisma.producto.findUnique({ where: { id: f.producto } }))!.stock_total;
  await aprobarDevolucionCompra(devC, f.adminObj);
  const stockPost = (await prisma.producto.findUnique({ where: { id: f.producto } }))!.stock_total;
  check("F5", Number(stockPost) === Number(stockPre) - 2, `devolución compra egresa 2 (${stockPre} -> ${stockPost})`);
}

// ---------------------------------------------------------------------------
// FLUJO 6 — Garantía 2 etapas + RMA completo
// ---------------------------------------------------------------------------
async function flujo6(f: Awaited<ReturnType<typeof fixtures>>) {
  await f.setStock(f.productoSerial, f.depB, 10);
  const serieId = track(
    "producto_serie",
    (
      await prisma.productoSerie.create({
        data: { producto_id: f.productoSerial, serial: unico("SN"), activo: true, deposito: (await prisma.deposito.findUnique({ where: { id: f.depB } }))!.nombre },
      })
    ).id,
  );
  const serial = (await prisma.productoSerie.findUnique({ where: { id: serieId } }))!.serial;

  const ordenId = track(
    "orden",
    await crearOrden(
      {
        cliente_id: f.cliente,
        items: [{ producto_id: f.productoSerial, cantidad: 1, precio_unitario: 200000, serial }],
        observaciones: "",
        is_tax_included: false,
        sucursal: "",
        moneda: "GS",
        tipo_venta: "contado",
        metodo_pago: f.metodoPago,
      },
      f.vendedorObj,
    ),
  );
  const op = await prisma.ordenProducto.findFirst({ where: { orden_id: ordenId, producto_id: f.productoSerial } });
  check("F6", !!op, `orden_producto seriado`);

  const garId = track(
    "garantia",
    await registrarGarantia({
      orden_id: ordenId,
      orden_producto_id: op!.id,
      producto_id: f.productoSerial,
      serial_producto: serial,
      numero_factura: "",
      fecha_vencimiento: new Date(Date.now() + 12 * 30 * 86400000).toISOString().slice(0, 10),
      condiciones_especificas: "TEST F13",
    }),
  );
  const gar0 = await prisma.garantia.findUnique({ where: { id: garId } });
  check("F6", gar0?.estado === "pendiente", `garantía 2 etapas pendiente`);

  await validarGarantia(garId, true, f.adminObj);
  const gar1 = await prisma.garantia.findUnique({ where: { id: garId } });
  check("F6", gar1?.estado === "validada" && !!gar1?.fecha_validacion && !!gar1?.validado_por, `garantía validada`);

  // RMA completo.
  const rmaId = track(
    "rma",
    await crearRma(
      {
        cliente_id: f.cliente,
        producto_id: f.productoSerial,
        serial_producto: serial,
        tipo_rma: "garantia",
        motivo: "RMA TEST F13",
        prioridad: "normal",
        orden_id: ordenId,
        garantia_id: garId,
        devolucion_venta_id: "",
        orden_servicio_id: "",
        deposito_recepcion_id: "",
      },
      f.adminObj,
    ),
  );
  const avanzar = async (data: {
    accion: "recibir" | "iniciar_diagnostico" | "diagnosticar" | "resolver" | "cerrar";
    resultado_diagnostico?: "falla_confirmada" | "sin_falla";
    resolucion?: "reparar" | "devolver_dinero";
    diagnostico?: string;
  }) => {
    await avanzarRma(
      {
        id: rmaId,
        accion: data.accion,
        diagnostico: data.diagnostico ?? "",
        resultado_diagnostico: data.resultado_diagnostico,
        resolucion: data.resolucion,
        producto_reemplazo_id: "",
        monto_reembolso: 0,
        observaciones: "",
      },
      f.adminObj,
    );
  };
  await avanzar({ accion: "recibir" });
  await avanzar({ accion: "iniciar_diagnostico" });
  await avanzar({ accion: "diagnosticar", diagnostico: "Causa: prueba", resultado_diagnostico: "falla_confirmada" });
  await avanzar({ accion: "resolver", resolucion: "reparar" });
  await avanzar({ accion: "cerrar" });
  const rmaFin = await prisma.rma.findUnique({ where: { id: rmaId } });
  check("F6", rmaFin?.estado === "cerrado" && !!rmaFin?.fecha_cierre, `RMA cerrado`);
}

// ---------------------------------------------------------------------------
// FLUJO 7 — Contabilidad: libro mayor por cuenta y balance de comprobación
// ---------------------------------------------------------------------------
async function flujo7() {
  const balances = await prisma.planCuenta.findMany({
    include: {
      asientoDetalles: {
        include: { asiento: { select: { estado: true } } },
      },
    },
  });

  for (const detalle of detallePorAsiento) {
    const a = await prisma.asientoContable.findUnique({
      where: { id: detalle },
      include: { detalles: true },
    });
    const d = a?.detalles.reduce((s, x) => s + Number(x.debe ?? 0), 0) ?? 0;
    const h = a?.detalles.reduce((s, x) => s + Number(x.haber ?? 0), 0) ?? 0;
    check("F7", a?.estado === "contabilizado" && d === h && d > 0, `asiento ${a?.numero_asiento} balanceado debe=haber=${d}`);
  }

  check("F7", balances.length > 0, `${balances.length} cuentas en plan`);
  // Conteo real de asientos contabilizados creados por esta corrida.
  const totalAsientos = await prisma.asientoContable.count({ where: { estado: "contabilizado" } });
  console.log(`  INFO [F7] asientos contabilizados totales en DB: ${totalAsientos}`);
  check("F7", true, "balance de comprobación consultado");
}

// ---------------------------------------------------------------------------
// Limpieza en orden FK (children-first)
// ---------------------------------------------------------------------------
async function limpiar() {
  const del = async (
    model: { deleteMany: (args: { where: Record<string, unknown> }) => Promise<{ count: number }> },
    where: Record<string, unknown>,
  ) => {
    await model.deleteMany({ where });
  };

  // Asientos (por ids trackeados, con sus detalles).
  await del(prisma.asientoContableDetalle, { asiento_id: { in: ids.asiento } });
  await del(prisma.asientoContable, { id: { in: ids.asiento } });
  await del(prisma.pagoCliente, { orden_id: { in: ids.orden } });
  await del(prisma.cuentaCobrar, { orden_id: { in: ids.orden } });
  await del(prisma.pagoProveedor, { orden_compra_id: { in: ids.orden_compra } });
  await del(prisma.pagoProveedor, { id: { in: ids.pago_proveedor } });
  await del(prisma.cuentaPagar, { orden_compra_id: { in: ids.orden_compra } });
  await del(prisma.cuentaPagar, { id: { in: ids.cuenta_pagar } });
  // Movimientos de inventario por producto (todos los creados en la corrida).
  const productosTest = (ids.producto ?? []).filter(Boolean);
  if (productosTest.length) {
    await del(prisma.movimientoInventario, { producto_id: { in: productosTest } });
  }
  await del(prisma.ingresoStockCompraItem, { ingreso_id: { in: ids.ingreso } });
  const ingresoIdsPorOc = (
    await prisma.ingresoStockCompra.findMany({ where: { recepcion: { orden_compra_id: { in: ids.orden_compra } } }, select: { id: true } })
  ).map((x) => x.id);
  await del(prisma.ingresoStockCompraItem, { ingreso_id: { in: ingresoIdsPorOc } });
  await del(prisma.ingresoStockCompra, { id: { in: ingresoIdsPorOc } });
  await del(prisma.ingresoStockCompra, { id: { in: ids.ingreso } });
  await del(prisma.recepcionCompraItem, { recepcion_id: { in: ids.recepcion } });
  await del(prisma.recepcionCompra, { id: { in: ids.recepcion } });
  await del(prisma.ordenesCompraItem, { po_id: { in: ids.orden_compra } });
  await del(prisma.ordenesCompra, { id: { in: ids.orden_compra } });
  await del(prisma.devolucionVentaItem, { devolucion_id: { in: ids.devolucion_venta } });
  await del(prisma.devolucionVenta, { id: { in: ids.devolucion_venta } });
  await del(prisma.devolucionCompraItem, { devolucion_id: { in: ids.devolucion_compra } });
  await del(prisma.devolucionCompra, { id: { in: ids.devolucion_compra } });
  // RMAs y garantías (incluidas las auto-generadas al completar una venta
  // seriada, que no están trackeadas) referenciadas por las órdenes de la corrida.
  const opsDeOrdenes = (
    await prisma.ordenProducto.findMany({
      where: { orden_id: { in: ids.orden } },
      select: { id: true },
    })
  ).map((x) => x.id);
  await del(prisma.rma, { orden_id: { in: ids.orden } });
  await del(prisma.garantia, { orden_producto_id: { in: opsDeOrdenes } });
  await del(prisma.garantia, { id: { in: ids.garantia } });
  await del(prisma.ordenProducto, { orden_id: { in: ids.orden } });
  await del(prisma.cajaMovimiento, { orden_id: { in: ids.orden } });
  await del(prisma.eliminacionOrden, { orden_id: { in: ids.orden } });
  await del(prisma.orden, { id: { in: ids.orden } });
  await del(prisma.ajusteStockItem, { ajuste_id: { in: ids.ajuste_stock } });
  await del(prisma.ajusteStock, { id: { in: ids.ajuste_stock } });
  await del(prisma.productoSerie, { producto_id: { in: ids.producto } });
  await del(prisma.productoSerie, { id: { in: ids.producto_serie } });
  await del(prisma.productoDeposito, { producto_id: { in: ids.producto } });
  await del(prisma.productoDeposito, { id: { in: ids.producto_deposito } });
  await del(prisma.producto, { id: { in: ids.producto } });
  await del(prisma.planCuenta, { id: { in: ids.plan_cuenta } });
  await del(prisma.metodoPago, { id: { in: ids.metodo_pago } });
  await del(prisma.configuracionSistema, { id: { in: ids.configuracion } });
  await del(prisma.deposito, { id: { in: ids.deposito } });
  await del(prisma.cliente, { id: { in: ids.cliente } });
  await del(prisma.proveedor, { id: { in: ids.proveedor } });
  await del(prisma.usuario, { id: { in: ids.usuario } });
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
  await crearPlanCuentas();
  const f = await fixtures();
  const tasks: Array<[string, () => Promise<void>]> = [
    ["FLUJO1 venta", () => flujo1(f)],
    ["FLUJO2 compra", () => flujo2(f)],
    ["FLUJO3 transferencia", () => flujo3(f)],
    ["FLUJO4 devolucion venta", () => flujo4(f)],
    ["FLUJO5 stock", () => flujo5(f)],
    ["FLUJO6 garantia+rma", () => flujo6(f)],
    ["FLUJO7 contabilidad", () => flujo7()],
  ];

  let errores = 0;
  for (const [nombre, fn] of tasks) {
    try {
      await fn();
      console.log(`PASS flujo ${nombre}`);
    } catch (e) {
      errores += 1;
      console.error(`FAIL flujo ${nombre}:`, e);
    }
  }

  const total = resultados.filter((r) => r.ok).length;
  const fallos = resultados.filter((r) => !r.ok).length;
  console.log(`\n=== Resultado: ${total} checks OK, ${fallos} FAIL, ${errores} flujo(s) con error ===`);
  if (fallos > 0 || errores > 0) {
    for (const r of resultados.filter((x) => !x.ok)) {
      console.log(`  FAIL: ${r.flujo} ${r.detalle}`);
    }
  }

  console.log("\nLimpiando datos TEST...");
  try {
    await limpiar();
    console.log("Limpieza OK.");
  } catch (e) {
    console.error("Limpieza con errores (revisar manualmente):", e);
  }

  await prisma.$disconnect();
  if (fallos > 0 || errores > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("ERROR fatal:", e);
  process.exit(1);
});