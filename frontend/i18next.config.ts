import { defineConfig } from "i18next-cli";

const UNTRANSLATABLE_LITERALS = new Set(["Memsystems", "F2", "Backspace", "Command N"]);

export default defineConfig({
  locales: ["en", "es"],
  extract: {
    input: ["src/**/*.{ts,tsx}"],
    ignore: ["**/*.test.*", "src/routeTree.gen.ts", "src/@types/**"],
    output: "src/shared/i18n/locales/{{language}}/{{namespace}}.json",
    defaultNS: "common",
    functions: ["t", "i18n.t"],
    transComponents: ["Trans"],
    sort: true,
    removeUnusedKeys: false,
  },
  types: {
    input: ["src/shared/i18n/locales/en/**/*.json"],
    output: "src/@types/i18next.d.ts",
    enableSelector: false,
  },
  lint: {
    checkInterpolationParams: true,
    checkConcatenation: "warn",
    ignore: ["src/features/notebook-folders-prototype/**"],
  },
  plugins: [
    {
      name: "allow-untranslatable-literals",
      lintOnResult: (_filePath, issues) =>
        issues.filter((issue) => !UNTRANSLATABLE_LITERALS.has(issue.text)),
    },
  ],
});
