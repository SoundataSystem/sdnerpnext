/**
 * Limpieza de usuarios huérfanos (sin auth_user_id y sin posibilidad de login).
 * Decisión documentada en AUDITORIA_FASE7.md §6.1:
 *  - admin@ovg.com: fila seed con UUID constante; existen 4 admins funcionales.
 *    Su única referencia es 1 notificación obsoleta (se elimina).
 *  - recepcion@test.com: rol 'nominal' (fuera del catálogo), cero referencias.
 * Uso: npx tsx --env-file=.env scripts/limpiar-usuarios-huerfanos.mts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  max: 2,
  options: "-c search_path=public",
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const HUERFANOS = [
  { email: "admin@ovg.com", id: "00000000-0000-0000-0000-000000000001" },
];

async function main() {
  for (const u of HUERFANOS) {
    const still = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `select count(*)::bigint as n from usuarios where id = $1 and auth_user_id is null`,
      u.id,
    );
    if (Number(still[0]?.n ?? 0) === 0) {
      console.log(`SKIP ${u.email}: ya no existe o tiene auth_user_id`);
      continue;
    }
    const del = await prisma.$executeRawUnsafe(
      `delete from notificaciones where usuario_id = $1`,
      u.id,
    );
    console.log(`notificaciones eliminadas para ${u.email}: ${del}`);
    await prisma.$executeRawUnsafe(`delete from usuarios where id = $1`, u.id);
    console.log(`eliminado: ${u.email}`);
  }

  // recepcion@test.com: se busca por email por si el UUID cambia entre ambientes.
  const rec = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `select id from usuarios where email = 'recepcion@test.com' and auth_user_id is null`,
  );
  if (rec.length > 0) {
    await prisma.$executeRawUnsafe(
      `delete from usuarios where email = 'recepcion@test.com' and auth_user_id is null`,
    );
    console.log("eliminado: recepcion@test.com");
  } else {
    console.log("SKIP recepcion@test.com: no encontrado o ya con auth");
  }

  const restantes = await prisma.$queryRawUnsafe<Array<{ email: string; auth_user_id: string | null }>>(
    `select email, auth_user_id from usuarios order by created_at asc`,
  );
  console.log("\n=== ESTADO FINAL ===");
  restantes.forEach((r) =>
    console.log(`  ${String(r.email).padEnd(28)} auth=${r.auth_user_id ?? "NULL"}`),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
