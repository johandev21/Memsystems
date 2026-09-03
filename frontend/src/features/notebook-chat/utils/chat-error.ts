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
const RETIRED_PATTERNS =
  /model not found|no such model|retired|deprecated|model .* removed/i;
const AUTH_PATTERNS =
  /invalid api key|incorrect api key|unauthorized|authentication/i;

function rateLimited(): ClassifiedChatError {
  return {
    title: "AI is busy right now",
    message:
      "This model is rate-limited on your plan. Wait a few seconds and retry, or switch to another model.",
    showTopUp: true,
    showSettings: false,
    showModelHint: true,
  };
}

function entitlement(): ClassifiedChatError {
  return {
    title: "Model not included in your plan",
    message:
      "Your gateway account can't use this model. Try a free-tier model or add credits.",
    showTopUp: true,
    showSettings: false,
    showModelHint: true,
  };
}

function retired(): ClassifiedChatError {
  return {
    title: "Model no longer available",
    message:
      "This model was retired from the gateway. Pick a current model above and retry.",
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

function generic(): ClassifiedChatError {
  return {
    title: "Something went wrong",
    message: "The request failed before finishing. Retrying usually works.",
    showTopUp: false,
    showSettings: false,
    showModelHint: false,
  };
}

function classifyText(text: string): ClassifiedChatError | null {
  if (RATE_LIMIT_PATTERNS.test(text)) return rateLimited();
  if (ENTITLEMENT_PATTERNS.test(text)) return entitlement();
  if (RETIRED_PATTERNS.test(text)) return retired();
  if (AUTH_PATTERNS.test(text)) return needsSettings();
  return null;
}

/**
 * Turns raw transport failures (backend `{error, code}` envelopes or raw
 * AI SDK / gateway messages) into a friendly card. Never surfaces raw
 * technical text except for our own validation messages.
 */
export function classifyChatError(
  rawMessage: string | undefined | null,
): ClassifiedChatError {
  const message = (rawMessage ?? "").trim();
  if (message.startsWith("{")) {
    try {
      const parsed = JSON.parse(message) as {
        error?: unknown;
        code?: unknown;
      };
      const code = typeof parsed.code === "string" ? parsed.code : "";
      const inner =
        typeof parsed.error === "string" ? parsed.error : "";
      switch (code) {
        case "gateway_rate_limited":
          return rateLimited();
        case "gateway_entitlement":
          return entitlement();
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
          return classifyText(inner) ?? generic();
        default:
          return classifyText(inner || message) ?? generic();
      }
    } catch {
      // Not actually JSON — fall through to text rules.
    }
  }
  return classifyText(message) ?? generic();
}
