// Configuración de Prisma CLI
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // DIRECT_URL = conexión directa a Postgres (para CLI: migrate/introspect)
    // En runtime (Vercel) el cliente usa la pooling de PgBouncer vía DATABASE_URL.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});