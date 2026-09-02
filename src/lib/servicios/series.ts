import { prisma } from "@/lib/prisma";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type MarcarSerieVendidaResult = "vendida" | "no-registrada";

export async function marcarSerieVendida(
  tx: Tx,
  productoId: string,
  serial: string,
): Promise<MarcarSerieVendidaResult> {
  const s = serial.trim();
  if (!s) return "no-registrada";
  const filas = await tx.$queryRaw<{ id: string; activo: boolean | null }[]>`
    SELECT id, activo FROM productos_series
    WHERE producto_id = ${productoId}::uuid AND serial = ${s}
    FOR UPDATE
  `;
  if (filas.length === 0) return "no-registrada";
  const fila = filas[0];
  if (fila.activo === false) {
    throw new Error(`Serial ${s} ya fue vendido previamente`);
  }
  await tx.productoSerie.update({
    where: { id: fila.id },
    data: { activo: false },
  });
  return "vendida";
}

export async function reactivarSerie(
  tx: Tx,
  productoId: string,
  serial: string,
): Promise<boolean> {
  const s = serial.trim();
  if (!s) return false;
  const res = await tx.productoSerie.updateMany({
    where: { producto_id: productoId, serial: s, activo: false },
    data: { activo: true },
  });
  return res.count > 0;
}

export async function validarSerialAsociado(
  tx: Tx,
  productoId: string,
  serial: string,
): Promise<void> {
  const s = serial.trim();
  if (!s) return;
  const serie = await tx.productoSerie.findFirst({
    where: { serial: s },
    select: { producto_id: true },
  });
  if (serie && serie.producto_id !== productoId) {
    throw new Error(`El serial ${s} pertenece a otro producto`);
  }
}
