import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/setup/server-only-stub.ts") } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/setup/global-setup.ts"],
    env: { DATABASE_URL: "file:./test.db", SESSION_SECRET: "test-secret-test-secret-test-secret" },
    fileParallelism: false,
  },
});
