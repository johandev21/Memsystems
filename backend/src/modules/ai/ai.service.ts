import { Injectable, Logger } from '@nestjs/common';
import {
  convertToModelMessages,
  generateText,
  isStepCount,
  streamText,
} from 'ai';
import { BadRequestError } from '../../common/errors/domain-error';
import {
  EntitlementError,
  RateLimitedError,
} from '../../common/errors/domain-error';
import { ConnectionService } from './connection.service';
import { ModelSyncService } from './model-sync.service';
import {
  buildGatewayOptions,
  createGatewayProvider,
  type GatewayRequestOptions,
} from './providers/gateway.provider';
import { classifyGatewayError } from './providers/gateway-errors';
import { resolveModelId } from './providers/model-catalog';
import type { Provider } from './providers/provider';
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

function toSearchDomainError(error: unknown): Error {
  const classified = classifyGatewayError(error);
  if (classified.kind === 'rate_limited') {
    return new RateLimitedError(
      'The AI service is busy right now. Please retry in a moment.',
      { cause: error instanceof Error ? error : undefined },
    );
  }
  if (classified.kind === 'entitlement') {
    return new EntitlementError(
      'This model is not available on your plan. Try another model or add credits.',
      { cause: error instanceof Error ? error : undefined },
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}

const WEB_SEARCH_PROMPT = `You are a research assistant helping a student find high-quality learning sources.
Use the web_search tool to search the web about the user's topic.
Select ONLY high-quality, substantive, primary sources. Favor: official documentation, encyclopedia entries (Wikipedia, Britannica, Stanford Encyclopedia of Philosophy, etc.), .edu and .gov pages, reputable publications, books, and university course pages.
EXCLUDE: social media, forums (Reddit, Quora), video pages (YouTube), shopping pages, aggregators, paywalled teasers, and clickbait.
Keep at most 8 sources — only the best ones.
Then write a short research summary (2-3 sentences) describing what the sources cover and why they are good starting points.
Finally output a JSON object (and nothing else, no markdown fences) with exactly this shape:
{"summary": string, "sources": [{"title": string, "url": string, "description": string}]}
Use the exact url from the search results, give each source a clean, human-readable title (never the raw URL), and a one-line description.`;

const BLOCKED_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'reddit.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'tiktok.com',
  'pinterest.com',
  'quora.com',
  'twitch.tv',
  'discord.com',
  'amazon.com',
  'ebay.com',
  'walmart.com',
  'aliexpress.com',
];

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly userSettingsService: UserSettingsService,
    private readonly connectionService: ConnectionService,
    private readonly modelSyncService: ModelSyncService,
  ) {}

  async getProviderForModel(
    modelId: string,
    userId?: string,
  ): Promise<Provider> {
    if (!userId) {
      throw new BadRequestError('User context required to use AI models.');
    }
    const resolved = resolveModelId(modelId);
    const catalog = this.modelSyncService.getModels();
    if (!catalog.some((model) => model.id === resolved)) {
      throw new BadRequestError(`Model ${modelId} is not supported.`);
    }
    if (!(await this.hasEffectiveAuth(userId))) {
      throw new BadRequestError(
        'AI Gateway is not connected. Add your AI Gateway key in Settings.',
      );
    }
    const apiKey = await this.userSettingsService.getGatewayApiKey(userId);
    if (!apiKey) {
      throw new BadRequestError(
        'AI Gateway is not connected. Add your AI Gateway key in Settings.',
      );
    }
    return createGatewayProvider({
      apiKey,
      getModels: () => this.modelSyncService.getModels(),
    });
  }

  /**
   * Per-request gateway options for a model call: the user id for spend
   * attribution plus optional server-side fallbacks. Auth travels with the
   * provider instance (the user's own gateway key), not the options bag.
   */
  getGatewayRequestOptions(
    _modelId: string,
    userId: string,
    options?: { fallbacks?: string[] },
  ): GatewayRequestOptions {
    return buildGatewayOptions(userId, options?.fallbacks);
  }

  private async hasEffectiveAuth(userId: string): Promise<boolean> {
    const apiKey = await this.userSettingsService.getGatewayApiKey(userId);
    return Boolean(apiKey);
  }

  async listModels(userId: string) {
    return (await this.connectionService.snapshot(userId)).models;
  }

  async searchWeb(
    query: string,
    modelId: string,
    userId: string,
  ): Promise<WebSearchResult> {
    this.logger.log(`searchWeb start`, { userId, modelId, query });

    await this.connectionService.requireConnected(userId, modelId);
    const provider = await this.getProviderForModel(modelId, userId);
    if (!provider.supportsWebSearch(modelId)) {
      throw new BadRequestError(
        `Model ${modelId} does not support web search. Try a different chat model.`,
      );
    }

    const model = provider.createModel(modelId);
    const requestOptions = this.getGatewayRequestOptions(modelId, userId);
    const webSearchTool = provider.createWebSearchTool?.();
    if (!webSearchTool) {
      throw new BadRequestError(
        `Model ${modelId} does not support web search.`,
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
        toolChoice: { type: 'tool', toolName: 'web_search' },
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
      throw toSearchDomainError(err);
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

  async generateStream(
    modelId: string,
    messages: ConvertInput,
    userId?: string,
  ): Promise<any> {
    if (!userId) {
      throw new BadRequestError('User context required to generate stream.');
    }
    await this.connectionService.requireConnected(userId, modelId);
    const provider = await this.getProviderForModel(modelId, userId);
    const model = provider.createModel(modelId);
    const requestOptions = this.getGatewayRequestOptions(modelId, userId);
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

function isBlockedDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_DOMAINS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
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
    if (isBlockedDomain(url)) return;
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
