import { prisma } from "@/lib/prisma";

/**
 * Deja el esquema `test` vacío (TRUNCATE CASCADE sobre todas sus tablas).
 * Se invoca en `beforeEach` de cada suite de integración.
 */
export async function limpiarEsquema(): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'test'
    ORDER BY tablename
  `;
  if (rows.length === 0) return;
  const tablas = rows.map((r) => `test.${r.tablename}`).join(", ");
  // Retry: si un test anterior dejó una transacción con locks pendientes, el
  // TRUNCATE puede abortar por deadlock (40P01) hasta que esa transacción cierre.
  let lastError: unknown;
  for (let intento = 0; intento < 3; intento++) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tablas} CASCADE`);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw lastError;
}

export { prisma };
