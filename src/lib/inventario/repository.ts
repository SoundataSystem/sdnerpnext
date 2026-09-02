import "server-only";
import { prisma } from "@/lib/prisma";
import { bloquearFila } from "@/lib/prisma/locks";
import type {
  Producto,
  Deposito,
  AjusteStock,
  AjusteStockItem,
  TipoMovimientoInventario,
} from "@/generated/prisma/client";
import {
  crearProductoSchema,
  actualizarProductoSchema,
  crearDepositoSchema,
  actualizarDepositoSchema,
  crearAjusteStockSchema,
  crearTransferenciaSchema,
  type CrearProductoInput,
  type ActualizarProductoInput,
  type CrearDepositoInput,
  type ActualizarDepositoInput,
  type CrearAjusteStockInput,
  type CrearTransferenciaInput,
} from "@/lib/inventario/schema";
import {
  diferenciaStock,
  numeroAjusteSecuencia,
  esBajoStock,
} from "@/lib/inventario/calculos";
import {
  setStockDeposito,
  incrementarStockDeposito,
  decrementarStockDeposito,
} from "@/lib/inventario/stock";
import { getNextNumero } from "@/lib/numeracion";
import {
  ejecutarOperacionCritica,
  generarClaveOperacionCritica,
} from "@/lib/operaciones/idempotencia-estados";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Tipos del dominio (DTOs serializables)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ProductoInventarioDTO {
  id: string;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  barcode: string | null;
  cate: string | null;
  subcate: string | null;
  precio_base: number;
  purchase_cost: number;
  stock_total: number;
  stock_minimo: number;
  stock_maximo: number;
  activo: boolean | null;
  created_at: string;
  under_minimo: boolean;
}

export interface StockDepositoDTO {
  id: string;
  producto_id: string;
  producto_codigo: string | null;
  producto_nombre: string;
  deposito_id: string;
  deposito_nombre: string;
  stock: number;
}

export interface DepositoInventarioDTO {
  id: string;
  nombre: string;
  columna_stock: string;
  activo: boolean | null;
  created_at: string;
}

export interface AjusteItemDTO {
  id: string;
  producto_id: string;
  producto_codigo: string | null;
  producto_nombre: string;
  stock_actual: number;
  stock_nuevo: number;
  diferencia: number;
  motivo_item: string | null;
}

export interface AjusteDTO {
  id: string;
  numero_ajuste: string;
  deposito_id: string;
  deposito_nombre: string;
  fecha: string | null;
  tipo: string;
  motivo: string;
  estado: string;
  usuario_nombre: string | null;
  aprobado_por: string | null;
  aprobado_at: string | null;
  created_at: string;
  items: AjusteItemDTO[];
}

export interface MovimientoInventarioDTO {
  id: string;
  tipo: string;
  producto_id: string;
  producto_nombre: string | null;
  producto_codigo: string | null;
  cantidad: number;
  stock_anterior: number;
  stock_nuevo: number;
  deposito_origen: string | null;
  deposito_destino: string | null;
  referencia: string | null;
  motivo: string | null;
  observaciones: string | null;
  usuario_nombre: string | null;
  created_at: string;
}

export interface ResumenInventarioDTO {
  total_productos: number;
  productos_activos: number;
  total_depositos: number;
  bajo_minimo: number;
  stock_total: number;
  ajustes_pendientes: number;
}

export interface SerieDisponibleDTO {
  id: string;
  producto_id: string;
  serial: string;
  deposito: string | null;
  activo: boolean | null;
}

