import { describe, expect, it } from "vitest";
import { isConnectionUsable } from "./use-connection-status";

describe("isConnectionUsable", () => {
  it("treats missing status as usable (pending)", () => {
    expect(isConnectionUsable(null)).toBe(true);
    expect(isConnectionUsable(undefined)).toBe(true);
  });

  it("is usable when healthy", () => {
    expect(isConnectionUsable({ ok: true, degraded: false })).toBe(true);
  });

  it("stays usable when degraded so transient failures don't lock the UI", () => {
    expect(isConnectionUsable({ ok: false, degraded: true })).toBe(true);
  });

  it("is unusable only when disconnected", () => {
    expect(isConnectionUsable({ ok: false, degraded: false })).toBe(false);
  });
});
