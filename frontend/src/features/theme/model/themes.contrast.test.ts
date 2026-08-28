import { describe, expect, it } from "vitest";

declare const process: { cwd: () => string };

function oklchToLuminance(oklchStr: string): number {
  if (!oklchStr) throw new Error(`Missing oklch string: received ${oklchStr}`);
  const m = oklchStr.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+%?)?\s*\)/);
  if (!m) throw new Error(`Invalid oklch string: ${oklchStr}`);

  const L = m[1].endsWith("%") ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  const C = parseFloat(m[2]);
  const H = parseFloat(m[3]);

  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const mVal = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLin = +4.0767416621 * l - 3.3077115913 * mVal + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * mVal - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * mVal + 1.707614701 * s;

  const rClamped = Math.max(0, Math.min(1, rLin));
  const gClamped = Math.max(0, Math.min(1, gLin));
  const bClamped = Math.max(0, Math.min(1, bLin));

  return 0.2126 * rClamped + 0.7152 * gClamped + 0.0722 * bClamped;
}

function contrastRatio(color1: string, color2: string): number {
  const lum1 = oklchToLuminance(color1);
  const lum2 = oklchToLuminance(color2);
  const max = Math.max(lum1, lum2);
  const min = Math.min(lum1, lum2);
  return (max + 0.05) / (min + 0.05);
}

function parseTokens(css: string, selector: string): Record<string, string> {
  const lines = css.split(/\r?\n/);
  let inBlock = false;
  const map: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inBlock) {
      if (trimmed.includes("{")) {
        const beforeBrace = trimmed.split("{")[0].trim();
        if (beforeBrace === selector) {
          inBlock = true;
        }
      }
    } else {
      if (trimmed.startsWith("}")) {
        inBlock = false;
        continue;
      }
      const match = trimmed.match(/^(--[a-zA-Z0-9_-]+):\s*([^;]+);/);
      if (match) {
        map[match[1]] = match[2].trim();
      }
    }
  }
  return map;
}

describe("Theme Contrast AA Budgets", async () => {
  // @ts-expect-error Node fs module is available in test environment
  const fs = (await import("node:fs")) as { readFileSync: (path: string, enc: string) => string };
  // @ts-expect-error Node path module is available in test environment
  const path = (await import("node:path")) as { resolve: (...args: string[]) => string };

  const themesCssPath = path.resolve(process.cwd(), "src/styles/themes.css");
  const globalsCssPath = path.resolve(process.cwd(), "src/globals.css");
  const tokensCssPath = path.resolve(process.cwd(), "src/styles/tokens.css");

  const themesCss = fs.readFileSync(themesCssPath, "utf8");
  const globalsCss = fs.readFileSync(globalsCssPath, "utf8");
  const tokensCss = fs.readFileSync(tokensCssPath, "utf8");

  const themes = [
    {
      name: "default (light)",
      tokens: { ...parseTokens(globalsCss, ":root"), ...parseTokens(tokensCss, ":root") },
    },
    {
      name: "default (dark)",
      tokens: { ...parseTokens(globalsCss, ".dark"), ...parseTokens(tokensCss, ".dark") },
    },
    { name: "tide (light)", tokens: parseTokens(themesCss, 'html[data-theme="tide"]') },
    { name: "tide (dark)", tokens: parseTokens(themesCss, 'html.dark[data-theme="tide"]') },
    { name: "grove (light)", tokens: parseTokens(themesCss, 'html[data-theme="grove"]') },
    { name: "grove (dark)", tokens: parseTokens(themesCss, 'html.dark[data-theme="grove"]') },
    { name: "dune (light)", tokens: parseTokens(themesCss, 'html[data-theme="dune"]') },
    { name: "dune (dark)", tokens: parseTokens(themesCss, 'html.dark[data-theme="dune"]') },
    { name: "ember (light)", tokens: parseTokens(themesCss, 'html[data-theme="ember"]') },
    { name: "ember (dark)", tokens: parseTokens(themesCss, 'html.dark[data-theme="ember"]') },
    { name: "plum (light)", tokens: parseTokens(themesCss, 'html[data-theme="plum"]') },
    { name: "plum (dark)", tokens: parseTokens(themesCss, 'html.dark[data-theme="plum"]') },
  ];

  for (const t of themes) {
    describe(t.name, () => {
      it("has all required tokens parsed", () => {
        expect(t.tokens["--foreground"]).toBeDefined();
        expect(t.tokens["--background"]).toBeDefined();
        expect(t.tokens["--primary"]).toBeDefined();
        expect(t.tokens["--primary-foreground"]).toBeDefined();
        expect(t.tokens["--text-primary"]).toBeDefined();
        expect(t.tokens["--text-secondary"]).toBeDefined();
        expect(t.tokens["--text-faint"]).toBeDefined();
        expect(t.tokens["--surface-0"]).toBeDefined();
        expect(t.tokens["--surface-1"]).toBeDefined();
        expect(t.tokens["--surface-2"]).toBeDefined();
        expect(t.tokens["--muted"]).toBeDefined();
        expect(t.tokens["--muted-foreground"]).toBeDefined();
      });

      it("foreground on background achieves AAA (>= 7:1)", () => {
        const ratio = contrastRatio(t.tokens["--foreground"], t.tokens["--background"]);
        expect(ratio).toBeGreaterThanOrEqual(7.0);
      });

      it("primary-foreground on primary achieves AA (>= 4.5:1)", () => {
        const ratio = contrastRatio(t.tokens["--primary-foreground"], t.tokens["--primary"]);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it("text-primary on surface-0 achieves AAA (>= 7:1)", () => {
        const ratio = contrastRatio(t.tokens["--text-primary"], t.tokens["--surface-0"]);
        expect(ratio).toBeGreaterThanOrEqual(7.0);
      });

      it("text-secondary on surface-1 achieves AA (>= 4.5:1)", () => {
        const ratio = contrastRatio(t.tokens["--text-secondary"], t.tokens["--surface-1"]);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it("text-faint on surface-2 achieves at least 3.5:1", () => {
        const ratio = contrastRatio(t.tokens["--text-faint"], t.tokens["--surface-2"]);
        expect(ratio).toBeGreaterThanOrEqual(3.5);
      });

      it("muted-foreground on muted achieves at least 4:1", () => {
        const ratio = contrastRatio(t.tokens["--muted-foreground"], t.tokens["--muted"]);
        expect(ratio).toBeGreaterThanOrEqual(4.0);
      });
    });
  }
});
