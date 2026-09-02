/**
 * Diagnóstico: usuarios de public.usuarios sin auth_user_id (huérfanos)
 * y referencias FK que condicionan la decisión de link/eliminación.
 * Uso: npx tsx scripts/diag-usuarios-huerfanos.mts
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

async function main() {
  const usuarios = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      email: string;
      nombre: string;
      apellido: string | null;
      rol: string;
      activo: boolean | null;
      auth_user_id: string | null;
    }>
  >(`select id, email, nombre, apellido, rol, activo, auth_user_id
     from usuarios order by created_at asc`);

  console.log("=== USUARIOS EN public.usuarios ===");
  for (const u of usuarios) {
    console.log(
      `${u.email.padEnd(28)} rol=${(u.rol ?? "?").padEnd(14)} activo=${String(u.activo)} auth=${u.auth_user_id ?? "NULL"} id=${u.id}`,
    );
  }

  const huerfanos = usuarios.filter((u) => !u.auth_user_id);
  for (const u of huerfanos) {
    console.log(`\n=== REFERENCIAS DE ${u.email} (${u.id}) ===`);
    const tablas = [
      ["ordenes", "vendedor_id"],
      ["ordenes", "usuario_id"],
      ["caja_movimientos", "usuario_id"],
      ["log_auditoria", "usuario_id"],
      ["actividad_log", "usuario_id"],
      ["recepciones_compra", "usuario_recepcion_id"],
      ["ajustes_stock", "usuario_id"],
      ["devoluciones_venta", "usuario_id"],
      ["notificaciones", "usuario_id"],
    ] as const;
    for (const [tabla, col] of tablas) {
      try {
        const r = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
          `select count(*)::bigint as n from ${tabla} where ${col} = $1`,
          u.id,
        );
        const n = Number(r[0]?.n ?? 0);
        if (n > 0) console.log(`  ${tabla}.${col}: ${n}`);
      } catch {
        /* tabla/columna no existe en este esquema */
      }
    }
  }

  // ¿Existe algún admin FUNCIONAL (con auth)?
  const adminsConAuth = await prisma.$queryRawUnsafe<Array<{ email: string }>>(
    `select email from usuarios where rol = 'admin' and auth_user_id is not null`,
  );
  console.log("\n=== ADMINS CON AUTH USER (pueden loguear) ===");
  if (adminsConAuth.length === 0) console.log("  NINGUNO");
  else adminsConAuth.forEach((a) => console.log(`  ${a.email}`));

  // Emails ya presentes en Supabase Auth
  const authUsers = await prisma.$queryRawUnsafe<Array<{ email: string; id: string }>>(
    `select id::text as id, email from auth.users order by created_at asc`,
  );
  console.log("\n=== auth.users (Supabase Auth) ===");
  authUsers.forEach((a) => console.log(`  ${String(a.email).padEnd(28)} ${a.id}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
