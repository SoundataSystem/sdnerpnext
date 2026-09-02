import "server-only";
import type { Prisma } from "@/generated/prisma/client";

export type TxClient = Prisma.TransactionClient;

// Allowlist entidad → tabla física (mapa @@map del schema). Evita inyección
// de identificadores: la entidad es un literal TypeScript, no input del usuario.
const TABLAS = {
  orden: "ordenes",
  orden_compra: "ordenes_compra",
  caja_movimiento: "caja_movimientos",
  cuenta_pagar: "cuentas_pagar",
  cuenta_cobrar: "cuentas_cobrar",
  recepcion_compra: "recepciones_compra",
  ajuste_stock: "ajustes_stock",
  devolucion_venta: "devoluciones_ventas",
  devolucion_compra: "devoluciones_compra",
  rma: "rmas",
  orden_servicio: "ordenes_servicio",
  garantia: "garantias",
  pago_proveedor: "pagos_proveedores",
} as const;

export type EntidadBloqueable = keyof typeof TABLAS;

/**
 * Bloquea una fila por PK (`SELECT ... FOR UPDATE`) dentro de la transacción.
 * Serializa operaciones concurrentes sobre la misma entidad (stock, dinero,
 * facturación, recepciones): la segunda espera y relee el estado ya commiteado.
 * El lock se libera al commit/rollback de la transacción.
 * Devuelve la fila bloqueada (todas las columnas) o null si no existe.
 */
export async function bloquearFila<T extends Record<string, unknown>>(
  tx: TxClient,
  entidad: EntidadBloqueable,
  id: string,
): Promise<T | null> {
  const tabla = TABLAS[entidad];
  const rows = await tx.$queryRawUnsafe<T[]>(
    `SELECT * FROM ${tabla} WHERE id = $1::uuid FOR UPDATE`,
    id,
  );
  return rows[0] ?? null;
}
