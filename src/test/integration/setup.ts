import "dotenv/config";

// La suite de integración corre contra el esquema `test` de la misma instancia
// (deja `public` —datos pre-producción— intacto). Este setup se ejecuta antes
// de importar cualquier módulo de la app, así que el PrismaClient se crea con
// la URL del esquema `test`.
const base = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!base) {
  throw new Error(
    "Falta DIRECT_URL/DATABASE_URL en .env para los tests de integración",
  );
}
const sep = base.includes("?") ? "&" : "?";
process.env.DATABASE_URL = `${base}${sep}schema=test`;
// Las transacciones interactivas de los repositorios (crear_orden, cobro, etc.)
// hacen muchas queries contra una DB remota: se amplía el timeout por encima
// del default de 5000 ms para que la suite no falle por latencia.
process.env.PRISMA_TX_TIMEOUT_MS = "60000";
