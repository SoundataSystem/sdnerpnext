/**
 * Script de diagnostico de conexion a la base de datos.
 *
 * Lee la cadena de conexion de la variable de entorno DATABASE_URL.
 * NO incrusta credenciales en el codigo fuente.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node scripts/check-db.mjs
 *
 * Tambien puede usar un archivo .env automaticamente si lo carga
 * el entorno (por ejemplo con `dotenv` o pasandolo en el comando).
 */
import pg from "pg";

const cs = process.env.DATABASE_URL;

if (!cs) {
  console.error(
    "ERROR: Falta DATABASE_URL. Definila como variable de entorno o pasala:\n" +
      '  DATABASE_URL="postgresql://..." node scripts/check-db.mjs',
  );
  process.exit(1);
}

// Ocultar credenciales al imprimir el host
const safeHost = (cs.split("@")[1] ?? "desconocido").split("/")[0];

try {
  const c = new pg.Client({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
  });
  await c.connect();
  try {
    const r = await c.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    );
    console.log(
      "OK",
      safeHost,
      "tablas:",
      r.rows.map((x) => x.tablename).join(", ") || "(ninguna)",
    );
  } catch (e) {
    console.log("OK conn, pero query:", e.message);
  }
  await c.end();
} catch (e) {
  console.log("FAIL", safeHost, "->", e.message);
}
