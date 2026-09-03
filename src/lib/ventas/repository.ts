import "server-only";
import { prisma } from "@/lib/prisma";
import type {
  Cliente,
  Orden,
  OrdenProducto,
  Producto,
  Prisma,
  EstadoOrden,
} from "@/generated/prisma/client";
import {
  crearClienteSchema,
  actualizarClienteSchema,
  crearOrdenSchema,
  actualizarOrdenSchema,
  eliminarOrdenSchema,
  registrarCobroSchema,
  facturarCajaMovimientoSchema,
  type CrearClienteInput,
  type ActualizarClienteInput,
  type CrearOrdenInput,
  type ActualizarOrdenInput,
  type RegistrarCobroInput,
} from "@/lib/ventas/schema";
import {
  calcularVenta,
  parseDeliveryDeObservaciones,
  sinDeliveryEnObservaciones,
} from "@/lib/ventas/calculos";
import {
  lineasAsientoCobro,
  asientoBalanceado,
  type CuentaAsiento,
} from "@/lib/contabilidad/lineas-asiento";
import { bloquearFila } from "@/lib/prisma/locks";
import {
  ejecutarOperacionCritica,
  ejecutarCreacionCritica,
  generarClaveOperacionCritica,
  validarTransicionEntidad,
} from "@/lib/operaciones/idempotencia-estados";
import { marcarSerieVendida } from "@/lib/servicios/series";
import { getNextGarantiaNumber } from "@/lib/servicios/numeracion";
import { calcularVencimientoGarantia } from "@/lib/servicios/garantias";
import {
  formatearNumero,
  getNextNumero,
  getProximoNumero,
} from "@/lib/numeracion";

// ────────────────────────────────────────────────────────────────────────────
// Tipos del dominio (DTOs serializables; sin Decimal/Date de Prisma)
// ────────────────────────────────────────────────────────────────────────────

export interface ClienteDTO {
  id: string;
  nombre: string;
  apellido: string;
  cedula: string;
  telefono: string;
  email: string;
  direccion: string | null;
  ciudad: string | null;
  ruc: string | null;
  pais: string | null;
  tipo_documento: string;
  created_at: string;
}

export interface OrdenItemDTO {
  id: string;
  producto_id: string;
  producto_codigo: string | null;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  serial: string | null;
}

export interface OrdenDTO {
  id: string;
  numero_orden: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_cedula: string | null;
  cliente_telefono: string | null;
  cliente_tipo_documento: string | null;
  vendedor_id: string | null;
  vendedor_nombre: string | null;
  vendedor_codigo: string | null;
  subtotal: number;
  costo_operativo: number;
  total: number;
  shipping_fee: number;
  estado: string;
  estado_caja: string | null;
  numero_factura: string | null;
  observaciones: string | null;
  sucursal: string | null;
  moneda: string;
  terms: string | null;
  fecha_cobro: string | null;
  created_at: string;
  is_tax_included: boolean;
  items: OrdenItemDTO[];
}

export interface ProductoVentaDTO {
  id: string;
  codigo: string | null;
  nombre: string;
  barcode: string | null;
  precio_base: number;
  stock_total: number;
  activo: boolean | null;
}

export interface VendedorDTO {
  id: string;
  nombre: string;
  apellido: string;
  vendedor_codigo: string | null;
}

export interface MetodoPagoVentaDTO {
  id: string;
  nombre: string;
  porcentaje_costo: number;
}

export interface ConfigVentasDTO {
  costo_operativo_global: number;
  porcentaje_comision_vendedor: number;
  tipo_cambio_usd: number;
}

export interface CajaMovimientoDTO {
  id: string;
  orden_id: string | null;
  orden_numero: string | null;
  cliente_nombre: string | null;
  monto_total: number;
  monto_pagado: number;
  metodo_pago: string | null;
  estado: string | null;
  numero_factura: string | null;
  fecha_cobro: string | null;
}

