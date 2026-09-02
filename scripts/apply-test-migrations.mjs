import { spawnSync } from "child_process";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error("Falta DIRECT_URL/DATABASE_URL en .env");
const sep = url.includes("?") ? "&" : "?";
const testUrl = `${url}${sep}schema=test`;

const res = spawnSync("npx.cmd", ["prisma", "migrate", "deploy"], {
  cwd: process.cwd(),
  env: { ...process.env, DIRECT_URL: testUrl },
  stdio: "inherit",
});
process.exit(res.status ?? 1);
