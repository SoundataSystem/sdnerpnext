import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const SCHEMA_RE = /^[a-z_][a-z0-9_]*$/;

/** Lee el parámetro `?schema=` de la URL de conexión (si existe). */
function getSchemaFromUrl(url: string): string | undefined {
  try {
    const schema = new URL(url).searchParams.get("schema");
    return schema && SCHEMA_RE.test(schema) ? schema : undefined;
  } catch {
    return undefined;
  }
}

function createPrismaClient() {
  // Si DATABASE_URL no está, el adapter lanzará en la primera query (no en el constructor),
  // lo que permite que el safe() del dashboard lo capture correctamente.
  const connectionString = process.env.DATABASE_URL ?? "";
  const schema = getSchemaFromUrl(connectionString);

  // Los queries crudos ($queryRaw/$executeRawUnsafe) usan nombres sin calificar, por
  // lo que no los alcanza el `schema` del adapter. El search_path se fija vía
  // opción de arranque de conexión (`options`), NO con un query en el evento
  // 'connect': ese SET competía con la primera query del adapter sobre el mismo
  // cliente y disparaba el DeprecationWarning de pg ("client is already
  // executing a query", se rompe en pg@9). Verificado contra el pooler 6543 y
  // el directo 5432 de Supabase. El nombre de esquema ya fue validado arriba.
  // El pooler de Supabase exige TLS (sin `ssl` la transaction pooler rechaza la clave).
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    ...(schema ? { options: `-c search_path=${schema},public,extensions` } : {}),
  });

  const adapter = new PrismaPg(pool, { schema });

  // Timeout de transacciones interactivas configurable (las pesadas, p. ej. crear_orden
  // con ~20 queries contra una DB remota, pueden superar el default de 5000 ms).
  const txTimeout = Number(process.env.PRISMA_TX_TIMEOUT_MS ?? 0) || undefined;

  return new PrismaClient({
    adapter,
    transactionOptions:
      txTimeout !== undefined
        ? { timeout: txTimeout, maxWait: txTimeout }
        : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}