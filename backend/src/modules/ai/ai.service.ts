import { Injectable, Logger } from '@nestjs/common';
import {
  convertToModelMessages,
  generateText,
  isStepCount,
  streamText,
} from 'ai';
import {
  BadRequestError,
  CapabilityUnsupportedError,
  EntitlementError,
  RateLimitedError,
} from '../../common/errors/domain-error';
import { ConnectionService } from './connection.service';
import { ModelSyncService } from './model-sync.service';
import {
  buildGatewayOptions,
  createGatewayProvider,
  SINGLE_USER_ID,
  type GatewayRequestOptions,
} from './providers/gateway.provider';
import { classifyGatewayError } from './providers/gateway-errors';
import { resolveModelId } from './providers/model-catalog';
import type { Provider, ProviderModel } from './providers/provider';
import { UserSettingsService } from './user-settings.service';

type ConvertInput = Parameters<typeof convertToModelMessages>[0];

export interface WebSearchSource {
  title: string;
  url: string;
  description: string | null;
}

export interface WebSearchResult {
  query: string;
  summary: string | null;
  sources: WebSearchSource[];
}

function toSearchDomainError(error: unknown, modelName: string): Error {
  const classified = classifyGatewayError(error);
  if (classified.kind === 'rate_limited') {
    return new RateLimitedError(
      'The AI service is busy right now. Please retry in a moment.',
      {
        cause: error instanceof Error ? error : undefined,
        messageKey: 'errors.ai.gateway.busy',
      },
    );
  }
  if (classified.kind === 'entitlement') {
    return new EntitlementError(
      'This model is not available on your plan. Try another model or add credits.',
      {
        cause: error instanceof Error ? error : undefined,
        messageKey: 'errors.ai.gateway.entitlement',
      },
    );
  }
  if (classified.kind === 'capability') {
    return new CapabilityUnsupportedError(
      `${modelName} doesn't support web search. Switch to a model that supports web search and try again.`,
      {
        cause: error instanceof Error ? error : undefined,
        messageKey: 'errors.ai.model.capabilityUnsupported',
        params: { model: modelName, capability: 'web search' },
      },
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}

const WEB_SEARCH_PROMPT = `You are a research assistant helping a student find useful learning sources.
Use the web_search tool to search the web about the user's topic.
Prefer substantive, trustworthy sources (official docs, books, courses, .edu/.gov, reputable articles, encyclopedias). Avoid low-effort, clickbait, or paywalled teasers unless nothing better exists.
You may include videos, forums, or community posts only if they are genuinely high-quality and relevant.
Return as many high-quality sources as the topic warrants — let relevance decide, not a fixed number.
Then write a short research summary (2-3 sentences) describing what the sources cover and why they are good starting points.
Finally output a JSON object (and nothing else, no markdown fences) with exactly this shape:
{"summary": string, "sources": [{"title": string, "url": string, "description": string}]}
Use the exact url from the search results, give each source a clean, human-readable title (never the raw URL), and a one-line description.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly userSettingsService: UserSettingsService,
    private readonly connectionService: ConnectionService,
    private readonly modelSyncService: ModelSyncService,
  ) {}

  async getProviderForModel(modelId: string): Promise<Provider> {
    const resolved = resolveModelId(modelId);
    const catalog = this.modelSyncService.getModels();
    if (!catalog.some((model) => model.id === resolved)) {
      throw new BadRequestError(`Model ${modelId} is not supported.`, {
        messageKey: 'errors.ai.model.notSupported',
        params: { model: modelId },
      });
    }
    const provider = await this.getProviderIfConnected();
    if (!provider) {
      throw new BadRequestError(
        'AI Gateway is not connected. Add your AI Gateway key in Settings.',
        { messageKey: 'errors.ai.gateway.notConnected' },
      );
    }
    return provider;
  }

  /**
   * The gateway provider for a background task (retrieval query rewriting),
   * or `null` when the AI Gateway is not connected. Unlike
   * `getProviderForModel` it validates no model id and never throws: the
   * caller degrades instead of failing the turn.
   */
  async getProviderIfConnected(): Promise<Provider | null> {
    if (!(await this.hasEffectiveAuth())) return null;
    const apiKey = await this.userSettingsService.getGatewayApiKey();
    if (!apiKey) return null;
    // The global gateway key lives in the singleton app_settings row.
    return createGatewayProvider({
      apiKey,
      getModels: () => this.modelSyncService.getModels(),
    });
  }

  /**
   * Per-request gateway options with the single-user id for spend
   * attribution. Auth travels with the provider instance (the single
   * gateway key), not the options bag. The gateway must serve the requested
   * model or fail — silent substitution via fallback models is not allowed.
   */
  getGatewayRequestOptions(): GatewayRequestOptions {
    return buildGatewayOptions(SINGLE_USER_ID);
  }

  private async hasEffectiveAuth(): Promise<boolean> {
    const apiKey = await this.userSettingsService.getGatewayApiKey();
    return Boolean(apiKey);
  }

  async listModels() {
    return (await this.connectionService.snapshot()).models;
  }

  requireCapability(
    provider: Provider,
    modelId: string,
    capability: keyof NonNullable<ProviderModel['capabilities']>,
    label: string,
  ): ProviderModel {
    const resolved = resolveModelId(modelId);
    const models = provider.listModels?.() ?? [];
    const selected = models.find((model) => model.id === resolved);
    if (selected?.capabilities?.[capability] === true) return selected;

    const modelName = selected?.displayName ?? modelId;
    throw new CapabilityUnsupportedError(
      `${modelName} doesn't support ${label}. Switch to a model that supports ${label} and try again.`,
      {
        messageKey: 'errors.ai.model.capabilityUnsupported',
        params: { model: modelName, capability: label },
      },
    );
  }

  async searchWeb(query: string, modelId: string): Promise<WebSearchResult> {
    this.logger.log(`searchWeb start`, { modelId, query });

    await this.connectionService.requireConnected(modelId);
    const provider = await this.getProviderForModel(modelId);
    if (!provider.supportsWebSearch(modelId)) {
      this.requireCapability(provider, modelId, 'webSearch', 'web search');
    }

    const model = provider.createModel(modelId);
    const requestOptions = this.getGatewayRequestOptions();
    const webSearchTool = provider.createWebSearchTool?.();
    if (!webSearchTool) {
      throw new BadRequestError(
        `Model ${modelId} does not support web search.`,
        {
          messageKey: 'errors.ai.model.webSearchUnsupported',
          params: { model: modelId },
        },
      );
    }

    let result: SearchGenerationResult;
    let gatewayGenerationId: string | undefined;
    try {
      result = await generateText({
        model,
        prompt: `${WEB_SEARCH_PROMPT}\n\nTopic: ${query}`,
        tools: {
          web_search: webSearchTool,
        },
        // Only one tool is present, so `required` still guarantees search
        // without forcing a provider-specific translated tool name.
        toolChoice: 'required',
        stopWhen: isStepCount(2),
        ...requestOptions,
        onLanguageModelCallEnd: ({ providerMetadata }) => {
          const generationId = providerMetadata?.gateway?.generationId;
          if (typeof generationId === 'string' && generationId) {
            gatewayGenerationId = generationId;
          }
        },
      });
    } catch (err) {
      this.logger.error('generateText failed during web search', {
        modelId,
        query,
        error: err instanceof Error ? (err.stack ?? err.message) : String(err),
      });
      const modelName =
        provider
          .listModels?.()
          .find((candidate) => candidate.id === resolveModelId(modelId))
          ?.displayName ?? modelId;
      throw toSearchDomainError(err, modelName);
    }

    this.logger.log('generateText returned', {
      modelId,
      gatewayGenerationId,
      finishReason: result.finishReason,
      textLength: result.text?.length ?? 0,
      textPreview: (result.text ?? '').slice(0, 500),
      resultSourcesCount: result.sources?.length ?? 0,
      toolResultsCount: result.toolResults?.length ?? 0,
      toolResults: (result.toolResults ?? []).map((tr) => ({
        toolName: tr.toolName,
        output: tr.output,
      })),
    });

    const parsed = parseSearchJson(result.text);
    this.logger.log('parsed model JSON', {
      hasSummary: !!parsed?.summary,
      parsedSourceCount: parsed?.sources?.length ?? 0,
      parsed: JSON.stringify(parsed),
    });

    const sources = reconcileSearchSources(result, parsed);
    this.logger.log('reconciled sources', {
      count: sources.length,
      sources: sources.map((s) => ({ title: s.title, url: s.url })),
    });

    return {
      query,
      summary: parsed?.summary ?? null,
      sources,
    };
  }

  async generateStream(modelId: string, messages: ConvertInput): Promise<any> {
    await this.connectionService.requireConnected(modelId);
    const provider = await this.getProviderForModel(modelId);
    const model = provider.createModel(modelId);
    const requestOptions = this.getGatewayRequestOptions();
    const coreMessages = await convertToModelMessages(messages);
    return streamText({
      model,
      messages: coreMessages,
      ...requestOptions,
      onLanguageModelCallEnd: ({ providerMetadata }) => {
        const generationId = providerMetadata?.gateway?.generationId;
        if (typeof generationId === 'string' && generationId) {
          this.logger.debug('gateway generation completed', {
            modelId,
            generationId,
          });
        }
      },
    });
  }
}

