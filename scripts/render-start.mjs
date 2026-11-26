// Production start (Render): check config, apply migrations, seed ONLY an empty database, start Next.js.
// The old start command ran `npm run setup` (migrate + seed) on every boot; the seed wipes all
// tables, so every restart/wake erased registered users and invalidated sessions.
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import "dotenv/config";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const file = url.replace(/^file:/, "");
const run = (cmd) => execSync(cmd, { stdio: "inherit", env: process.env });

const warn = (m) => console.error(`\n[config] WARNING: ${m}\n`);
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) warn("SESSION_SECRET is missing or shorter than 16 characters — sign-in and registration will be refused.");
if (!process.env.VOICE_AGENT_SHARED_SECRET) warn("VOICE_AGENT_SHARED_SECRET is not set — Sarvam voice and Studio voice are disabled.");
if (!process.env.VOICE_AGENT_URL) warn("VOICE_AGENT_URL is not set — the app will look for the voice agent on localhost.");

fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
run("npx prisma migrate deploy");

const db = new Database(file, { readonly: true });
const { n } = db.prepare('SELECT COUNT(*) AS n FROM "User"').get();
db.close();
if (n === 0) {
  console.log("[db] Empty database: seeding sample accounts");
  run("npx tsx prisma/seed.ts");
} else {
  console.log(`[db] ${n} users found: keeping existing data (no re-seed)`);
}

const port = process.env.PORT ?? "3000";
const next = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", port], { stdio: "inherit", env: process.env });
next.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => next.kill(sig));