export interface ResumenVentasDTO {
  total_clientes: number;
  ordenes_pendientes: number;
  ordenes_completadas: number;
  ordenes_canceladas: number;
  caja_movimientos: number;
  total_cobrado_hoy: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Mappers Prisma → DTO
// ────────────────────────────────────────────────────────────────────────────

function toCliente(c: Cliente): ClienteDTO {
  return {
    id: c.id,
    nombre: c.nombre,
    apellido: c.apellido,
    cedula: c.cedula,
    telefono: c.telefono,
    email: c.email,
    direccion: c.direccion,
    ciudad: c.ciudad,
    ruc: c.ruc,
    pais: c.pais,
    tipo_documento: c.tipo_documento,
    created_at: c.created_at.toISOString(),
  };
}

type OrdenRaw = Orden & {
  cliente?: Cliente | null;
  items?: (OrdenProducto & { producto?: Producto | null })[];
};

function toOrden(raw: OrdenRaw): OrdenDTO {
  const legacyDelivery = raw.observaciones
    ? parseDeliveryDeObservaciones(raw.observaciones)
    : 0;
  const shippingFeeRaw = Number(raw.shipping_fee ?? 0);
  return {
    id: raw.id,
    numero_orden: raw.numero_orden,
    cliente_id: raw.cliente_id,
    cliente_nombre: raw.cliente
      ? `${raw.cliente.nombre} ${raw.cliente.apellido}`.trim()
      : "—",
    cliente_cedula: raw.cliente?.cedula ?? null,
    cliente_telefono: raw.cliente?.telefono ?? null,
    cliente_tipo_documento: raw.cliente?.tipo_documento ?? null,
    vendedor_id: raw.vendedor_id,
    vendedor_nombre: raw.vendedor_nombre,
    vendedor_codigo: raw.vendedor_codigo,
    subtotal: Number(raw.subtotal ?? 0),
    costo_operativo: Number(raw.costo_operativo ?? 0),
    total: Number(raw.total ?? 0),
    // shipping_fee es fuente única; fallback a tag legacy solo para lectura de VTA históricas
    shipping_fee: shippingFeeRaw || legacyDelivery,
    estado: raw.estado as string,
    estado_caja: raw.estado_caja,
    numero_factura: raw.numero_factura,
    observaciones: raw.observaciones,
    sucursal: raw.sucursal,
    moneda: raw.moneda ?? "GS",
    terms: raw.terms ?? null,
    fecha_cobro: raw.fecha_cobro?.toISOString() ?? null,
    created_at: raw.created_at.toISOString(),
    is_tax_included: raw.is_tax_included ?? false,
    items: (raw.items ?? []).map((it) => ({
      id: it.id,
      producto_id: it.producto_id,
      producto_codigo: it.producto?.codigo ?? null,
      producto_nombre: it.producto?.nombre ?? "—",
      cantidad: Number(it.cantidad),
      precio_unitario: Number(it.precio_unitario),
      subtotal: Number(it.subtotal ?? 0),
      serial: it.serial ?? it.serial_producto ?? null,
    })),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Clientes
// ────────────────────────────────────────────────────────────────────────────

export async function getClientes(busqueda?: string): Promise<ClienteDTO[]> {
  const raw = busqueda?.trim() ?? "";
  if (!raw) {
    const rows = await prisma.cliente.findMany({ orderBy: [{ apellido: "asc" }, { nombre: "asc" }], take: 1000 });
    return rows.map(toCliente);
  }
  if (raw.length < 2) return [];
  const terminos = raw.split(/\s+/).filter(Boolean);
  const filter: Prisma.ClienteWhereInput = {
    AND: terminos.map((t) => {
      const isNum = /^\d+$/.test(t);
      return isNum
        ? { OR: [{ cedula: { contains: t } }, { ruc: { contains: t } }, { telefono: { contains: t } }] }
        : { OR: [{ nombre: { contains: t, mode: "insensitive" as const } }, { apellido: { contains: t, mode: "insensitive" as const } }] };
    }),
  };
  const rows = await prisma.cliente.findMany({ where: filter, orderBy: [{ apellido: "asc" }, { nombre: "asc" }], take: 1000 });
  const qLower = raw.toLowerCase();
  const ranked = [...rows].sort((a, b) => {
    const fullA = `${a.nombre} ${a.apellido}`.toLowerCase();
    const fullB = `${b.nombre} ${b.apellido}`.toLowerCase();
    const sc = (full: string) => {
      if (full === qLower) return 0;
      if (full.startsWith(qLower)) return 1;
      if (terminos.every((t) => full.includes(t.toLowerCase()))) return 2;
      return 3;
    };
    const sa = sc(fullA);
    const sb = sc(fullB);
    if (sa !== sb) return sa - sb;
    return fullA.localeCompare(fullB);
  });
  return ranked.map(toCliente);
}

export async function getClientesPage({
  page = 1,
  pageSize = 20,
  busqueda,
}: {
  page?: number;
  pageSize?: number;
  busqueda?: string;
}): Promise<{ items: ClienteDTO[]; total: number }> {
  const raw = busqueda?.trim() ?? "";
  if (!raw || raw.length < 2) return { items: [], total: 0 };
  const terminos = raw.split(/\s+/).filter(Boolean);
  // Precisa b52: cada término como palabra completa (\y) en nombre/apellido, o exacto en cedula/ruc/telefono
  // Evita "Juan" → "Juana" (substring) usando word-boundary ~* '\yJuan\y' (case-insensitive)
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const whereParts: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  for (const t of terminos) {
    const isNum = /^\d+$/.test(t);
    if (isNum) {
      whereParts.push(`(cedula = $${idx} OR ruc = $${idx} OR telefono = $${idx})`);
      params.push(t);
      idx++;
    } else {
      const pat = `\\y${escapeRegExp(t)}\\y`;
      whereParts.push(`(nombre ~* $${idx} OR apellido ~* $${idx})`);
      params.push(pat);
      idx++;
    }
  }
  const whereSql = whereParts.join(" AND ");
  const countSql = `SELECT count(*)::int as c FROM clientes WHERE ${whereSql}`;
  const dataSql = `SELECT * FROM clientes WHERE ${whereSql} ORDER BY nombre ASC LIMIT $${idx} OFFSET $${idx + 1}`;
  const countParams = [...params];
  const dataParams = [...params, pageSize, (page - 1) * pageSize];
  const [countRes, rowsRaw] = await Promise.all([
    prisma.$queryRawUnsafe<{ c: number }[]>(countSql, ...countParams),
    prisma.$queryRawUnsafe<Cliente[]>(dataSql, ...dataParams),
  ]);
  const total = countRes[0]?.c ?? 0;
  // Ranking: exact full name > prefix > contains (ya filtrado por palabra completa, pero ordena relevancia)
  const qLower = raw.toLowerCase();
  const ranked = [...(rowsRaw as Cliente[])].sort((a, b) => {
    const fullA = `${a.nombre} ${a.apellido}`.toLowerCase();
    const fullB = `${b.nombre} ${b.apellido}`.toLowerCase();
    const score = (full: string) => {
      if (full === qLower) return 0;
      if (full.startsWith(qLower)) return 1;
      return 2;
    };
    const sa = score(fullA);
    const sb = score(fullB);
    if (sa !== sb) return sa - sb;
    return fullA.localeCompare(fullB);
  });
  return { items: ranked.map(toCliente), total };
}

// ─── Cursor-based pagination (keyset) para datasets >10k ─────────────────────
// Evita penalty de OFFSET grande. Usa cursor compuesto (apellido, nombre, id).
// Devuelve { items, nextCursor, prevCursor }.

export type ClienteCursor = {
  apellido: string;
  nombre: string;
  id: string;
};

function cursorToWhere(cursor: ClienteCursor): Prisma.ClienteWhereInput {
  return {
    OR: [
      { apellido: { gt: cursor.apellido } },
      { apellido: cursor.apellido, nombre: { gt: cursor.nombre } },
      { apellido: cursor.apellido, nombre: cursor.nombre, id: { gt: cursor.id } },
    ],
  };
}

function cursorToWherePrev(cursor: ClienteCursor): Prisma.ClienteWhereInput {
  return {
    OR: [
      { apellido: { lt: cursor.apellido } },
      { apellido: cursor.apellido, nombre: { lt: cursor.nombre } },
      { apellido: cursor.apellido, nombre: cursor.nombre, id: { lt: cursor.id } },
    ],
  };
}

function makeCursor(c: { id: string; nombre: string; apellido: string }): ClienteCursor {
  return { apellido: c.apellido, nombre: c.nombre, id: c.id };
}

export async function getClientesCursor({
  pageSize = 20,
  busqueda,
  cursor,
}: {
  pageSize?: number;
  busqueda?: string;
  cursor?: ClienteCursor;
}): Promise<{
  items: ClienteDTO[];
  nextCursor: ClienteCursor | null;
  prevCursor: ClienteCursor | null;
}> {
  function makeClientFilter(busqueda?: string): Prisma.ClienteWhereInput | undefined {
  const raw = busqueda?.trim() ?? "";
  if (!raw || raw.length < 2) return undefined;
  const terminos = raw.split(/\s+/).filter(Boolean);
  return {
    AND: terminos.map((t) => {
      const isNum = /^\d+$/.test(t);
      return isNum
        ? { OR: [{ cedula: { contains: t } }, { ruc: { contains: t } }, { telefono: { contains: t } }] }
        : { OR: [{ nombre: { contains: t, mode: "insensitive" as const } }, { apellido: { contains: t, mode: "insensitive" as const } }] };
    }),
  };
}

  const clientFilter = makeClientFilter(busqueda) ?? {};
  const whereNext: Prisma.ClienteWhereInput = cursor
    ? { AND: [clientFilter, cursorToWhere(cursor)].filter(Boolean) as Prisma.ClienteWhereInput[] }
    : clientFilter;
  const wherePrev: Prisma.ClienteWhereInput = cursor
    ? { AND: [clientFilter, cursorToWherePrev(cursor)].filter(Boolean) as Prisma.ClienteWhereInput[] }
    : clientFilter;

  // Traer 1 extra para saber si hay next/prev
  const [nextRows, prevRows] = await Promise.all([
    prisma.cliente.findMany({
      where: whereNext,
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }, { id: "asc" }],
      take: pageSize + 1,
    }),
    cursor
      ? prisma.cliente.findMany({
          where: wherePrev,
          orderBy: [{ apellido: "desc" }, { nombre: "desc" }, { id: "desc" }],
          take: pageSize + 1,
        })
      : Promise.resolve([] as Prisma.ClienteGetPayload<Record<string, unknown>>[]),
  ]);

  const hasNext = nextRows.length > pageSize;
  let items = hasNext ? nextRows.slice(0, pageSize) : nextRows;
  const hasPrev = prevRows.length > pageSize;
  const prevItems = hasPrev ? prevRows.slice(0, pageSize).reverse() : prevRows.reverse();

  // Ranking preciso sin perder cursor: dentro de la página (20 filas) ordenar por relevancia
  const rawQ = busqueda?.trim().toLowerCase() ?? "";
  if (rawQ.length >= 2) {
    const terminos = rawQ.split(/\s+/).filter(Boolean);
    const score = (c: { nombre: string; apellido: string }) => {
      const full = `${c.nombre} ${c.apellido}`.toLowerCase();
      if (full === rawQ) return 0;
      if (full.startsWith(rawQ)) return 1;
      if (terminos.every((t) => full.includes(t))) return 2;
      return 3;
    };
    items = [...items].sort((a, b) => {
      const sa = score(a as any);
      const sb = score(b as any);
      if (sa !== sb) return sa - sb;
      return `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`);
    });
  }

  return {
    items: items.map(toCliente),
    nextCursor: hasNext ? makeCursor(items[items.length - 1] as any) : null,
    prevCursor: hasPrev ? makeCursor(prevItems[0] as any) : null,
  };
}