interface ParsedSearchOutput {
  summary?: string;
  sources?: { url?: string; title?: string; description?: string }[];
}

interface ToolResultLike {
  toolName?: string;
  output?: unknown;
}

interface SearchGenerationResult {
  finishReason?: string;
  text: string;
  sources?: readonly SourceLike[];
  toolResults?: readonly ToolResultLike[];
}

interface SourceLike {
  sourceType?: string;
  url?: string;
  title?: string;
}

export function parseSearchJson(text: string): ParsedSearchOutput | null {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (parsed && typeof parsed === 'object') return parsed;
    return null;
  } catch {
    return null;
  }
}

function extractWebSearchUrls(
  toolResults: readonly ToolResultLike[],
): string[] {
  return extractWebSearchResults(toolResults).map((result) => result.url);
}

function extractWebSearchResults(
  toolResults: readonly ToolResultLike[],
): Array<{ url: string; title?: string }> {
  const results: Array<{ url: string; title?: string }> = [];
  for (const tr of toolResults) {
    if (tr.toolName !== 'web_search' || !tr.output) continue;
    const output = tr.output as {
      action?: unknown;
      sources?: { type?: string; url?: string }[];
      results?: Array<{ url?: string; title?: string }>;
    };
    // Legacy OpenAI web_search shape.
    for (const s of output.sources ?? []) {
      if (s?.type === 'url' && s.url) results.push({ url: s.url });
    }
    // Gateway Perplexity search shape: { results: [{ url, title, ... }] }.
    // Parsed defensively — unknown shapes are ignored, never trusted blindly.
    const perplexityResults = output.results;
    if (Array.isArray(perplexityResults)) {
      for (const r of perplexityResults) {
        if (
          r &&
          typeof r === 'object' &&
          'url' in r &&
          typeof (r as { url: unknown }).url === 'string'
        ) {
          const title =
            'title' in r && typeof (r as { title: unknown }).title === 'string'
              ? ((r as { title: string }).title ?? undefined)
              : undefined;
          results.push({ url: (r as { url: string }).url, title });
        }
      }
    }
  }
  return results;
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function reconcileSearchSources(
  result: {
    sources?: readonly SourceLike[];
    toolResults?: readonly ToolResultLike[];
  },
  parsed: ParsedSearchOutput | null,
): WebSearchSource[] {
  // Real URLs the web_search actually returned (deduped, normalized).
  const realUrls = new Set<string>();
  for (const source of result.sources ?? []) {
    if (source.sourceType !== 'url' || !source.url) continue;
    realUrls.add(normalizeUrl(source.url));
  }
  for (const url of extractWebSearchUrls(result.toolResults ?? [])) {
    realUrls.add(normalizeUrl(url));
  }

  // Title hints from citation sources (priority over model JSON).
  const citationTitles = new Map<string, string>();
  for (const source of result.sources ?? []) {
    if (source.sourceType !== 'url' || !source.url || !source.title) continue;
    citationTitles.set(normalizeUrl(source.url), source.title);
  }

  const sources: WebSearchSource[] = [];
  const seen = new Set<string>();

  const addSource = (
    url: string,
    title?: string,
    description?: string | null,
  ) => {
    const normalized = normalizeUrl(url);
    if (!realUrls.has(normalized)) return; // never trust hallucinated URLs
    if (seen.has(normalized)) return;
    seen.add(normalized);
    const realTitle = citationTitles.get(normalized);
    sources.push({
      title: (realTitle ?? title ?? '').trim() || deriveTitle(url),
      url,
      description: description ?? null,
    });
  };

  const modelSources = parsed?.sources ?? [];

  if (modelSources.length === 0) {
    // Fallback when the model didn't emit JSON: keep real sources with citation titles.
    for (const source of result.sources ?? []) {
      if (source.sourceType !== 'url' || !source.url) continue;
      addSource(source.url, source.title);
    }
    for (const { url, title } of extractWebSearchResults(
      result.toolResults ?? [],
    )) {
      addSource(url, title);
    }
  } else {
    // Only keep sources the model explicitly chose (it curates for quality).
    for (const s of modelSources) {
      if (s.url) addSource(s.url, s.title, s.description);
    }
  }

  return sources;
}

function deriveTitle(url: string): string {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname + (parsed.pathname.length > 1 ? parsed.pathname : '')
    );
  } catch {
    return url;
  }
}
