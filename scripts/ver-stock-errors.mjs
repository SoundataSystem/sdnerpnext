import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000, statement_timeout: 30000 });
await c.connect();
const imp = await c.query(
  `SELECT id, tipo, estado, filas_total, filas_ok, filas_warning, filas_error, created_at, log_detalle
   FROM importaciones_pegasus WHERE tipo IN ('stock','productos') ORDER BY created_at DESC LIMIT 4`,
);
for (const r of imp.rows) {
  console.log("=".repeat(70));
  console.log(`${r.tipo} | ${r.estado} | total ${r.filas_total} | ok ${r.filas_ok} | avisos ${r.filas_warning} | err ${r.filas_error} | ${r.created_at?.toISOString?.() ?? r.created_at}`);
  const det = r.log_detalle;
  const log = det && Array.isArray(det.log) ? det.log : [];
  const errs = log.filter((l) => l.includes("ERROR"));
  console.log(`errores en log (${errs.length}):`);
  for (const e of errs) console.log("   -", e.slice(0, 200));
}
await c.end();