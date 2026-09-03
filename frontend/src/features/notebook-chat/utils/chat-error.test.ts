import { describe, expect, it } from "vitest";
import { GATEWAY_TOP_UP_URL, classifyChatError } from "./chat-error";

describe("classifyChatError", () => {
  it("maps gateway rate-limit envelopes", () => {
    const result = classifyChatError(
      JSON.stringify({ error: "The AI service is busy", code: "gateway_rate_limited" }),
    );
    expect(result.title).toBe("AI is busy right now");
    expect(result.showTopUp).toBe(true);
  });

  it("maps gateway entitlement envelopes", () => {
    const result = classifyChatError(
      JSON.stringify({ error: "Not available", code: "gateway_entitlement" }),
    );
    expect(result.title).toBe("Model not included in your plan");
    expect(result.showTopUp).toBe(true);
  });

  it("classifies raw SDK retry text by its cause", () => {
    const result = classifyChatError(
      "Failed after 3 attempts. Last error: GatewayRateLimitError: Free tier requests on this model are rate-limited.",
    );
    expect(result.title).toBe("AI is busy right now");
  });

  it("classifies raw entitlement text", () => {
    const result = classifyChatError(
      "Free tier users do not have access to this model. Upgrade to paid credits.",
    );
    expect(result.title).toBe("Model not included in your plan");
  });

  it("unwraps service_unavailable envelopes by inner text", () => {
    const result = classifyChatError(
      JSON.stringify({
        error: "GatewayRateLimitError: too many requests",
        code: "service_unavailable",
      }),
    );
    expect(result.title).toBe("AI is busy right now");
  });

  it("maps retired models", () => {
    const result = classifyChatError("GatewayModelNotFoundError: Model not found");
    expect(result.title).toBe("Model no longer available");
  });

  it("maps auth failures to settings", () => {
    const result = classifyChatError(
      JSON.stringify({ error: "Unauthorized", code: "unauthorized" }),
    );
    expect(result.title).toBe("Connection needs attention");
    expect(result.showSettings).toBe(true);
  });

  it("keeps our validation messages readable", () => {
    const result = classifyChatError(
      JSON.stringify({ error: "Empty user message", code: "bad_request" }),
    );
    expect(result.title).toBe("Couldn't send that");
    expect(result.message).toBe("Empty user message");
  });

  it("falls back to a generic card for unknown text", () => {
    const result = classifyChatError("some weird transport failure");
    expect(result.title).toBe("Something went wrong");
    expect(result.showTopUp).toBe(false);
    expect(result.showSettings).toBe(false);
  });

  it("handles empty input", () => {
    expect(classifyChatError(undefined).title).toBe("Something went wrong");
    expect(classifyChatError("").title).toBe("Something went wrong");
  });

  it("exposes the top-up URL", () => {
    expect(GATEWAY_TOP_UP_URL).toContain("vercel.com");
  });
});
