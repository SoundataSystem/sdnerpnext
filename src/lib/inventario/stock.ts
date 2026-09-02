import "server-only";
import { Prisma } from "@/generated/prisma/client";

export type TxClient = Prisma.TransactionClient;

const IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;

const LEGACY_STOCK_COLUMNS = [
  "almacen1",
  "almacen2",
  "almacen3",
  "almacen4",
  "almacen5",
  "almacen6",
  "almacen7",
  "almacen8",
  "stock_copaco",
  "stock_espana",
  "stock_eusebio_ayala",
  "stock_faltantes",
  "stock_faltantes_espana",
  "stock_juan_del_castillo",
  "stock_local_18",
  "stock_obsoletos",
  "stock_regalos",
  "stock_rma",
  "stock_servicio_tec_vans",
  "stock_servicio_tecnico",
  "stock_salon_espana",
  "stock_salon_ventas",
  "stock_soundata",
  "stock_subsuelo",
  "stock_uso_interno_espana",
  "stock_vidriera_a3c",
] as const;

type LegacyStockColumn = (typeof LEGACY_STOCK_COLUMNS)[number];

export interface StockResult {
  stock_deposito: number;
  total_anterior: number;
  total_nuevo: number;
}

export interface DepositoRef {
  id: string;
  nombre: string;
}

function validarIdentificador(columna: string): string {
  if (!IDENTIFIER_RE.test(columna)) {
    throw new Error(`Identificador de columna de stock inválido: ${columna}`);
  }
  return columna;
}

