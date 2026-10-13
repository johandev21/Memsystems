import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

if (!process.env.DATABASE_URL) {
  dotenv.config({ path: ".env.test" });
}

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
  },
});
