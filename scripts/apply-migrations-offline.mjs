// Fallback for networks that block Prisma's schema-engine download.
// Applies prisma/migrations/*/migration.sql directly with better-sqlite3.
// Prefer `npx prisma migrate deploy` whenever it works.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

const url = process.argv[2] ?? process.env.DATABASE_URL ?? "file:./dev.db";
const file = url.replace(/^file:/, "");
if (fs.existsSync(file)) fs.rmSync(file);
const db = new Database(file);
const dir = "prisma/migrations";
for (const m of fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory()).sort()) {
  db.exec(fs.readFileSync(path.join(dir, m, "migration.sql"), "utf8"));
  console.log("applied", m, "->", file);
}
db.close();