export async function getCliente(id: string): Promise<ClienteDTO | null> {
  const row = await prisma.cliente.findUnique({ where: { id } });
  return row ? toCliente(row) : null;
}

export async function crearCliente(
  data: CrearClienteInput,
): Promise<ClienteDTO> {
  const parsed = crearClienteSchema.parse(data);
  const c = await prisma.cliente.create({
    data: {
      nombre: parsed.nombre,
      apellido: parsed.apellido,
      cedula: parsed.cedula,
      telefono: parsed.telefono,
      email: parsed.email,
      direccion: parsed.direccion || null,
      ciudad: parsed.ciudad || null,
      ruc: parsed.ruc || null,
      pais: parsed.pais || "Paraguay",
      tipo_documento: parsed.tipo_documento || "CI",
    },
  });
  return toCliente(c);
}

export async function actualizarCliente(
  id: string,
  data: ActualizarClienteInput,
): Promise<void> {
  const parsed = actualizarClienteSchema.parse(data);
  const patch: Record<string, unknown> = {};
  if (parsed.nombre !== undefined) patch.nombre = parsed.nombre;
  if (parsed.apellido !== undefined) patch.apellido = parsed.apellido;
  if (parsed.cedula !== undefined) patch.cedula = parsed.cedula;
  if (parsed.telefono !== undefined) patch.telefono = parsed.telefono;
  if (parsed.email !== undefined) patch.email = parsed.email;
  if (parsed.direccion !== undefined)
    patch.direccion = parsed.direccion || null;
  if (parsed.ciudad !== undefined) patch.ciudad = parsed.ciudad || null;
  if (parsed.ruc !== undefined) patch.ruc = parsed.ruc || null;
  if (parsed.pais !== undefined) patch.pais = parsed.pais;
  if (parsed.tipo_documento !== undefined)
    patch.tipo_documento = parsed.tipo_documento;

  await prisma.cliente.update({ where: { id }, data: patch });
}

// ────────────────────────────────────────────────────────────────────────────
// Catálogo de productos para el punto de venta
// ────────────────────────────────────────────────────────────────────────────

export async function getProductosVenta(): Promise<ProductoVentaDTO[]> {
  const rows = await prisma.producto.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    take: 1000,
  });
  return rows.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    barcode: p.barcode,
    precio_base: Number(p.precio_base ?? 0),
    stock_total: Number(p.stock_total ?? 0),
    activo: p.activo,
  }));
}

export async function getVendedores(): Promise<VendedorDTO[]> {
  const rows = await prisma.usuario.findMany({
    where: { rol: { in: ["vendedor", "admin"] }, activo: true },
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    take: 500,
  });
  return rows.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    apellido: u.apellido,
    vendedor_codigo: u.vendedor_codigo,
  }));
}

