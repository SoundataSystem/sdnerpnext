import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const dir = path.join(process.cwd(), "prisma", "migrations");
const files = fs
  .readdirSync(dir)
  .filter((f) => fs.statSync(path.join(dir, f)).isDirectory())
  .sort()
  .map((d) => path.join(dir, d, "migration.sql"))
  .filter((f) => fs.existsSync(f));

const sql = files.map((f) => fs.readFileSync(f, "utf8")).join("\n\n");

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error("Falta DIRECT_URL/DATABASE_URL en .env");

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query("CREATE SCHEMA IF NOT EXISTS test");
await client.query("SET search_path TO test, public, extensions");
await client.query(sql);
console.log(`Aplicadas ${files.length} migraciones al esquema 'test'.`);
await client.end();
