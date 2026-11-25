import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));


const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Microphone is allowed only for this origin (explicit user activation still required by the browser).
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
];

/** @type {import("next").NextConfig} */
const nextConfig = {
  // Pin the workspace root: a stray package-lock.json in a parent folder (e.g. C:\\Users\\you)
  // otherwise makes Next watch the whole home directory.
  outputFileTracingRoot: projectRoot,
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
