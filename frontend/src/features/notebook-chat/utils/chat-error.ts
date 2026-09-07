export type ChatErrorAction = "retry" | "settings" | "topup" | "model";

export interface ClassifiedChatError {
  title: string;
  message: string;
  showTopUp: boolean;
  showSettings: boolean;
  showModelHint: boolean;
}

export const GATEWAY_TOP_UP_URL =
  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dtop-up";

const RATE_LIMIT_PATTERNS = /rate.?limit|too many requests|429|quota exceeded/i;
const ENTITLEMENT_PATTERNS =
  /do not have access|not have access|entitlement|forbidden|upgrade to paid/i;
const SUBSTITUTION_PATTERNS = /model_substituted|served .* instead of the requested/i;
const RETIRED_PATTERNS = /model not found|no such model|retired|deprecated|model .* removed/i;
const AUTH_PATTERNS = /invalid api key|incorrect api key|unauthorized|authentication/i;
const CAPABILITY_PATTERNS =
  /tool[_ ]choice.*(?:did not match|unsupported|not supported|not found.*tools?.*parameter)|does not support (?:tools?|function calling)|unsupported(?:\s+\w+)*\s+tool|tools? (?:are|is) not supported/i;

function rateLimited(model?: string): ClassifiedChatError {
  const subject = model ? `${model} is` : "This model is";
  return {
    title: "AI is busy right now",
    message: `${subject} rate-limited on your plan. Wait a few seconds and retry, or switch to another model.`,
    showTopUp: true,
    showSettings: false,
    showModelHint: true,
  };
}

function entitlement(model?: string): ClassifiedChatError {
  return {
    title: "Model not included in your plan",
    message: model
      ? `${model} isn't included in your plan. Your gateway account can't use it — try a free-tier model or add credits.`
      : "Your gateway account can't use this model. Try a free-tier model or add credits.",
    showTopUp: true,
    showSettings: false,
    showModelHint: true,
  };
}

function substituted(): ClassifiedChatError {
  return {
    title: "Wrong model served",
    message:
      "The gateway answered with a different model than the one you picked. Nothing was presented as working — retry, or switch to a model your plan includes.",
    showTopUp: true,
    showSettings: false,
    showModelHint: true,
  };
}

function retired(): ClassifiedChatError {
  return {
    title: "Model no longer available",
    message: "This model was retired from the gateway. Pick a current model above and retry.",
    showTopUp: false,
    showSettings: false,
    showModelHint: false,
  };
}

function needsSettings(): ClassifiedChatError {
  return {
    title: "Connection needs attention",
    message: "Your key was rejected. Check your keys in Settings.",
    showTopUp: false,
    showSettings: true,
    showModelHint: false,
  };
}

function capability(message?: string): ClassifiedChatError {
  const safeMessage =
    message ??
    "This model doesn't support web search. Switch to a model that supports web search and try again.";
  const lowerMessage = message?.toLowerCase() ?? "";
  const title = lowerMessage.includes("image attachment")
    ? "Image attachments aren't supported"
    : lowerMessage.includes("file attachment")
      ? "File attachments aren't supported"
      : lowerMessage.includes("structured output")
        ? "Structured output isn't supported"
        : "Web search isn't supported";
  return {
    title,
    message: safeMessage,
    showTopUp: false,
    showSettings: false,
    showModelHint: false,
  };
}

function generic(): ClassifiedChatError {
  return {
    title: "Something went wrong",
    message: "The request failed before finishing. Retrying usually works.",
    showTopUp: false,
    showSettings: false,
    showModelHint: false,
  };
}

function classifyText(text: string, model?: string): ClassifiedChatError | null {
  if (SUBSTITUTION_PATTERNS.test(text)) return substituted();
  if (CAPABILITY_PATTERNS.test(text)) return capability();
  if (RATE_LIMIT_PATTERNS.test(text)) return rateLimited(model);
  if (ENTITLEMENT_PATTERNS.test(text)) return entitlement(model);
  if (RETIRED_PATTERNS.test(text)) return retired();
  if (AUTH_PATTERNS.test(text)) return needsSettings();
  return null;
}

/**
 * Turns raw transport failures (backend `{error, code}` envelopes or raw
 * AI SDK / gateway messages) into a friendly card. Never surfaces raw
 * technical text except for our own validation messages.
 */
export function classifyChatError(rawMessage: string | undefined | null): ClassifiedChatError {
  const message = (rawMessage ?? "").trim();
  if (message.startsWith("{")) {
    try {
      const parsed = JSON.parse(message) as {
        error?: unknown;
        code?: unknown;
        model?: unknown;
      };
      const code = typeof parsed.code === "string" ? parsed.code : "";
      const inner = typeof parsed.error === "string" ? parsed.error : "";
      const model =
        typeof parsed.model === "string" && parsed.model.trim() !== ""
          ? parsed.model.trim()
          : undefined;
      switch (code) {
        case "gateway_rate_limited":
          return rateLimited(model);
        case "gateway_entitlement":
          return entitlement(model);
        case "gateway_capability_unsupported":
          return capability(inner);
        case "unauthorized":
          return needsSettings();
        case "bad_request":
          return {
            title: "Couldn't send that",
            message: inner || "The request was invalid.",
            showTopUp: false,
            showSettings: false,
            showModelHint: false,
          };
        case "service_unavailable":
        case "internal_error":
        case "http_exception":
          return classifyText(inner, model) ?? generic();
        default:
          return classifyText(inner || message, model) ?? generic();
      }
    } catch {
      // Not actually JSON — fall through to text rules.
    }
  }
  return classifyText(message) ?? generic();
}
