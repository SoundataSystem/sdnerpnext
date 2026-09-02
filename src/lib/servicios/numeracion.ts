import { prisma } from "@/lib/prisma";
import { formatearCodigoGarantia } from "@/lib/servicios/garantias";
import { getNextNumero } from "@/lib/numeracion";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function getNextGarantiaNumber(tx: Tx): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await getNextNumero(tx, "garantia", year);
  return formatearCodigoGarantia(year, seq);
}