async function columnaExiste(tx: TxClient, columna: LegacyStockColumn): Promise<boolean> {
  const res = await tx.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'productos' AND column_name = ${columna}
    ) AS exists
  `;
  return res[0]?.exists ?? false;
}

function buildLegacySumSql(): string {
  return LEGACY_STOCK_COLUMNS.map((c) => `COALESCE("${c}", 0)`).join(" + ");
}

export async function recalcularStockTotal(
  tx: TxClient,
  productoId: string,
): Promise<number> {
  const agg = await tx.productoDeposito.aggregate({
    where: { producto_id: productoId },
    _sum: { stock: true },
    _count: { _all: true },
  });
  const total = Number(agg._sum.stock ?? 0);
  if (agg._count._all > 0) {
    await tx.producto.update({
      where: { id: productoId },
      data: { stock_total: total },
    });
    return total;
  }
  const legacy = await tx.$queryRaw<{ total: number }[]>`
    SELECT COALESCE(${Prisma.raw(buildLegacySumSql())}, 0)::NUMERIC AS total
    FROM productos
    WHERE id = ${productoId}::uuid
  `;
  const totalLegacy = Number(legacy[0]?.total ?? 0);
  await tx.producto.update({
    where: { id: productoId },
    data: { stock_total: totalLegacy },
  });
  return totalLegacy;
}

export async function sincronizarColumnaDeposito(
  tx: TxClient,
  productoId: string,
  depositoId: string,
): Promise<void> {
  const deposito = await tx.deposito.findUnique({ where: { id: depositoId } });
  if (!deposito?.columna_stock) return;
  const columna = validarIdentificador(deposito.columna_stock);
  if (!(await columnaExiste(tx, columna as LegacyStockColumn))) return;

  const pd = await tx.productoDeposito.findUnique({
    where: {
      producto_id_deposito_id: { producto_id: productoId, deposito_id: depositoId },
    },
  });
  const stock = Number(pd?.stock ?? 0);
  await tx.$executeRaw`
    UPDATE productos SET ${Prisma.raw(columna)} = ${stock}, updated_at = NOW() WHERE id = ${productoId}::uuid
  `;
}

async function obtenerTotalAnterior(tx: TxClient, productoId: string): Promise<number> {
  const agg = await tx.productoDeposito.aggregate({
    where: { producto_id: productoId },
    _sum: { stock: true },
    _count: { _all: true },
  });
  if (agg._count._all > 0) return Number(agg._sum.stock ?? 0);
  const legacy = await tx.$queryRaw<{ total: number }[]>`
    SELECT COALESCE(${Prisma.raw(buildLegacySumSql())}, 0)::NUMERIC AS total
    FROM productos
    WHERE id = ${productoId}::uuid
  `;
  return Number(legacy[0]?.total ?? 0);
}

export async function setStockDeposito(
  tx: TxClient,
  productoId: string,
  depositoId: string,
  stock: number,
): Promise<StockResult> {
  return modificarStockDeposito(
    tx,
    productoId,
    depositoId,
    Math.max(0, Math.trunc(stock)),
    null,
  );
}

export async function incrementarStockDeposito(
  tx: TxClient,
  productoId: string,
  depositoId: string,
  cantidad: number,
): Promise<StockResult> {
  return modificarStockDeposito(
    tx,
    productoId,
    depositoId,
    null,
    Math.trunc(cantidad),
  );
}

export async function decrementarStockDeposito(
  tx: TxClient,
  productoId: string,
  depositoId: string,
  cantidad: number,
): Promise<StockResult> {
  return modificarStockDeposito(
    tx,
    productoId,
    depositoId,
    null,
    -Math.trunc(cantidad),
  );
}

/**
 * Bloquea la fila de stock (SELECT ... FOR UPDATE) para evitar condiciones de
 * carrera entre operaciones concurrentes (ventas, ingresos, devoluciones,
 * ajustes). El lock se mantiene hasta el commit de la transacción.
 */
async function lockStockDeposito(
  tx: TxClient,
  productoId: string,
  depositoId: string,
): Promise<number | null> {
  const rows = await tx.$queryRaw<{ stock: number }[]>`
    SELECT stock::INTEGER AS stock
    FROM productos_depositos
    WHERE producto_id = ${productoId}::uuid
      AND deposito_id = ${depositoId}::uuid
    FOR UPDATE
  `;
  return rows.length > 0 ? Number(rows[0].stock) : null;
}

async function upsertStockDeposito(
  tx: TxClient,
  productoId: string,
  depositoId: string,
  stock: number,
): Promise<void> {
  await tx.productoDeposito.upsert({
    where: {
      producto_id_deposito_id: { producto_id: productoId, deposito_id: depositoId },
    },
    create: { producto_id: productoId, deposito_id: depositoId, stock },
    update: { stock },
  });
}

async function modificarStockDeposito(
  tx: TxClient,
  productoId: string,
  depositoId: string,
  valorAbsoluto: number | null,
  delta: number | null,
): Promise<StockResult> {
  let actual = await lockStockDeposito(tx, productoId, depositoId);
  if (actual === null) {
    // La fila aún no existe: se crea bajo la constraint única. Si otra
    // transacción concurrente ya la creó, se reintenta el lock.
    try {
      await upsertStockDeposito(tx, productoId, depositoId, 0);
      actual = 0;
    } catch {
      actual = (await lockStockDeposito(tx, productoId, depositoId)) ?? 0;
    }
  }

  let nuevoStock: number;
  if (delta !== null) {
    nuevoStock = actual + delta;
    if (nuevoStock < 0) {
      throw new Error(
        `Stock insuficiente en el depósito para el producto solicitado`,
      );
    }
  } else {
    nuevoStock = valorAbsoluto ?? actual;
  }

  const totalAnterior = await obtenerTotalAnterior(tx, productoId);
  await upsertStockDeposito(tx, productoId, depositoId, nuevoStock);
  await sincronizarColumnaDeposito(tx, productoId, depositoId);
  const totalNuevo = await recalcularStockTotal(tx, productoId);

  return {
    stock_deposito: nuevoStock,
    total_anterior: totalAnterior,
    total_nuevo: totalNuevo,
  };
}

export async function getDepositoConStock(
  tx: TxClient,
  productoId: string,
  minimo: number,
): Promise<DepositoRef | null> {
  const pd = await tx.productoDeposito.findMany({
    where: { producto_id: productoId, stock: { gte: Math.trunc(minimo) } },
    orderBy: { stock: "desc" },
    include: { deposito: true },
    take: 1,
  });
  const row = pd[0];
  if (!row) return null;
  return { id: row.deposito_id, nombre: row.deposito.nombre };
}

export async function getDepositoRestitucion(
  tx: TxClient,
  productoId: string,
): Promise<DepositoRef | null> {
  const pd = await tx.productoDeposito.findMany({
    where: { producto_id: productoId, stock: { gt: 0 } },
    orderBy: { stock: "desc" },
    include: { deposito: true },
    take: 1,
  });
  if (pd[0]) return { id: pd[0].deposito_id, nombre: pd[0].deposito.nombre };
  const deposito = await tx.deposito.findFirst({
    where: { activo: true },
    orderBy: { created_at: "asc" },
    take: 1,
  });
  return deposito ? { id: deposito.id, nombre: deposito.nombre } : null;
}