export async function getConfigVentas(): Promise<ConfigVentasDTO> {
  const cfg = await prisma.configuracionSistema.findFirst({});
  return {
    costo_operativo_global: Number(cfg?.costo_operativo_global ?? 0),
    porcentaje_comision_vendedor: Number(
      cfg?.porcentaje_comision_vendedor ?? 0,
    ),
    tipo_cambio_usd: Number(cfg?.tipo_cambio_usd ?? 7500),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Número de orden atómico (patrón getNextAsientoNumber de contabilidad)
// ────────────────────────────────────────────────────────────────────────────

type QueryExec = {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
};

export async function getNextOrdenNumber(
  caller: QueryExec = prisma,
): Promise<string> {
  const year = new Date().getFullYear();
  return formatearNumero(
    "VTA",
    year,
    await getNextNumero(caller, "orden", year),
  );
}

export async function getProximoOrdenNumber(): Promise<string> {
  const year = new Date().getFullYear();
  return formatearNumero(
    "VTA",
    year,
    await getProximoNumero(prisma, "orden", year),
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Órdenes
// ────────────────────────────────────────────────────────────────────────────

export async function getOrdenes(filtro?: {
  estado?: string;
  busqueda?: string;
}): Promise<OrdenDTO[]> {
  const rows = await prisma.orden.findMany({
    where: filtro?.estado && filtro.estado !== "todos"
      ? { estado: filtro.estado as EstadoOrden }
      : undefined,
    include: {
      cliente: true,
      items: { include: { producto: true } },
    },
    orderBy: [{ created_at: "desc" }],
    take: 1000,
  });
  if (filtro?.busqueda?.trim()) {
    const q = filtro.busqueda.toLowerCase();
    return rows
      .filter(
        (r) =>
          r.numero_orden.toLowerCase().includes(q) ||
          `${r.cliente?.nombre} ${r.cliente?.apellido}`.toLowerCase().includes(q),
      )
      .map((r) => toOrden(r));
  }
  return rows.map((r) => toOrden(r));
}

export interface OrdenesPageDTO {
  items: OrdenDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getOrdenesPage(
  filtro: { estado?: string; page?: number } = {},
): Promise<OrdenesPageDTO> {
  const page = Math.max(1, Math.trunc(filtro.page ?? 1));
  const pageSize = 20;
  const where: Prisma.OrdenWhereInput =
    filtro.estado && filtro.estado !== "todos"
      ? { estado: filtro.estado as EstadoOrden }
      : {};

  const [rows, total] = await Promise.all([
    prisma.orden.findMany({
      where,
      include: {
        cliente: true,
      },
      orderBy: [{ created_at: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.orden.count({ where }),
  ]);

  return {
    items: rows.map((r) => toOrden(r)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getOrden(id: string): Promise<OrdenDTO | null> {
  const row = await prisma.orden.findUnique({
    where: { id },
    include: {
      cliente: true,
      items: { include: { producto: true } },
    },
  });
  return row ? toOrden(row) : null;
}

export async function crearOrden(
  input: CrearOrdenInput,
  vendedor: { id: string; nombre: string; apellido: string; vendedor_codigo: string | null; rol?: string },
): Promise<string> {
  const parsed = crearOrdenSchema.parse(input);

  const crear = async (tx: Prisma.TransactionClient): Promise<string> => {
    const cliente = await tx.cliente.findUnique({
      where: { id: parsed.cliente_id },
    });
    if (!cliente) throw new Error("Cliente no encontrado");

    const productoIds = [...new Set(parsed.items.map((i) => i.producto_id))];
    const productos = await tx.producto.findMany({
      where: { id: { in: productoIds } },
    });
    if (productos.length !== productoIds.length) {
      throw new Error("Uno o más productos no existen");
    }
    const inactivo = productos.find((p) => p.activo === false);
    if (inactivo) {
      throw new Error(`Producto inactivo: ${inactivo.codigo ?? inactivo.nombre}`);
    }

    const mapPrecio = new Map(
      productos.map((p) => [p.id, Number(p.precio_base ?? 0)]),
    );
    const subtotal = parsed.items.reduce(
      (s, it) => s + it.cantidad * it.precio_unitario,
      0,
    );

    const config = await tx.configuracionSistema.findFirst({});
    const comisionPorcentaje = Number(
      config?.porcentaje_comision_vendedor ?? 0,
    );
    const tipoCambio =
      parsed.moneda === "USD" ? Number(config?.tipo_cambio_usd ?? 7500) : 1;
    let costoOperativoPorcentaje = Number(config?.costo_operativo_global ?? 0);
    if (parsed.metodo_pago) {
      const metodo = await tx.metodoPago.findFirst({
        where: { nombre: parsed.metodo_pago },
      });
      const pctMetodo = Number(metodo?.porcentaje_costo ?? 0);
      if (pctMetodo > 0) costoOperativoPorcentaje = pctMetodo;
    }
    const calc = calcularVenta(subtotal, {
      tipo_venta: parsed.tipo_venta ?? "contado",
      costo_operativo_porcentaje: costoOperativoPorcentaje,
      comision_porcentaje: comisionPorcentaje,
      costo_delivery:
        parsed.moneda === "GS" ? (parsed.costo_delivery ?? 0) : 0,
    });

    const numero = await getNextOrdenNumber(tx);
    const orden = await tx.orden.create({
      data: {
        numero_orden: numero,
        vendedor_id: vendedor.id,
        cliente_id: parsed.cliente_id,
        subtotal: calc.subtotal,
        costo_operativo: calc.costo_operativo,
        comision_vendedor: calc.comision_vendedor,
        total: calc.total,
        shipping_fee: calc.costo_delivery || null,
        estado: "pendiente",
        estado_caja: "pendiente_envio",
        pay_status: "pendiente",
        vendedor_codigo: vendedor.vendedor_codigo,
        vendedor_nombre: `${vendedor.nombre} ${vendedor.apellido}`.trim(),
        // shipping_fee es fuente única; observaciones guarda solo texto del usuario (sin tag DELIVERY:)
        observaciones: parsed.observaciones
          ? sinDeliveryEnObservaciones(parsed.observaciones) || null
          : null,
        is_tax_included: parsed.tipo_venta === "iva_incluido",
        sucursal: parsed.sucursal || null,
        moneda: parsed.moneda ?? "GS",
        tipo_cambio: tipoCambio,
        terms: parsed.metodo_pago || null,
        currency1: calc.subtotal,
        currency4:
          parsed.moneda === "USD" ? calc.total / tipoCambio : 0,
      },
    });

    await tx.ordenProducto.createMany({
      data: parsed.items.map((it) => ({
        orden_id: orden.id,
        producto_id: it.producto_id,
        cantidad: it.cantidad,
        precio_unitario:
          it.precio_unitario > 0
            ? it.precio_unitario
            : (mapPrecio.get(it.producto_id) ?? 0),
        subtotal:
          it.cantidad *
          (it.precio_unitario > 0
            ? it.precio_unitario
            : (mapPrecio.get(it.producto_id) ?? 0)),
        serial: it.serial || null,
        serial_producto: it.serial || null,
        status: "sold",
      })),
    });

    // Marcar como vendidas las series registradas en productos_series.
    // El SELECT ... FOR UPDATE sobre la fila del serial serializa ventas
    // concurrentes del mismo serial (dos órdenes no pueden venderlo).
    const seriesVendidas = parsed.items.filter((it) => it.serial?.trim());
    for (const it of seriesVendidas) {
      await marcarSerieVendida(tx, it.producto_id, it.serial?.trim() ?? "");
    }

    // La orden de venta es un ticket informativo para el cajero: el cobro se
    // realiza en Pegasus, por lo que no se descuenta stock por depósito aquí.
    // Solo se valida que exista stock total suficiente.
    const mapProducto = new Map(
      productos.map((p) => [
        p.id,
        { nombre: p.nombre, stock_total: Number(p.stock_total ?? 0) },
      ]),
    );
    for (const it of parsed.items) {
      const prod = mapProducto.get(it.producto_id);
      if (!prod) continue;
      if (prod.stock_total < it.cantidad) {
        throw new Error(
          `Stock insuficiente para ${prod.nombre}: solicitado ${it.cantidad}, disponible ${prod.stock_total}`,
        );
      }
    }

    // Se inserta automáticamente un caja_movimientos (estado 'pendiente'):
    // la orden llega sola a Caja el día de la venta (§4.14.3).
    await tx.cajaMovimiento.create({
      data: {
        orden_id: orden.id,
        orden_numero: numero,
        cliente_id: parsed.cliente_id,
        monto_total: calc.total,
        moneda: parsed.moneda ?? "GS",
        tipo_pago: parsed.metodo_pago || null,
        estado: "pendiente",
        fecha_orden: new Date(),
        vendedor_nombre: `${vendedor.nombre} ${vendedor.apellido}`.trim(),
        creado_por: vendedor.id,
      },
    });

    return orden.id;
  };

  // Con clave de idempotencia (flujo UI): creación crítica atómica.
  // Doble click / retry / requests simultáneos con la misma clave
  // → exactamente UNA orden; los demás reciben éxito-no-op con su ID real.
  if (parsed.clave_idempotencia) {
    const res = await ejecutarCreacionCritica(
      "venta.creada",
      parsed.clave_idempotencia,
      "orden_venta",
      parsed.clave_idempotencia,
      async (tx) => ({
        entidadId: await crear(tx),
        datosNuevos: { cliente_id: parsed.cliente_id, items: parsed.items.length },
      }),
      {
        actorId: vendedor.id,
        actorNombre: `${vendedor.nombre} ${vendedor.apellido}`.trim(),
        actorRol: vendedor.rol ?? "sistema",
      },
    );
    return res.entidadId;
  }

  return prisma.$transaction(crear);
}

export async function cambiarEstadoOrden(
  id: string,
  estado: "completada" | "cancelada",
  usuario?: { id: string; nombre: string; apellido: string | null; rol: string },
): Promise<void> {
  // Operación crítica: idempotencia (evita doble click), lock FOR UPDATE,
  // validación por máquina de estados y evento outbox, todo atómico.
  await ejecutarOperacionCritica(
    "orden_venta",
    estado === "completada" ? "venta.completada" : "venta.cancelada",
    generarClaveOperacionCritica("orden_venta", estado, id),
    id,
    (estadoActual) => {
      // Preserva semántica anterior: completar dos veces es no-op seguro
      if (estadoActual === "completada" && estado === "completada") {
        return { valido: true };
      }
      return validarTransicionEntidad("orden_venta", estadoActual, estado);
    },
    async (tx) => {
      const orden = await tx.orden.findUnique({
        where: { id },
        select: { numero_orden: true },
      });
      if (!orden) throw new Error("Orden no encontrada");

      if (estado === "cancelada") {
        // Integridad financiera: una orden con cobros/factura ya afectó caja,
        // asientos y cuentas por cobrar; su baja se hace por devolución o
        // eliminación (admin), no por cancelación.
        const cobrada = await tx.cajaMovimiento.findFirst({
          where: { orden_id: id, estado: { in: ["cobrado", "facturado"] } },
        });
        if (cobrada) {
          throw new Error(
            "No se puede cancelar una orden cobrada o facturada: registre una devolución o elimine la orden (admin)",
          );
        }
        const items = await tx.ordenProducto.findMany({
          where: { orden_id: id },
          include: { producto: true },
        });
        // La orden es un ticket informativo (cobro en Pegasus): no se restituye
        // stock por depósito. Solo se reactivan los seriales reservados.
        for (const it of items) {
          const serial = it.serial ?? it.serial_producto;
          if (serial?.trim()) {
            await tx.productoSerie.updateMany({
              where: {
                producto_id: it.producto_id,
                serial: serial.trim(),
                activo: false,
              },
              data: { activo: true },
            });
          }
        }
      }

      if (estado === "completada") {
        await generarGarantiasOrden(tx, id, orden.numero_orden);
      }

      await tx.orden.update({ where: { id }, data: { estado } });

      return { entidadId: id, tipoEventoOutbox: estado };
    },
    {
      actorId: usuario?.id,
      actorNombre: usuario
        ? `${usuario.nombre} ${usuario.apellido ?? ""}`.trim()
        : "Sistema",
      actorRol: usuario?.rol ?? "system",
    },
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Edición de órdenes (solo pendientes) — reemplaza ítems: restaura stock/seriales
// y vuelve a descontarlos. Mismo invariante que la RPC `actualizar_orden`.
// ────────────────────────────────────────────────────────────────────────────

export async function actualizarOrden(
  id: string,
  input: ActualizarOrdenInput,
  vendedor: {
    id: string;
    nombre: string;
    apellido: string;
    vendedor_codigo: string | null;
  },
): Promise<void> {
  const parsed = actualizarOrdenSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    // Lock: dos ediciones concurrentes se serializan; la segunda relee los
    // ítems ya reemplazados y no restaura stock dos veces.
    const orden = await bloquearFila<{
      id: string;
      estado: string;
      numero_orden: string;
    }>(tx, "orden", id);
    if (!orden) throw new Error("Orden no encontrada");
    if (orden.estado !== "pendiente") {
      throw new Error("Solo se pueden editar órdenes pendientes");
    }

    // 1) Reactivar seriales de los ítems actuales y descartarlos. La orden es
    // un ticket informativo (cobro en Pegasus): no se restituye stock.
    const oldItems = await tx.ordenProducto.findMany({
      where: { orden_id: id },
      include: { producto: true },
    });
    for (const it of oldItems) {
      const serial = it.serial ?? it.serial_producto;
      if (serial?.trim()) {
        await tx.productoSerie.updateMany({
          where: {
            producto_id: it.producto_id,
            serial: serial.trim(),
            activo: false,
          },
          data: { activo: true },
        });
      }
    }

    if (oldItems.length > 0) {
      const garantias = await tx.garantia.findMany({
        where: { orden_id: id },
        select: { id: true },
      });
      if (garantias.length > 0) {
        await tx.garantia.deleteMany({
          where: { id: { in: garantias.map((g) => g.id) } },
        });
      }
      await tx.ordenProducto.deleteMany({ where: { orden_id: id } });
    }

    // 2) Validar productos nuevos
    const productoIds = [...new Set(parsed.items.map((i) => i.producto_id))];
    const productos = await tx.producto.findMany({
      where: { id: { in: productoIds } },
    });
    if (productos.length !== productoIds.length) {
      throw new Error("Uno o más productos no existen");
    }
    const inactivo = productos.find((p) => p.activo === false);
    if (inactivo) {
      throw new Error(
        `Producto inactivo: ${inactivo.codigo ?? inactivo.nombre}`,
      );
    }

    const subtotal = parsed.items.reduce(
      (s, it) => s + it.cantidad * it.precio_unitario,
      0,
    );

    const config = await tx.configuracionSistema.findFirst({});
    const comisionPorcentaje = Number(
      config?.porcentaje_comision_vendedor ?? 0,
    );
    const tipoCambio =
      parsed.moneda === "USD" ? Number(config?.tipo_cambio_usd ?? 7500) : 1;
    let costoOperativoPorcentaje = Number(config?.costo_operativo_global ?? 0);
    if (parsed.metodo_pago) {
      const metodo = await tx.metodoPago.findFirst({
        where: { nombre: parsed.metodo_pago },
      });
      const pctMetodo = Number(metodo?.porcentaje_costo ?? 0);
      if (pctMetodo > 0) costoOperativoPorcentaje = pctMetodo;
    }
    const calc = calcularVenta(subtotal, {
      tipo_venta: parsed.tipo_venta ?? "contado",
      costo_operativo_porcentaje: costoOperativoPorcentaje,
      comision_porcentaje: comisionPorcentaje,
      costo_delivery:
        parsed.moneda === "GS" ? (parsed.costo_delivery ?? 0) : 0,
    });

    // 3) Insertar ítems nuevos
    const mapPrecio = new Map(
      productos.map((p) => [p.id, Number(p.precio_base ?? 0)]),
    );
    await tx.ordenProducto.createMany({
      data: parsed.items.map((it) => ({
        orden_id: id,
        producto_id: it.producto_id,
        cantidad: it.cantidad,
        precio_unitario:
          it.precio_unitario > 0
            ? it.precio_unitario
            : (mapPrecio.get(it.producto_id) ?? 0),
        subtotal:
          it.cantidad *
          (it.precio_unitario > 0
            ? it.precio_unitario
            : (mapPrecio.get(it.producto_id) ?? 0)),
        serial: it.serial || null,
        serial_producto: it.serial || null,
        status: "sold",
      })),
    });

    // 4) Marcar series vendidas (lock FOR UPDATE por serial)
    const seriesVendidas = parsed.items.filter((it) => it.serial?.trim());
    for (const it of seriesVendidas) {
      await marcarSerieVendida(tx, it.producto_id, it.serial?.trim() ?? "");
    }

    // 5) Validar stock total de ítems nuevos (la orden no descuenta stock:
    // es un ticket informativo, el cobro se realiza en Pegasus)
    const mapProducto = new Map(
      productos.map((p) => [
        p.id,
        {
          nombre: p.nombre,
          stock_total: Number(p.stock_total ?? 0),
        },
      ]),
    );
    for (const it of parsed.items) {
      const prod = mapProducto.get(it.producto_id);
      if (!prod) continue;
      if (prod.stock_total < it.cantidad) {
        throw new Error(
          `Stock insuficiente para ${prod.nombre}: solicitado ${it.cantidad}, disponible ${prod.stock_total}`,
        );
      }
    }

    // 6) Actualizar encabezado + totales (shipping_fee fuente única, sin tag)
    await tx.orden.update({
      where: { id },
      data: {
        vendedor_id: vendedor.id,
        vendedor_codigo: vendedor.vendedor_codigo,
        vendedor_nombre: `${vendedor.nombre} ${vendedor.apellido}`.trim(),
        cliente_id: parsed.cliente_id,
        subtotal: calc.subtotal,
        costo_operativo: calc.costo_operativo,
        comision_vendedor: calc.comision_vendedor,
        total: calc.total,
        shipping_fee: calc.costo_delivery || null,
        observaciones: parsed.observaciones
          ? sinDeliveryEnObservaciones(parsed.observaciones) || null
          : null,
        is_tax_included: parsed.tipo_venta === "iva_incluido",
        sucursal: parsed.sucursal || null,
        moneda: parsed.moneda ?? "GS",
        tipo_cambio: tipoCambio,
        terms: parsed.metodo_pago || null,
        currency1: calc.subtotal,
        currency4: parsed.moneda === "USD" ? calc.total / tipoCambio : 0,
      },
    });

    // 7) Sincronizar caja_movimientos si cambió el total
    await tx.cajaMovimiento.updateMany({
      where: { orden_id: id, estado: { in: ["pendiente", "cobrado"] } },
      data: { monto_total: calc.total },
    });
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Eliminación de orden (solo admin) — restaura stock, registra en
// `eliminaciones_ordenes` (snapshot) y borra en cascada lo que pertenece
// a la orden. Registros financieros/históricos se desvinculan (no se borran).
// ────────────────────────────────────────────────────────────────────────────

export async function eliminarOrden(
  id: string,
  motivo: string,
  usuario: { id: string; nombre: string; apellido: string },
): Promise<{ numero_orden: string }> {
  const parsed = eliminarOrdenSchema.parse({ id, motivo });

  return prisma.$transaction(async (tx) => {
    // Lock: evita doble eliminación concurrente con doble restitución de stock.
    await bloquearFila(tx, "orden", parsed.id);
    const orden = await tx.orden.findUnique({
      where: { id: parsed.id },
      include: {
        items: { include: { producto: true } },
        garantias: { select: { id: true } },
        cajaMovimientos: { select: { id: true } },
        devolucionesVentas: { select: { id: true } },
        pagosClientes: { select: { id: true } },
        cuentasCobrar: { select: { id: true } },
        rmas: { select: { id: true } },
      },
    });
    if (!orden) throw new Error("Orden no encontrada");

    // 1) Reactivar seriales si la orden no estaba cancelada. La orden es un
    // ticket informativo (cobro en Pegasus): no se restituye stock.
    if (orden.estado !== "cancelada") {
      for (const it of orden.items) {
        const serial = it.serial ?? it.serial_producto;
        if (serial?.trim()) {
          await tx.productoSerie.updateMany({
            where: {
              producto_id: it.producto_id,
              serial: serial.trim(),
              activo: false,
            },
            data: { activo: true },
          });
        }
      }
    }

    // 2) Snapshot para `eliminaciones_ordenes`
    const datosOrden = {
      numero_orden: orden.numero_orden,
      cliente_id: orden.cliente_id,
      subtotal: Number(orden.subtotal ?? 0),
      costo_operativo: Number(orden.costo_operativo ?? 0),
      total: Number(orden.total ?? 0),
      estado: orden.estado,
      estado_caja: orden.estado_caja,
      numero_factura: orden.numero_factura,
      observaciones: orden.observaciones,
      sucursal: orden.sucursal,
      moneda: orden.moneda,
      created_at: orden.created_at.toISOString(),
      items: orden.items.map((it) => ({
        producto_id: it.producto_id,
        producto_codigo: it.producto?.codigo ?? null,
        producto_nombre: it.producto?.nombre ?? null,
        cantidad: Number(it.cantidad),
        precio_unitario: Number(it.precio_unitario),
        serial: it.serial ?? it.serial_producto,
      })),
    };

    // 3) Desvincular registros financieros/históricos (pagos, cuentas, devoluciones)
    if (orden.pagosClientes.length > 0) {
      await tx.pagoCliente.updateMany({
        where: { id: { in: orden.pagosClientes.map((p) => p.id) } },
        data: { orden_id: null },
      });
    }
    if (orden.cuentasCobrar.length > 0) {
      await tx.cuentaCobrar.updateMany({
        where: { id: { in: orden.cuentasCobrar.map((c) => c.id) } },
        data: { orden_id: null },
      });
    }
    if (orden.devolucionesVentas.length > 0) {
      const devIds = orden.devolucionesVentas.map((d) => d.id);
      await tx.rma.updateMany({
        where: { devolucion_venta_id: { in: devIds } },
        data: { devolucion_venta_id: null },
      });
      await tx.devolucionVenta.updateMany({
        where: { id: { in: devIds } },
        data: { orden_id: null },
      });
    }

    // 4) Desvincular RMAs relacionados con la orden / sus garantías / caja
    await tx.rma.updateMany({
      where: { id: { in: orden.rmas.map((r) => r.id) } },
      data: { orden_id: null },
    });
    await tx.rma.updateMany({
      where: { garantia_id: { in: orden.garantias.map((g) => g.id) } },
      data: { garantia_id: null },
    });
    await tx.rma.updateMany({
      where: { caja_movimiento_id: { in: orden.cajaMovimientos.map((c) => c.id) } },
      data: { caja_movimiento_id: null },
    });

    // 5) Reversión contable: cancelar los asientos de cobro de los movimientos
    //    de caja de la orden antes de borrarlos (evita asientos huérfanos
    //    "contabilizado" sin movimiento asociado).
    if (orden.cajaMovimientos.length > 0) {
      const asientosCaja = await tx.asientoContable.findMany({
        where: {
          referencia_tipo: "caja",
          referencia_id: { in: orden.cajaMovimientos.map((c) => c.id) },
        },
      });
      for (const asiento of asientosCaja) {
        await tx.asientoContable.update({
          where: { id: asiento.id },
          data: {
            estado: "cancelado",
            concepto: `[ANULADO] ${asiento.concepto}`,
            updated_at: new Date(),
          },
        });
      }
    }

    // 6) Borrar en cascada lo que pertenece a la orden
    await tx.garantia.deleteMany({
      where: { id: { in: orden.garantias.map((g) => g.id) } },
    });
    await tx.cajaMovimiento.deleteMany({
      where: { id: { in: orden.cajaMovimientos.map((c) => c.id) } },
    });
    await tx.ordenProducto.deleteMany({ where: { orden_id: parsed.id } });

    // 7) Registrar la eliminación
    await tx.eliminacionOrden.create({
      data: {
        orden_id: parsed.id,
        numero_orden: orden.numero_orden,
        motivo: parsed.motivo,
        eliminado_por: usuario.id,
        datos_orden: datosOrden as unknown as Prisma.InputJsonValue,
      },
    });

    // 7) Eliminar la orden
    await tx.orden.delete({ where: { id: parsed.id } });

    return { numero_orden: orden.numero_orden };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Garantías (código G-AAAA-NNNN, generadas al completar la orden)
// ────────────────────────────────────────────────────────────────────────────

const GARANTIA_MESES_VIGENCIA = 12;

async function generarGarantiasOrden(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  ordenId: string,
  numeroOrden: string,
): Promise<void> {
  const orden = await tx.orden.findUnique({
    where: { id: ordenId },
    select: { cliente_id: true, vendedor_id: true, numero_factura: true },
  });
  if (!orden) return;

  const items = await tx.ordenProducto.findMany({
    where: { orden_id: ordenId },
    select: {
      id: true,
      producto_id: true,
      serial: true,
      serial_producto: true,
      garantias: { select: { id: true } },
    },
  });

  for (const it of items) {
    if (it.garantias.length > 0) continue;
    const serial = it.serial ?? it.serial_producto;
    if (!serial?.trim()) continue;

    const codigo = await getNextGarantiaNumber(tx);
    const vencimiento = calcularVencimientoGarantia(
      new Date(),
      GARANTIA_MESES_VIGENCIA,
    );

    await tx.garantia.create({
      data: {
        codigo_garantia: codigo,
        orden_id: ordenId,
        producto_id: it.producto_id,
        orden_producto_id: it.id,
        cliente_id: orden.cliente_id,
        vendedor_id: orden.vendedor_id,
        serial_producto: serial.trim(),
        estado: "emitida",
        numero_factura: orden.numero_factura ?? numeroOrden,
        fecha_vencimiento: vencimiento,
        condiciones_especificas:
          "Garantía emitida automáticamente al completar la venta",
      },
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Caja / Cobros
// ────────────────────────────────────────────────────────────────────────────

export async function getCajaMovimientos(): Promise<CajaMovimientoDTO[]> {
  const rows = await prisma.cajaMovimiento.findMany({
    include: { cliente: { select: { nombre: true, apellido: true } } },
    orderBy: [
      { fecha_cobro: { sort: "desc", nulls: "last" } },
      { created_at: "desc" },
    ],
    take: 1000,
  });
  return rows.map((r) => ({
    id: r.id,
    orden_id: r.orden_id,
    orden_numero: r.orden_numero,
    cliente_nombre: r.cliente
      ? `${r.cliente.nombre} ${r.cliente.apellido}`.trim()
      : null,
    monto_total: Number(r.monto_total ?? 0),
    monto_pagado: Number(r.monto_pagado ?? 0),
    metodo_pago: r.tipo_pago,
    estado: r.estado as string | null,
    numero_factura: r.numero_factura,
    fecha_cobro: r.fecha_cobro?.toISOString() ?? null,
  }));
}

export async function getCajaMovimientosPage({
  page = 1,
  pageSize = 20,
  busqueda,
  estado,
}: {
  page?: number;
  pageSize?: number;
  busqueda?: string;
  estado?: string;
}): Promise<{ items: CajaMovimientoDTO[]; total: number }> {
  const where: Record<string, unknown> = {};
  if (estado && estado !== "todos") where.estado = estado;
  if (busqueda?.trim()) {
    where.OR = [
      { orden_numero: { contains: busqueda } },
      { cliente: { nombre: { contains: busqueda, mode: "insensitive" as const } } },
      { cliente: { apellido: { contains: busqueda, mode: "insensitive" as const } } },
      { numero_factura: { contains: busqueda } },
    ];
  }
  const [rows, total] = await Promise.all([
    prisma.cajaMovimiento.findMany({
      where,
      include: { cliente: { select: { nombre: true, apellido: true } } },
      orderBy: [
        { fecha_cobro: { sort: "desc", nulls: "last" } },
        { created_at: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.cajaMovimiento.count({ where }),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      orden_id: r.orden_id,
      orden_numero: r.orden_numero,
      cliente_nombre: r.cliente
        ? `${r.cliente.nombre} ${r.cliente.apellido}`.trim()
        : null,
      monto_total: Number(r.monto_total ?? 0),
      monto_pagado: Number(r.monto_pagado ?? 0),
      metodo_pago: r.tipo_pago,
      estado: r.estado as string | null,
      numero_factura: r.numero_factura,
      fecha_cobro: r.fecha_cobro?.toISOString() ?? null,
    })),
    total,
  };
}

export async function registrarCobro(
  input: RegistrarCobroInput,
  usuario: { id: string; nombre: string; apellido: string; rol?: string },
): Promise<string> {
  const parsed = registrarCobroSchema.parse(input);

  const cobrar = async (tx: Prisma.TransactionClient): Promise<string> => {
    // Lock de la orden: serializa cobros concurrentes sobre la misma orden.
    // Sin esto, dos submits simultáneos crearían 2 pagoCliente + 2 asientos.
    await bloquearFila(tx, "orden", parsed.orden_id);
    const orden = await tx.orden.findUnique({
      where: { id: parsed.orden_id },
      include: { cliente: true },
    });
    if (!orden) throw new Error("Orden no encontrada");
    if (orden.estado === "cancelada") {
      throw new Error("No se puede cobrar una orden cancelada");
    }

    const total = Number(orden.total ?? 0);
    if (parsed.monto_pagado > total) {
      throw new Error(
        `El monto (₲${parsed.monto_pagado.toLocaleString()}) supera el total de la orden (₲${total.toLocaleString()})`,
      );
    }

    // La orden ya trae su caja_movimientos ('pendiente') desde crear_orden;
    // al cobrar se transiciona ese mismo registro (acumulando pagos parciales).
    const existente = await tx.cajaMovimiento.findFirst({
      where: { orden_id: orden.id, estado: { in: ["pendiente", "cobrado"] } },
    });
    const pagadoAnterior = Number(existente?.monto_pagado ?? 0);
    const nuevoPagado = pagadoAnterior + parsed.monto_pagado;
    if (nuevoPagado > total) {
      throw new Error(
        `El monto supera el saldo pendiente de la orden (₲${(total - pagadoAnterior).toLocaleString()})`,
      );
    }

    const mov = existente
      ? await tx.cajaMovimiento.update({
          where: { id: existente.id },
          data: {
            monto_total: total,
            monto_pagado: nuevoPagado,
            tipo_pago: parsed.metodo_pago,
            estado: "cobrado",
            fecha_cobro: new Date(),
            numero_factura:
              parsed.numero_factura || existente.numero_factura || null,
          },
        })
      : await tx.cajaMovimiento.create({
          data: {
            orden_id: orden.id,
            orden_numero: orden.numero_orden,
            cliente_id: orden.cliente_id,
            monto_total: total,
            monto_pagado: parsed.monto_pagado,
            moneda: orden.moneda ?? "GS",
            tipo_pago: parsed.metodo_pago,
            estado: "cobrado",
            fecha_orden: orden.created_at,
            fecha_cobro: new Date(),
            vendedor_nombre: orden.vendedor_nombre,
            numero_factura: parsed.numero_factura || null,
            creado_por: usuario.id,
          },
        });

    await tx.pagoCliente.create({
      data: {
        orden_id: orden.id,
        cliente_id: orden.cliente_id,
        monto: parsed.monto_pagado,
        metodo_pago: parsed.metodo_pago,
        fecha_pago: new Date(),
        referencia: parsed.numero_factura || null,
        invoice_number: parsed.numero_factura || null,
        creator: usuario.id,
      },
    });

    const cobrado = nuevoPagado >= total;
    await tx.orden.update({
      where: { id: orden.id },
      data: {
        estado_caja: cobrado ? "cobrado" : "parcial",
        pay_status: cobrado ? "pagado" : "parcial",
        fecha_cobro: new Date(),
        numero_factura: parsed.numero_factura || orden.numero_factura,
      },
    });

    const saldo = total - nuevoPagado;

    // Se actualiza (o crea) UNA única cuenta por cobrar por orden: evita
    // duplicados en pagos parciales y aplica el estado 'pagado' al saldar.
    const cxcExistente = await tx.cuentaCobrar.findFirst({
      where: { orden_id: orden.id },
    });
    if (!cobrado) {
      if (cxcExistente) {
        await tx.cuentaCobrar.update({
          where: { id: cxcExistente.id },
          data: { saldo_pendiente: saldo, estado: "parcial" },
        });
      } else {
        await tx.cuentaCobrar.create({
          data: {
            cliente_id: orden.cliente_id,
            orden_id: orden.id,
            monto_total: total,
            saldo_pendiente: saldo,
            fecha_emision: new Date(),
            estado: "parcial",
          },
        });
      }
    } else if (cxcExistente) {
      if (cxcExistente.estado !== "pagado") {
        await tx.cuentaCobrar.update({
          where: { id: cxcExistente.id },
          data: { saldo_pendiente: 0, estado: "pagado" },
        });
      }
    } else {
      // Pago único por el total: sin fila previa, se crea la cuenta por cobrar
      // ya saldada para mantener UNA cuenta por orden en el módulo contable.
      await tx.cuentaCobrar.create({
        data: {
          cliente_id: orden.cliente_id,
          orden_id: orden.id,
          monto_total: total,
          saldo_pendiente: 0,
          fecha_emision: new Date(),
          estado: "pagado",
        },
      });
    }

    await crearAsientoCobro(tx, {
      numero_orden: orden.numero_orden,
      clienteNombre: orden.cliente
        ? `${orden.cliente.nombre} ${orden.cliente.apellido}`
        : null,
      montoTotal: total,
      montoPagado: parsed.monto_pagado,
      saldo,
      pagadoAnterior,
      referenciaId: mov.id,
      cobrado,
    });

    return mov.id;
  };

  // Con clave de idempotencia (flujo UI): creación crítica atómica.
  // Doble click / retry / requests concurrentes con la misma clave
  // → exactamente UN pago; los demás reciben éxito-no-op con el ID real.
  if (parsed.clave_idempotencia) {
    const res = await ejecutarCreacionCritica(
      "cobro.registrado",
      parsed.clave_idempotencia,
      "caja_movimiento",
      parsed.orden_id,
      async (tx) => ({ entidadId: await cobrar(tx) }),
      {
        actorId: usuario.id,
        actorNombre: `${usuario.nombre} ${usuario.apellido}`.trim(),
        actorRol: usuario.rol ?? "sistema",
      },
    );
    return res.entidadId;
  }

  return prisma.$transaction(cobrar);
}

// Cuentas contables esperadas en el plan de cuentas (por código). El asiento
// solo se genera si las cuentas existen; de lo contrario el cobro continúa sin
// integración contable (plan de cuentas aún no sembrado).
const CUENTA_CAJA_CODE = "1.1.01";
const CUENTA_CXC_CODE = "1.1.03";
const CUENTA_VENTAS_CODE = "4.1.01";

async function crearAsientoCobro(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  opts: {
    numero_orden: string;
    clienteNombre: string | null;
    montoTotal: number;
    montoPagado: number;
    saldo: number;
    pagadoAnterior: number;
    referenciaId: string;
    cobrado: boolean;
  },
): Promise<void> {
  const caja = await tx.planCuenta.findUnique({ where: { codigo: CUENTA_CAJA_CODE } });
  const ventas = await tx.planCuenta.findUnique({ where: { codigo: CUENTA_VENTAS_CODE } });
  if (!caja || !ventas) return;

  const cxc = await tx.planCuenta.findUnique({ where: { codigo: CUENTA_CXC_CODE } });

  const lineas = lineasAsientoCobro({
    pagadoAnterior: opts.pagadoAnterior,
    cobrado: opts.cobrado,
    montoPagado: opts.montoPagado,
    montoTotal: opts.montoTotal,
    saldo: opts.saldo,
    tieneCxc: cxc !== null,
  });

  if (!asientoBalanceado(lineas)) {
    throw new Error("El asiento de cobro no cuadra (integridad de partida doble)");
  }

  const cuentaId = (cuenta: CuentaAsiento): string => {
    if (cuenta === "caja") return caja.id;
    if (cuenta === "ventas") return ventas.id;
    return cxc!.id;
  };

  const numero = await getNextAsientoNumberTx(tx);
  const cliente = opts.clienteNombre ? `${opts.clienteNombre} - ` : "";

  const asiento = await tx.asientoContable.create({
    data: {
      numero_asiento: numero,
      fecha: new Date(),
      concepto: `Cobro de ${opts.numero_orden} - ${cliente}monto ₲${opts.montoPagado.toLocaleString()}`,
      referencia_tipo: "caja",
      referencia_id: opts.referenciaId,
      estado: "contabilizado",
    },
  });

  await tx.asientoContableDetalle.createMany({
    data: lineas.map((l) => ({
      asiento_id: asiento.id,
      cuenta_id: cuentaId(l.cuenta),
      debe: l.debe,
      haber: l.haber,
    })),
  });
}

async function getNextAsientoNumberTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<string> {
  const year = new Date().getFullYear();
  return formatearNumero(
    "AS",
    year,
    await getNextNumero(tx, "asiento", year),
  );
}

export async function anularCajaMovimiento(
  id: string,
  motivo: string,
): Promise<void> {
  if (!motivo?.trim()) throw new Error("El motivo es obligatorio");
  await prisma.$transaction(async (tx) => {
    const mov = await bloquearFila<{
      id: string;
      estado: string | null;
      orden_id: string | null;
    }>(tx, "caja_movimiento", id);
    if (!mov) throw new Error("Movimiento de caja no encontrado");
    if (mov.estado === "anulado") {
      throw new Error("El movimiento de caja ya está anulado");
    }
    if (mov.estado === "facturado") {
      throw new Error(
        "No se puede anular un movimiento facturado: la factura ya fue emitida",
      );
    }

    // Reversión completa: si el cobro generó asiento contable, se cancela en la
    // misma transacción (mismo patrón que anularPagoProveedor).
    const asiento = await tx.asientoContable.findFirst({
      where: { referencia_tipo: "caja", referencia_id: id },
    });
    if (asiento) {
      await tx.asientoContable.update({
        where: { id: asiento.id },
        data: {
          estado: "cancelado",
          concepto: `[ANULADO] ${asiento.concepto}`,
          updated_at: new Date(),
        },
      });
    }

    await tx.cajaMovimiento.update({
      where: { id },
      data: { estado: "anulado", observaciones: motivo.trim() },
    });

    // Reconsistencia: el pagado real de la orden es la suma de movimientos NO
    // anulados. Sin esto, anular el único cobro dejaría la orden 'cobrado' y
    // la CxC 'pagado' apuntando a dinero anulado.
    if (mov.orden_id) {
      const restantes = await tx.cajaMovimiento.aggregate({
        where: { orden_id: mov.orden_id, estado: { not: "anulado" } },
        _sum: { monto_pagado: true },
      });
      const ordenRef = await tx.orden.findUnique({
        where: { id: mov.orden_id },
        select: { total: true },
      });
      const pagadoRestante = Number(restantes._sum.monto_pagado ?? 0);
      const totalOrden = Number(ordenRef?.total ?? 0);
      const saldado = totalOrden > 0 && pagadoRestante >= totalOrden;

      if (pagadoRestante === 0) {
        await tx.orden.update({
          where: { id: mov.orden_id },
          data: { estado_caja: "pendiente_envio", pay_status: "pendiente", fecha_cobro: null },
        });
      } else if (!saldado) {
        await tx.orden.update({
          where: { id: mov.orden_id },
          data: { estado_caja: "parcial", pay_status: "parcial" },
        });
      }

      const cxc = await tx.cuentaCobrar.findFirst({
        where: { orden_id: mov.orden_id },
      });
      if (cxc) {
        if (saldado) {
          if (cxc.estado !== "pagado") {
            await tx.cuentaCobrar.update({
              where: { id: cxc.id },
              data: { saldo_pendiente: 0, estado: "pagado" },
            });
          }
        } else {
          await tx.cuentaCobrar.update({
            where: { id: cxc.id },
            data: {
              saldo_pendiente: Math.max(totalOrden - pagadoRestante, 0),
              estado: pagadoRestante > 0 ? "parcial" : "pendiente",
            },
          });
        }
      }
    }
  });
}

// Factura un movimiento cobrado: carga N° factura → estado 'facturado'
// (mismo invariante que la RPC `facturar_movimiento_caja`).
export async function facturarCajaMovimiento(
  id: string,
  numeroFactura: string,
): Promise<void> {
  const parsed = facturarCajaMovimientoSchema.parse({
    id,
    numero_factura: numeroFactura,
  });

  await prisma.$transaction(async (tx) => {
    // Lock: dos facturaciones concurrentes se serializan; la segunda relee
    // estado 'facturado' y es rechazada (no hay doble factura).
    const mov = await bloquearFila<{
      id: string;
      estado: string;
      numero_factura: string | null;
      orden_id: string | null;
    }>(tx, "caja_movimiento", id);
    if (!mov) throw new Error("Movimiento de caja no encontrado");
    if (mov.estado !== "cobrado") {
      throw new Error("Solo se pueden facturar movimientos cobrados");
    }
    if (mov.numero_factura) {
      throw new Error("El movimiento ya está facturado");
    }

    await tx.cajaMovimiento.update({
      where: { id },
      data: { numero_factura: parsed.numero_factura, estado: "facturado" },
    });

    if (mov.orden_id) {
      await tx.orden.update({
        where: { id: mov.orden_id },
        data: { numero_factura: parsed.numero_factura, estado_caja: "facturado" },
      });
    }
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Resumen para el índice del módulo
// ────────────────────────────────────────────────────────────────────────────

export async function getResumenVentas(): Promise<ResumenVentasDTO> {
  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);

  const [totalClientes, ods, cajaHoy] = await Promise.all([
    prisma.cliente.count(),
    prisma.orden.groupBy({ by: ["estado"], _count: { _all: true } }),
    prisma.cajaMovimiento.aggregate({
      where: {
        estado: "cobrado",
        fecha_cobro: { gte: hoyInicio },
      },
      _count: { _all: true },
      _sum: { monto_pagado: true },
    }),
  ]);

  const count = (estado: string) =>
    ods.find((g) => g.estado === estado)?._count._all ?? 0;

  return {
    total_clientes: totalClientes,
    ordenes_pendientes: count("pendiente"),
    ordenes_completadas: count("completada"),
    ordenes_canceladas: count("cancelada"),
    caja_movimientos: cajaHoy._count._all,
    total_cobrado_hoy: Number(cajaHoy._sum.monto_pagado ?? 0),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Métodos de pago (para el cobro)
// ────────────────────────────────────────────────────────────────────────────

export async function getMetodosPago(): Promise<MetodoPagoVentaDTO[]> {
  const rows = await prisma.metodoPago.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
  });
  return rows.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    porcentaje_costo: Number(m.porcentaje_costo ?? 0),
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// Órdenes cobrables (para registrar cobro desde Caja)
// ────────────────────────────────────────────────────────────────────────────

export interface OrdenCobrableDTO {
  id: string;
  numero_orden: string;
  cliente_nombre: string;
  total: number;
  pagado: number;
  saldo: number;
}

export async function getOrdenesCobrables(): Promise<OrdenCobrableDTO[]> {
  const rows = await prisma.orden.findMany({
    where: {
      estado: { not: "cancelada" },
      estado_caja: { in: ["pendiente_envio", "parcial"] },
    },
    include: {
      cliente: { select: { nombre: true, apellido: true } },
      cajaMovimientos: {
        where: { estado: "cobrado" },
        select: { monto_pagado: true },
      },
    },
    orderBy: { created_at: "desc" },
    take: 500,
  });
  return rows.map((r) => {
    const total = Number(r.total ?? 0);
    const pagado = r.cajaMovimientos.reduce(
      (s, m) => s + Number(m.monto_pagado ?? 0),
      0,
    );
    return {
      id: r.id,
      numero_orden: r.numero_orden,
      cliente_nombre: r.cliente
        ? `${r.cliente.nombre} ${r.cliente.apellido}`.trim()
        : "—",
      total,
      pagado,
      saldo: Math.max(0, total - pagado),
    };
  });
}