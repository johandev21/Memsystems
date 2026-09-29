import { describe, expect, it } from "vitest";
import {
  GATEWAY_TOP_UP_URL,
  classifyChatError,
  isStructuredOutputUnsupportedError,
} from "./chat-error";

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

  it.each([
    "tool_choice did not match any supported type",
    "Tool choice `web_search_preview` not found in `tools` parameter.",
    "This model does not support tools or function calling",
    "Unsupported web_search tool",
  ])("maps raw capability rejection without provider jargon: %s", (message) => {
    const result = classifyChatError(message);
    expect(result.title).toBe("Web search isn't supported");
    expect(result.message).not.toContain("tool_choice");
    expect(result.message).toContain("a model that supports web search");
    expect(result.message).not.toContain("GPT-4o Mini");
  });

  it("maps capability error envelopes", () => {
    const result = classifyChatError(
      JSON.stringify({
        error:
          "DeepSeek R1 doesn't support web search. Switch to a model that supports web search and try again.",
        code: "gateway_capability_unsupported",
      }),
    );
    expect(result.title).toBe("Web search isn't supported");
    expect(result.message).toContain("DeepSeek R1");
    expect(result.message).not.toContain("GPT-4o Mini");
  });

  it.each([
    "errors.ai.model.structuredOutputUnsupported",
    "errors.studyMaterials.evaluation.structuredOutputUnsupported",
  ])("maps the structured-output preflight key %s", (messageKey) => {
    const result = classifyChatError(messageKey);
    expect(result.title).toBe("Structured output isn't supported");
    expect(result.message).toContain("structured output");
    expect(result.showTopUp).toBe(false);
    expect(result.showSettings).toBe(false);
  });

  it("maps structured-output preflight envelopes and the messageKey alias", () => {
    const fromErrorField = classifyChatError(
      JSON.stringify({
        error: "errors.ai.model.structuredOutputUnsupported",
        code: "gateway_capability_unsupported",
        params: { name: "GPT-5.6 Sol" },
      }),
    );
    expect(fromErrorField.title).toBe("Structured output isn't supported");

    const fromAlias = classifyChatError(
      JSON.stringify({
        messageKey: "errors.studyMaterials.evaluation.structuredOutputUnsupported",
        code: "bad_request",
      }),
    );
    expect(fromAlias.title).toBe("Structured output isn't supported");
  });

  it("detects structured-output preflight messages without matching other capability text", () => {
    expect(
      isStructuredOutputUnsupportedError("errors.ai.model.structuredOutputUnsupported"),
    ).toBe(true);
    expect(
      isStructuredOutputUnsupportedError(
        JSON.stringify({ messageKey: "errors.studyMaterials.evaluation.structuredOutputUnsupported" }),
      ),
    ).toBe(true);
    expect(isStructuredOutputUnsupportedError("This model does not support tools")).toBe(false);
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

  it("flags gateway model substitution instead of generic failure", () => {
    const result = classifyChatError(
      "model_substituted: requested anthropic/claude-fable-5.1 but the gateway served openai/gpt-4o-mini. No model substitution is allowed — pick a model your plan includes.",
    );
    expect(result.title).toBe("Wrong model served");
    expect(result.showModelHint).toBe(true);
  });

  it("names the model in entitlement envelopes", () => {
    const result = classifyChatError(
      JSON.stringify({
        error: "Claude Fable 5.1 is not available",
        code: "gateway_entitlement",
        model: "Claude Fable 5.1",
      }),
    );
    expect(result.title).toBe("Model not included in your plan");
    expect(result.message).toContain("Claude Fable 5.1");
  });

  it("names the model in rate-limit envelopes", () => {
    const result = classifyChatError(
      JSON.stringify({
        error: "busy",
        code: "gateway_rate_limited",
        model: "GPT-4o Mini",
      }),
    );
    expect(result.title).toBe("AI is busy right now");
    expect(result.message).toContain("GPT-4o Mini");
    expect(result.message).not.toContain("This model");
  });

  it("keeps legacy envelopes without a model working", () => {
    const result = classifyChatError(
      JSON.stringify({ error: "busy", code: "gateway_rate_limited" }),
    );
    expect(result.message).toContain("This model is rate-limited");
  });

  it("exposes the top-up URL", () => {
    expect(GATEWAY_TOP_UP_URL).toContain("vercel.com");
  });
});
