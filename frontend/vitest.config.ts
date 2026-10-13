import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@/app": path.resolve(root, "./src/app"),
      "@/pages": path.resolve(root, "./src/pages"),
      "@/features": path.resolve(root, "./src/features"),
      "@/shared": path.resolve(root, "./src/shared"),
      "@": path.resolve(root, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
