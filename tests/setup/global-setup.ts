// Creates a fresh SQLite test database from the Prisma migrations and seeds it.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export default async function setup() {
  const file = path.resolve("test.db");
  if (fs.existsSync(file)) fs.rmSync(file);
  const db = new Database(file);
  const dir = path.resolve("prisma/migrations");
  for (const m of fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory()).sort()) {
    db.exec(fs.readFileSync(path.join(dir, m, "migration.sql"), "utf8"));
  }
  db.close();
  const { seed } = await import("../../prisma/seed");
  await seed("file:./test.db");
  return () => {
    if (fs.existsSync(file)) fs.rmSync(file);
  };
}
