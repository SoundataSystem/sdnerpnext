import path from "path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: path.join(process.cwd(), ".env") });

function addSchema(url, schema) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}schema=${schema}`;
}

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DIRECT_URL/DATABASE_URL en .env");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query(`CREATE SCHEMA IF NOT EXISTS test`);
  console.log("Esquema 'test' listo.");
  console.log("TEST_URL=" + addSchema(url, "test"));
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
