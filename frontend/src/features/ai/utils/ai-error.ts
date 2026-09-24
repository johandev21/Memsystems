import i18n from "@/shared/i18n";

export type AiErrorAction = "retry" | "settings" | "topup" | "model";

export interface ClassifiedAiError {
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

/**
 * Backend preflight keys for the structured-output gate. They are matched as
 * keys (not substrings) so the classifier cannot drift with copy changes.
 */
export const STRUCTURED_OUTPUT_MESSAGE_KEYS = [
  "errors.ai.model.structuredOutputUnsupported",
  "errors.studyMaterials.evaluation.structuredOutputUnsupported",
] as const;

const STRUCTURED_OUTPUT_MESSAGE_KEY_SET = new Set<string>(STRUCTURED_OUTPUT_MESSAGE_KEYS);

export function isStructuredOutputMessageKey(value: unknown): boolean {
  return typeof value === "string" && STRUCTURED_OUTPUT_MESSAGE_KEY_SET.has(value.trim());
}

/**
 * True when a raw transport message is, or carries, one of the structured
 * output preflight keys. Handles the bare key and the `{error, code, params}`
 * envelope, including the `messageKey` alias.
 */
export function isStructuredOutputUnsupportedError(
  rawMessage: string | undefined | null,
): boolean {
  const message = (rawMessage ?? "").trim();
  if (isStructuredOutputMessageKey(message)) return true;
  if (!message.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(message) as {
      error?: unknown;
      messageKey?: unknown;
      code?: unknown;
    };
    return (
      isStructuredOutputMessageKey(parsed.error) ||
      isStructuredOutputMessageKey(parsed.messageKey) ||
      isStructuredOutputMessageKey(parsed.code)
    );
  } catch {
    return false;
  }
}

function rateLimited(model?: string): ClassifiedAiError {
  return {
    title: i18n.t("errors.rateLimited.title", { ns: "ai" }),
    message: model
      ? i18n.t("errors.rateLimited.modelMessage", { ns: "ai", model })
      : i18n.t("errors.rateLimited.message", { ns: "ai" }),
    showTopUp: true,
    showSettings: false,
    showModelHint: true,
  };
}

function entitlement(model?: string): ClassifiedAiError {
  return {
    title: i18n.t("errors.entitlement.title", { ns: "ai" }),
    message: model
      ? i18n.t("errors.entitlement.modelMessage", { ns: "ai", model })
      : i18n.t("errors.entitlement.message", { ns: "ai" }),
    showTopUp: true,
    showSettings: false,
    showModelHint: true,
  };
}

function substituted(): ClassifiedAiError {
  return {
    title: i18n.t("errors.substituted.title", { ns: "ai" }),
    message: i18n.t("errors.substituted.message", { ns: "ai" }),
    showTopUp: true,
    showSettings: false,
    showModelHint: true,
  };
}

function retired(): ClassifiedAiError {
  return {
    title: i18n.t("errors.retired.title", { ns: "ai" }),
    message: i18n.t("errors.retired.message", { ns: "ai" }),
    showTopUp: false,
    showSettings: false,
    showModelHint: false,
  };
}

function needsSettings(): ClassifiedAiError {
  return {
    title: i18n.t("errors.auth.title", { ns: "ai" }),
    message: i18n.t("errors.auth.message", { ns: "ai" }),
    showTopUp: false,
    showSettings: true,
    showModelHint: false,
  };
}

function structuredCapability(): ClassifiedAiError {
  return {
    title: i18n.t("errors.capability.structuredTitle", { ns: "ai" }),
    message: i18n.t("errors.capability.structuredMessage", { ns: "ai" }),
    showTopUp: false,
    showSettings: false,
    showModelHint: false,
  };
}

function capability(message?: string): ClassifiedAiError {
  if (isStructuredOutputMessageKey(message)) return structuredCapability();
  const safeMessage = message ?? i18n.t("errors.capability.message", { ns: "ai" });
  const lowerMessage = message?.toLowerCase() ?? "";
  const title = lowerMessage.includes("image attachment")
    ? i18n.t("errors.capability.imageTitle", { ns: "ai" })
    : lowerMessage.includes("file attachment")
      ? i18n.t("errors.capability.fileTitle", { ns: "ai" })
      : lowerMessage.includes("structured output")
        ? i18n.t("errors.capability.structuredTitle", { ns: "ai" })
        : i18n.t("errors.capability.webSearchTitle", { ns: "ai" });
  return {
    title,
    message: safeMessage,
    showTopUp: false,
    showSettings: false,
    showModelHint: false,
  };
}

function generic(): ClassifiedAiError {
  return {
    title: i18n.t("errors.generic.title", { ns: "ai" }),
    message: i18n.t("errors.generic.message", { ns: "ai" }),
    showTopUp: false,
    showSettings: false,
    showModelHint: false,
  };
}

function classifyText(text: string, model?: string): ClassifiedAiError | null {
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
export function classifyAiError(rawMessage: string | undefined | null): ClassifiedAiError {
  const message = (rawMessage ?? "").trim();
  if (isStructuredOutputUnsupportedError(message)) return structuredCapability();
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
            title: i18n.t("errors.badRequest.title", { ns: "ai" }),
            message: inner || i18n.t("errors.badRequest.message", { ns: "ai" }),
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

/** Alias for chat domain backwards compatibility */
export const classifyChatError = classifyAiError;
export type ClassifiedChatError = ClassifiedAiError;
export type ChatErrorAction = AiErrorAction;
