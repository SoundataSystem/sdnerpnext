/**
 * Diagnóstico BD: reproducción del insert de producto y sus duplicados.
 * Uso: npx tsx scripts/diag-crear-producto.mts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const schema = process.env.DIRECT_SCHEMA ?? process.env.DB_SCHEMA ?? "public";
const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  max: 2,
  options: `-c search_path=${schema},public`,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function crear(data: Record<string, unknown>) {
  return prisma.producto.create({ data: data as never });
}

async function main() {
  const sufijo = Date.now().toString().slice(-6);
  const borrar: string[] = [];

  console.log("── (1) Creación normal ──");
  try {
    const p = await crear({
      nombre: `DIAG_TEST_${sufijo}`,
      precio_base: 0,
      purchase_cost: 0,
      stock_minimo: 3,
      stock_maximo: 100,
      activo: true,
    });
    borrar.push(p.id);
    console.log("OK:", p.id);
  } catch (e) {
    console.error("FALLO creación normal →", (e as Error).message.slice(0, 400));
  }

  console.log("── (2) Código duplicado ──");
  try {
    const dup = await prisma.producto.findFirst({
      where: { codigo: { not: null } },
      select: { codigo: true },
    });
    await crear({
      nombre: `DIAG_DUP_${sufijo}`,
      codigo: dup?.codigo ?? "X",
      precio_base: 0,
      purchase_cost: 0,
    });
    console.log("OJO: permitió código duplicado (¿sin unique en DB?)");
  } catch (e) {
    const err = e as { code?: string; message: string };
    console.log(`code=${err.code} →`, err.message.slice(0, 160));
  }

  console.log("── (3) Barcode repetido ──");
  try {
    const b = `DIAG_BAR_${sufijo}`;
    const p1 = await crear({
      nombre: `DIAG_B1_${sufijo}`,
      barcode: b,
      precio_base: 0,
      purchase_cost: 0,
    });
    borrar.push(p1.id);
    try {
      const p2 = await crear({
        nombre: `DIAG_B2_${sufijo}`,
        barcode: b,
        precio_base: 0,
        purchase_cost: 0,
      });
      borrar.push(p2.id);
      console.log("segundo OK (barcode SIN unique):", p2.id);
    } catch (e) {
      const err = e as { code?: string; message: string };
      console.log(`barcode único en DB → code=${err.code}`);
    }
  } catch (e) {
    console.error("bloque 3 →", (e as Error).message.slice(0, 300));
  }

  for (const id of borrar) {
    await prisma.producto.delete({ where: { id } });
  }
  console.log("── Limpieza hecha ──");
  await pool.end();
}

void main();