export interface TransferenciaResultDTO {
  movimientos: number;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Mappers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function toProducto(p: Producto): ProductoInventarioDTO {
  const stockTotal = Number(p.stock_total ?? 0);
  const stockMinimo = Number(p.stock_minimo ?? 0);
  return {
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    descripcion: p.descripcion,
    barcode: p.barcode,
    cate: p.cate,
    subcate: p.subcate,
    precio_base: Number(p.precio_base ?? 0),
    purchase_cost: Number(p.purchase_cost ?? 0),
    stock_total: stockTotal,
    stock_minimo: stockMinimo,
    stock_maximo: Number(p.stock_maximo ?? 0),
    activo: p.activo,
    created_at: p.created_at.toISOString(),
    under_minimo: esBajoStock(stockTotal, stockMinimo),
  };
}

function toAjuste(
  a: AjusteStock & {
    deposito: Deposito;
    items?: (AjusteStockItem & { producto?: Producto | null })[];
  },
): AjusteDTO {
  return {
    id: a.id,
    numero_ajuste: a.numero_ajuste,
    deposito_id: a.deposito_id,
    deposito_nombre: a.deposito.nombre,
    fecha: a.fecha?.toISOString().split("T")[0] ?? null,
    tipo: a.tipo as string,
    motivo: a.motivo,
    estado: a.estado as string,
    usuario_nombre: null,
    aprobado_por: a.aprobado_por,
    aprobado_at: a.aprobado_at?.toISOString().split("T")[0] ?? null,
    created_at: a.created_at.toISOString(),
    items: (a.items ?? []).map((it) => ({
      id: it.id,
      producto_id: it.producto_id,
      producto_codigo: it.producto?.codigo ?? null,
      producto_nombre: it.producto?.nombre ?? "â€”",
      stock_actual: it.stock_actual,
      stock_nuevo: it.stock_nuevo,
      diferencia: it.diferencia ?? diferenciaStock(it.stock_nuevo, it.stock_actual),
      motivo_item: it.motivo_item,
    })),
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Productos
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getProductosInventario(
  busqueda?: string,
): Promise<ProductoInventarioDTO[]> {
  const rows = await prisma.producto.findMany({
    where: busqueda?.trim()
      ? {
          OR: [
            { nombre: { contains: busqueda, mode: "insensitive" } },
            { codigo: { contains: busqueda } },
            { barcode: { contains: busqueda } },
          ],
        }
      : undefined,
    orderBy: [{ nombre: "asc" }],
    take: 1000,
  });
  return rows.map(toProducto);
}

export async function getProductosInventarioPage({
  page = 1,
  pageSize = 20,
  busqueda,
}: {
  page?: number;
  pageSize?: number;
  busqueda?: string;
}): Promise<{ items: ProductoInventarioDTO[]; total: number }> {
  const filter = busqueda?.trim()
    ? {
        OR: [
          { nombre: { contains: busqueda, mode: "insensitive" as const } },
          { codigo: { contains: busqueda } },
          { barcode: { contains: busqueda } },
        ],
      }
    : undefined;
  const [rows, total] = await Promise.all([
    prisma.producto.findMany({
      where: filter,
      orderBy: [{ nombre: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.producto.count({ where: filter }),
  ]);
  return { items: rows.map(toProducto), total };
}

export async function getProducto(
  id: string,
): Promise<(ProductoInventarioDTO & { stock_depositos: StockDepositoDTO[] }) | null> {
  const row = await prisma.producto.findUnique({
    where: { id },
    include: {
      productosDepositos: {
        include: { deposito: true },
        orderBy: { deposito: { nombre: "asc" } },
      },
    },
  });
  if (!row) return null;
  return {
    ...toProducto(row),
    stock_depositos: row.productosDepositos.map((pd) => ({
      id: pd.id,
      producto_id: pd.producto_id,
      producto_codigo: row.codigo,
      producto_nombre: row.nombre,
      deposito_id: pd.deposito_id,
      deposito_nombre: pd.deposito.nombre,
      stock: pd.stock,
    })),
  };
}

export async function crearProducto(data: CrearProductoInput): Promise<string> {
  const parsed = crearProductoSchema.parse(data);
  if (parsed.codigo) {
    const existente = await prisma.producto.findUnique({
      where: { codigo: parsed.codigo },
    });
    if (existente) throw new Error(`Ya existe un producto con el cÃ³digo ${parsed.codigo}`);
  }
  const p = await prisma.producto.create({
    data: {
      codigo: parsed.codigo || null,
      nombre: parsed.nombre,
      descripcion: parsed.descripcion || null,
      barcode: parsed.barcode || null,
      cate: parsed.cate || null,
      subcate: parsed.subcate || null,
      precio_base: parsed.precio_base,
      purchase_cost: parsed.purchase_cost,
      stock_minimo: parsed.stock_minimo ?? 3,
      stock_maximo: parsed.stock_maximo ?? 100,
      activo: parsed.activo ?? true,
    },
  });
  return p.id;
}

export async function actualizarProducto(
  id: string,
  data: ActualizarProductoInput,
): Promise<void> {
  const parsed = actualizarProductoSchema.parse(data);
  const patch: Record<string, unknown> = {};
  if (parsed.codigo !== undefined) patch.codigo = parsed.codigo || null;
  if (parsed.nombre !== undefined) patch.nombre = parsed.nombre;
  if (parsed.descripcion !== undefined)
    patch.descripcion = parsed.descripcion || null;
  if (parsed.barcode !== undefined) patch.barcode = parsed.barcode || null;
  if (parsed.cate !== undefined) patch.cate = parsed.cate || null;
  if (parsed.subcate !== undefined) patch.subcate = parsed.subcate || null;
  if (parsed.precio_base !== undefined) patch.precio_base = parsed.precio_base;
  if (parsed.purchase_cost !== undefined)
    patch.purchase_cost = parsed.purchase_cost;
  if (parsed.stock_minimo !== undefined) patch.stock_minimo = parsed.stock_minimo;
  if (parsed.stock_maximo !== undefined) patch.stock_maximo = parsed.stock_maximo;
  if (parsed.activo !== undefined) patch.activo = parsed.activo;

  await prisma.producto.update({ where: { id }, data: patch });
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DepÃ³sitos
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getDepositosInventario(): Promise<DepositoInventarioDTO[]> {
  const rows = await prisma.deposito.findMany({
    orderBy: { nombre: "asc" },
    take: 500,
  });
  return rows.map((d) => ({
    id: d.id,
    nombre: d.nombre,
    columna_stock: d.columna_stock,
    activo: d.activo,
    created_at: d.created_at.toISOString(),
  }));
}

export async function crearDeposito(data: CrearDepositoInput): Promise<string> {
  const parsed = crearDepositoSchema.parse(data);
  const existente = await prisma.deposito.findUnique({
    where: { columna_stock: parsed.columna_stock },
  });
  if (existente) {
    throw new Error(
      `Ya existe un depÃ³sito con la columna de stock ${parsed.columna_stock}`,
    );
  }
  const d = await prisma.deposito.create({
    data: {
      nombre: parsed.nombre,
      columna_stock: parsed.columna_stock,
      activo: parsed.activo ?? true,
    },
  });
  return d.id;
}

export async function actualizarDeposito(
  id: string,
  data: ActualizarDepositoInput,
): Promise<void> {
  const parsed = actualizarDepositoSchema.parse(data);
  const patch: Record<string, unknown> = {};
  if (parsed.nombre !== undefined) patch.nombre = parsed.nombre;
  if (parsed.columna_stock !== undefined)
    patch.columna_stock = parsed.columna_stock;
  if (parsed.activo !== undefined) patch.activo = parsed.activo;
  await prisma.deposito.update({ where: { id }, data: patch });
}

export async function eliminarDeposito(id: string): Promise<void> {
  const [prod, ajuste, ingreso, rma] = await Promise.all([
    prisma.productoDeposito.count({ where: { deposito_id: id } }),
    prisma.ajusteStock.count({ where: { deposito_id: id } }),
    prisma.ingresoStockCompra.count({ where: { deposito_id: id } }),
    prisma.rma.count({ where: { deposito_recepcion_id: id } }),
  ]);
  const usados = [
    prod > 0 ? `${prod} stock de producto` : null,
    ajuste > 0 ? `${ajuste} ajuste(s)` : null,
    ingreso > 0 ? `${ingreso} ingreso(s)` : null,
    rma > 0 ? `${rma} RMA(s)` : null,
  ].filter(Boolean);
  if (usados.length > 0) {
    throw new Error(
      `No se puede eliminar el depÃ³sito: estÃ¡ vinculado a ${usados.join(", ")}. DesactÃ­velo en su lugar.`,
    );
  }
  await prisma.deposito.delete({ where: { id } });
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Stock por depÃ³sito
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getStockPorDeposito(
  depositoId?: string,
): Promise<StockDepositoDTO[]> {
  const rows = await prisma.productoDeposito.findMany({
    where: depositoId ? { deposito_id: depositoId } : undefined,
    include: { producto: true, deposito: true },
    orderBy: { producto: { nombre: "asc" } },
    take: 1000,
  });
  return rows.map((pd) => ({
    id: pd.id,
    producto_id: pd.producto_id,
    producto_codigo: pd.producto.codigo,
    producto_nombre: pd.producto.nombre,
    deposito_id: pd.deposito_id,
    deposito_nombre: pd.deposito.nombre,
    stock: Number(pd.stock ?? 0),
  }));
}

export async function getStockPorDepositoPage({
  page = 1,
  pageSize = 20,
  depositoId,
  busqueda,
}: {
  page?: number;
  pageSize?: number;
  depositoId?: string;
  busqueda?: string;
}): Promise<{ items: StockDepositoDTO[]; total: number }> {
  const where: Record<string, unknown> = {};
  if (depositoId) where.deposito_id = depositoId;
  if (busqueda?.trim()) {
    where.OR = [
      { producto: { nombre: { contains: busqueda, mode: "insensitive" as const } } },
      { producto: { codigo: { contains: busqueda } } },
    ];
  }
  const [rows, total] = await Promise.all([
    prisma.productoDeposito.findMany({
      where,
      include: { producto: true, deposito: true },
      orderBy: { producto: { nombre: "asc" } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.productoDeposito.count({ where }),
  ]);
  return {
    items: rows.map((pd) => ({
      id: pd.id,
      producto_id: pd.producto_id,
      producto_codigo: pd.producto.codigo,
      producto_nombre: pd.producto.nombre,
      deposito_id: pd.deposito_id,
      deposito_nombre: pd.deposito.nombre,
      stock: Number(pd.stock ?? 0),
    })),
    total,
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Ajustes de stock
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function getNextAjusteNumber(
  caller: { $queryRaw<U>(q: TemplateStringsArray, ...v: unknown[]): Promise<U> },
): Promise<string> {
  const year = new Date().getFullYear();
  return numeroAjusteSecuencia(
    year,
    await getNextNumero(caller, "ajuste", year),
  );
}

export async function getAjustesStock(): Promise<AjusteDTO[]> {
  const rows = await prisma.ajusteStock.findMany({
    include: {
      deposito: true,
      items: { include: { producto: true } },
    },
    orderBy: [{ created_at: "desc" }],
    take: 500,
  });
  return rows.map(toAjuste);
}

export async function getAjusteStock(id: string): Promise<AjusteDTO | null> {
  const row = await prisma.ajusteStock.findUnique({
    where: { id },
    include: {
      deposito: true,
      items: { include: { producto: true } },
    },
  });
  return row ? toAjuste(row) : null;
}

export async function crearAjusteStock(
  data: CrearAjusteStockInput,
  usuario: { id: string; nombre: string },
): Promise<string> {
  const parsed = crearAjusteStockSchema.parse(data);

  return prisma.$transaction(async (tx) => {
    const deposito = await tx.deposito.findUnique({
      where: { id: parsed.deposito_id },
    });
    if (!deposito) throw new Error("DepÃ³sito no encontrado");

    const productoIds = [...new Set(parsed.items.map((i) => i.producto_id))];
    const productos = await tx.producto.findMany({
      where: { id: { in: productoIds } },
    });
    if (productos.length !== productoIds.length) {
      throw new Error("Uno o mÃ¡s productos no existen");
    }

    const numero = await getNextAjusteNumber(tx);
    const ajuste = await tx.ajusteStock.create({
      data: {
        numero_ajuste: numero,
        deposito_id: deposito.id,
        fecha: new Date(`${parsed.fecha}T00:00:00`),
        tipo: parsed.tipo,
        motivo: parsed.motivo,
        estado: "pendiente",
        usuario_id: usuario.id,
      },
    });

    const itemsConStockActual: {
      producto_id: string;
      stock_actual: number;
      stock_nuevo: number;
      diferencia: number;
    }[] = [];

    for (const item of parsed.items) {
      const pd = await tx.productoDeposito.findUnique({
        where: {
          producto_id_deposito_id: {
            producto_id: item.producto_id,
            deposito_id: deposito.id,
          },
        },
      });
      const stockActual = pd?.stock ?? 0;
      const stockNuevo = item.stock_nuevo;
      itemsConStockActual.push({
        producto_id: item.producto_id,
        stock_actual: stockActual,
        stock_nuevo: stockNuevo,
        diferencia: diferenciaStock(stockNuevo, stockActual),
      });
    }

    await tx.ajusteStockItem.createMany({
      data: itemsConStockActual.map((it) => ({
        ajuste_id: ajuste.id,
        producto_id: it.producto_id,
        stock_actual: it.stock_actual,
        stock_nuevo: it.stock_nuevo,
        diferencia: it.diferencia,
      })),
    });

    return ajuste.id;
  });
}

export async function aprobarAjusteStock(
  id: string,
  usuario: { id: string; nombre: string; rol?: string },
): Promise<void> {
  // OperaciÃ³n crÃ­tica: idempotencia (doble click = Ã©xito-no-op), lock FOR
  // UPDATE, validaciÃ³n de transiciÃ³n pendienteâ†’aprobada y evento outbox,
  // todo atÃ³mico en Serializable con reintento ante P2034.
  await ejecutarOperacionCritica(
    "ajuste_stock",
    "ajuste.aprobado",
    generarClaveOperacionCritica("ajuste_stock", "aprobar", id),
    id,
    (estadoActual) =>
      estadoActual === "pendiente"
        ? { valido: true }
        : {
            valido: false,
            error: "Solo los ajustes pendientes pueden aprobarse",
          },
    async (tx) => {
      const ajusteCompleto = await tx.ajusteStock.findUnique({
        where: { id },
        include: { items: true, deposito: true },
      });
      if (!ajusteCompleto) throw new Error("Ajuste no encontrado");

      for (const item of ajusteCompleto.items) {
        // Se recalcula la diferencia contra el stock REAL del depÃ³sito al momento
        // de aprobar (no el stock_actual capturado al crear el ajuste).
        const pd = await tx.productoDeposito.findUnique({
          where: {
            producto_id_deposito_id: {
              producto_id: item.producto_id,
              deposito_id: ajusteCompleto.deposito_id,
            },
          },
        });
        const stockReal = Number(pd?.stock ?? 0);
        const delta = item.stock_nuevo - stockReal;
        if (delta === 0) continue;

        const resultado = await setStockDeposito(
          tx,
          item.producto_id,
          ajusteCompleto.deposito_id,
          item.stock_nuevo,
        );

        const producto = await tx.producto.findUnique({
          where: { id: item.producto_id },
        });

        await tx.movimientoInventario.create({
          data: {
            tipo: "ajuste",
            producto_id: item.producto_id,
            producto_nombre: producto?.nombre ?? null,
            producto_codigo: producto?.codigo ?? null,
            cantidad: Math.abs(delta),
            stock_anterior: resultado.total_anterior,
            stock_nuevo: resultado.total_nuevo,
            deposito_destino: delta > 0 ? ajusteCompleto.deposito.nombre : null,
            deposito_origen: delta < 0 ? ajusteCompleto.deposito.nombre : null,
            referencia: ajusteCompleto.numero_ajuste,
            motivo: `${ajusteCompleto.tipo} - ${ajusteCompleto.motivo}`,
            observaciones:
              delta > 0
                ? "Ajuste de entrada aprobado"
                : "Ajuste de salida aprobado",
            usuario_nombre: usuario.nombre ?? "Admin",
          },
        });
      }

      await tx.ajusteStock.update({
        where: { id },
        data: { estado: "aprobado", aprobado_por: usuario.id, aprobado_at: new Date() },
      });

      return { entidadId: id, tipoEventoOutbox: "ajuste.aprobado" };
    },
    {
      actorId: usuario.id,
      actorNombre: usuario.nombre,
      actorRol: usuario.rol ?? "sistema",
    },
  );
}

export async function rechazarAjusteStock(
  id: string,
  usuario: { id: string; nombre: string },
): Promise<void> {
  return prisma.$transaction(async (tx) => {
    const ajuste = await bloquearFila<{ id: string; estado: string }>(
      tx,
      "ajuste_stock",
      id,
    );
    if (!ajuste) throw new Error("Ajuste no encontrado");
    if (ajuste.estado !== "pendiente") {
      throw new Error("Solo los ajustes pendientes pueden rechazarse");
    }
    await tx.ajusteStock.update({
      where: { id },
      data: { estado: "rechazado", aprobado_por: usuario.id, aprobado_at: new Date() },
    });
  });
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Transferencias entre depÃ³sitos
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getSerialesDisponibles(): Promise<SerieDisponibleDTO[]> {
  const rows = await prisma.productoSerie.findMany({
    where: { activo: true },
    select: {
      id: true,
      producto_id: true,
      serial: true,
      deposito: true,
      activo: true,
    },
    orderBy: [{ producto_id: "asc" }, { serial: "asc" }],
    take: 10000,
  });
  return rows.map((s) => ({
    id: s.id,
    producto_id: s.producto_id,
    serial: s.serial,
    deposito: s.deposito,
    activo: s.activo,
  }));
}

/**
 * Transfiere stock entre dos depÃ³sitos. AtÃ³mica:
 * - decrementa el stock del depÃ³sito origen (con `SELECT ... FOR UPDATE`),
 * - incrementa el stock del depÃ³sito destino,
 * - mueve los seriales (si se indican) a `productos_series.deposito` destino,
 * - registra un `movimientos_inventario` tipo `transferencia` por Ã­tem.
 * Sin tabla dedicada (replica el doc Â§9 / legacy: solo movimientos + series).
 */
export async function transferirStock(
  data: CrearTransferenciaInput,
  usuario: { id: string; nombre: string },
): Promise<TransferenciaResultDTO> {
  const parsed = crearTransferenciaSchema.parse(data);

  return prisma.$transaction(async (tx) => {
    // Secuencial: mismas queries comparten el cliente de la tx (pg deprecÃ³
    // query() concurrente sobre un cliente ocupado).
    const origen = await tx.deposito.findUnique({ where: { id: parsed.deposito_origen_id } });
    const destino = await tx.deposito.findUnique({ where: { id: parsed.deposito_destino_id } });
    if (!origen) throw new Error("DepÃ³sito origen no encontrado");
    if (!destino) throw new Error("DepÃ³sito destino no encontrado");
    if (!origen.activo || !destino.activo) {
      throw new Error("Ambos depÃ³sitos deben estar activos");
    }

    for (const item of parsed.items) {
      const producto = await tx.producto.findUnique({
        where: { id: item.producto_id },
      });
      if (!producto) {
        throw new Error("Uno o mÃ¡s productos no existen");
      }

      if (item.seriales.length > 0) {
        if (item.seriales.length !== item.cantidad) {
          throw new Error(
            `El producto ${producto.nombre} requiere ${item.cantidad} serial(es) pero se seleccionaron ${item.seriales.length}`,
          );
        }
        const seriales = await tx.productoSerie.findMany({
          where: { id: { in: item.seriales }, producto_id: item.producto_id },
        });
        if (seriales.length !== item.seriales.length) {
          throw new Error(
            `Uno o mÃ¡s seriales no pertenecen al producto ${producto.nombre}`,
          );
        }
        for (const s of seriales) {
          if (s.activo === false) {
            throw new Error(`El serial ${s.serial} estÃ¡ inactivo`);
          }
          if ((s.deposito ?? "") !== origen.nombre) {
            throw new Error(
              `El serial ${s.serial} no estÃ¡ en el depÃ³sito ${origen.nombre}`,
            );
          }
        }
      }

      const origenStock = await tx.productoDeposito.findUnique({
        where: {
          producto_id_deposito_id: {
            producto_id: item.producto_id,
            deposito_id: origen.id,
          },
        },
      });
      const disponible = Number(origenStock?.stock ?? 0);
      if (disponible < item.cantidad) {
        throw new Error(
          `Stock insuficiente en ${origen.nombre} para ${producto.nombre} (disponible ${disponible}, requerido ${item.cantidad})`,
        );
      }

      // decrementarStockDeposito re-valida el stock dentro del lock
      // (dos transferencias concurrentes no pueden mover las mismas unidades).
      const salida = await decrementarStockDeposito(
        tx,
        item.producto_id,
        origen.id,
        item.cantidad,
      );
      await incrementarStockDeposito(tx, item.producto_id, destino.id, item.cantidad);

      if (item.seriales.length > 0) {
        await tx.productoSerie.updateMany({
          where: { id: { in: item.seriales } },
          data: { deposito: destino.nombre },
        });
      }

      await tx.movimientoInventario.create({
        data: {
          tipo: "transferencia",
          producto_id: item.producto_id,
          producto_nombre: producto.nombre,
          producto_codigo: producto.codigo,
          cantidad: item.cantidad,
          stock_anterior: salida.total_anterior,
          stock_nuevo: salida.total_nuevo,
          deposito_origen: origen.nombre,
          deposito_destino: destino.nombre,
          referencia: "-",
          motivo: parsed.motivo || "Transferencia entre depÃ³sitos",
          observaciones: `Transferencia de ${origen.nombre} a ${destino.nombre}`,
          usuario_nombre: usuario.nombre ?? "Admin",
        },
      });
    }

    return { movimientos: parsed.items.length };
  });
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Movimientos de inventario
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getMovimientosInventario(filtro?: {
  tipo?: string;
  busqueda?: string;
}): Promise<MovimientoInventarioDTO[]> {
  const rows = await prisma.movimientoInventario.findMany({
    where: filtro?.tipo && filtro.tipo !== "todos"
      ? { tipo: filtro.tipo as TipoMovimientoInventario }
      : undefined,
    orderBy: [{ created_at: "desc" }],
    take: 1000,
  });
  const filtrados = filtro?.busqueda?.trim()
    ? rows.filter(
        (r) =>
          r.producto_nombre?.toLowerCase().includes(filtro.busqueda!.toLowerCase()) ||
          r.producto_codigo?.toLowerCase().includes(filtro.busqueda!.toLowerCase()) ||
          r.referencia?.toLowerCase().includes(filtro.busqueda!.toLowerCase()),
      )
    : rows;
  return filtrados.map((r) => ({
    id: r.id,
    tipo: r.tipo as string,
    producto_id: r.producto_id,
    producto_nombre: r.producto_nombre,
    producto_codigo: r.producto_codigo,
    cantidad: Number(r.cantidad ?? 0),
    stock_anterior: Number(r.stock_anterior ?? 0),
    stock_nuevo: Number(r.stock_nuevo ?? 0),
    deposito_origen: r.deposito_origen,
    deposito_destino: r.deposito_destino,
    referencia: r.referencia,
    motivo: r.motivo,
    observaciones: r.observaciones,
    usuario_nombre: r.usuario_nombre,
    created_at: r.created_at.toISOString(),
  }));
}

export async function getMovimientosInventarioPage({
  page = 1,
  pageSize = 20,
  tipo,
  busqueda,
}: {
  page?: number;
  pageSize?: number;
  tipo?: string;
  busqueda?: string;
}): Promise<{ items: MovimientoInventarioDTO[]; total: number }> {
  const where: Record<string, unknown> = {};
  if (tipo && tipo !== "todos") where.tipo = tipo;
  if (busqueda?.trim()) {
    where.OR = [
      { producto_nombre: { contains: busqueda, mode: "insensitive" as const } },
      { producto_codigo: { contains: busqueda } },
      { referencia: { contains: busqueda } },
    ];
  }
  const [rows, total] = await Promise.all([
    prisma.movimientoInventario.findMany({
      where,
      orderBy: [{ created_at: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.movimientoInventario.count({ where }),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      tipo: r.tipo as string,
      producto_id: r.producto_id,
      producto_nombre: r.producto_nombre,
      producto_codigo: r.producto_codigo,
      cantidad: Number(r.cantidad ?? 0),
      stock_anterior: Number(r.stock_anterior ?? 0),
      stock_nuevo: Number(r.stock_nuevo ?? 0),
      deposito_origen: r.deposito_origen,
      deposito_destino: r.deposito_destino,
      referencia: r.referencia,
      motivo: r.motivo,
      observaciones: r.observaciones,
      usuario_nombre: r.usuario_nombre,
      created_at: r.created_at.toISOString(),
    })),
    total,
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Resumen para el Ã­ndice
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getResumenInventario(): Promise<ResumenInventarioDTO> {
  const [totalProductos, productosActivos, totalDepositos, ajustesPendientes, stock, bajoMinimo] =
    await Promise.all([
      prisma.producto.count(),
      prisma.producto.count({ where: { activo: true } }),
      prisma.deposito.count({ where: { activo: true } }),
      prisma.ajusteStock.count({ where: { estado: "pendiente" } }),
      prisma.producto.aggregate({ _sum: { stock_total: true } }),
      prisma.$queryRaw<{ cnt: number }[]>`
        SELECT COUNT(*)::INT AS cnt FROM productos
        WHERE stock_total < COALESCE(stock_minimo, 0)
      `,
    ]);

  return {
    total_productos: totalProductos,
    productos_activos: productosActivos,
    total_depositos: totalDepositos,
    bajo_minimo: Number(bajoMinimo[0]?.cnt ?? 0),
    stock_total: Number(stock._sum.stock_total ?? 0),
    ajustes_pendientes: ajustesPendientes,
  };
}