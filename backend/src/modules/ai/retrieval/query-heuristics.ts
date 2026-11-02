import {
  MAX_REWRITE_HISTORY_TURNS,
  MAX_REWRITE_TOPIC_TERMS,
  MIN_REWRITE_CONTENT_WORDS,
  type RetrievalHistoryTurn,
  type RetrievalRewriteConfig,
  type RewriteDecision,
} from './query-understanding.config';

export const REWRITE_STOP_WORDS = new Set([
  'a',
  'about',
  'above',
  'across',
  'after',
  'against',
  'along',
  'among',
  'an',
  'and',
  'answer',
  'are',
  'around',
  'as',
  'at',
  'be',
  'been',
  'being',
  'before',
  'behind',
  'below',
  'beneath',
  'beside',
  'between',
  'briefly',
  'but',
  'by',
  'can',
  'chapter',
  'chapters',
  'concise',
  'concern',
  'could',
  'describe',
  'detail',
  'did',
  'do',
  'does',
  'doing',
  'done',
  'during',
  'except',
  'explain',
  'explained',
  'explaining',
  'explains',
  'for',
  'from',
  'give',
  'go',
  'going',
  'he',
  'her',
  'here',
  'hers',
  'him',
  'his',
  'how',
  'i',
  'if',
  'in',
  'inside',
  'into',
  'is',
  'it',
  'its',
  'just',
  'like',
  'list',
  'me',
  'more',
  'most',
  'my',
  'near',
  'need',
  'no',
  'not',
  'of',
  'on',
  'only',
  'or',
  'our',
  'out',
  'outside',
  'over',
  'own',
  'please',
  'provide',
  'said',
  'same',
  'say',
  'says',
  'she',
  'short',
  'should',
  'show',
  'simple',
  'so',
  'some',
  'such',
  'summarize',
  'summarise',
  'summary',
  'tell',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'to',
  'too',
  'toward',
  'under',
  'until',
  'upon',
  'us',
  'use',
  'using',
  'very',
  'want',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'whom',
  'why',
  'will',
  'with',
  'within',
  'without',
  'would',
  'write',
  'you',
  'your',
]);

export const REFERENCE_WORDS = new Set([
  'above',
  'another',
  'both',
  'detail',
  'details',
  'either',
  'elsewhere',
  'expand',
  'first',
  'following',
  'former',
  'fourth',
  'happen',
  'happens',
  'instead',
  'last',
  'latter',
  'mentioned',
  'next',
  'none',
  'one',
  'ones',
  'other',
  'others',
  'previous',
  'second',
  'sixth',
  'third',
  'fifth',
]);

export const TONE_WORDS =
  'friendly|casual|formal|professional|academic|conversational|humorous|playful|serious|encouraging|patient|enthusiastic|warm|reassuring|neutral';

export const NARRATIVE_FORMS =
  'story|poem|dialogue|letter|email|news\\s+article|blog\\s+post|script|song|fable|parable|journey|scenario';

export const AUDIENCES =
  'beginners?|children|kids?|students?|experts?|laypeople|layperson|novices?|general\\s+audience|five[- ]year[- ]olds?|\\d+[- ]year[- ]olds?';

export const META_PATTERNS: RegExp[] = [
  /\b(?:in|as|using|with)\s+(?:a\s+|an\s+|the\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|a\s+few|several)\s+(?:words?|sentences?|paragraphs?|bullets?|bullet\s+points?|points?|lines?|steps?|items?)\b/gi,
  /\b(?:in|as|using|with)\s+(?:a\s+|an\s+|the\s+)?(?:bullet\s+points?|bullets?|numbered\s+list|table|markdown|outline|essay|paragraph)\b/gi,
  /\b(?:briefly|concisely|succinctly|in\s+detail|in\s+short|in\s+simple\s+terms|step-by-step|in\s+depth)\b/gi,
  /\b(?:short|brief|concise|quick|detailed|long|thorough|simple)\s+(?:chapter\s+|section\s+|article\s+|study\s+)?(?:summary|answer|explanation|overview|response|description|outline|notes?|paragraph|essay|report)\b/gi,
  /\b(?:bullet\s+points?|numbered\s+list)\b/gi,
  /\b(?:answer|reply|respond|write|translate|format|give|explain)\s+(?:it\s+|this\s+|that\s+|the\s+answer\s+|your\s+answer\s+)?(?:in|as)\s+(?:spanish|english|french|german|portuguese|italian|dutch)\b/gi,
  /\bin\s+(?:spanish|english|french|german|portuguese|italian|dutch)\b/gi,
  new RegExp(
    `\\b(?:in|with|using)\\s+(?:a\\s+|an\\s+|the\\s+)?(?:${TONE_WORDS})\\s+(?:tone|voice|style|language|manner|way)\\b`,
    'gi',
  ),
  new RegExp(`\\b(?:${TONE_WORDS})\\s+(?:tone|voice|style)\\b`, 'gi'),
  new RegExp(
    `\\b(?:as|in\\s+the\\s+form\\s+of|like)\\s+(?:a\\s+|an\\s+|the\\s+)?(?:short\\s+|brief\\s+|quick\\s+|simple\\s+)?(?:${NARRATIVE_FORMS})\\b`,
    'gi',
  ),
  new RegExp(`\\bfor\\s+(?:a\\s+|an\\s+|the\\s+)?(?:${AUDIENCES})\\b`, 'gi'),
  /\blike\s+i(?:'m|\s+am)\s+(?:five|5|a\s+child|a\s+beginner|\d+)\b/gi,
];

export const META_PREFIX_PATTERN =
  /^(?:hi[,! ]+|hey[,! ]+|hello[,! ]+|please\s+|so\s+|now\s+|ok(?:ay)?[,! ]+|can\s+you\s+|could\s+you\s+|would\s+you\s+|will\s+you\s+|i\s+(?:want|need|would\s+like)\s+(?:you\s+)?to\s+|help\s+me\s+|give\s+me\s+|show\s+me\s+|tell\s+me\s+|write\s+|create\s+|make\s+|produce\s+|generate\s+|draft\s+|explain\s+|describe\s+|summari[sz]e\s+)/i;

export const CONTINUATION_PATTERN =
  /\b(?:expand|elaborate|continue|delve|go\s+on|keep\s+going|dig\s+deeper|say\s+more|tell\s+me\s+more|more\s+detail|more\s+about|same\s+thing)\b/i;

export const FOLLOW_UP_QUESTION_PATTERN =
  /\b(?:what|how|why|when|where|which)\s+about\b|\band\s+(?:what|how|why|when|where)\b/i;

export const ANAPHORA_PATTERN =
  /\b(?:it|its|they|them|their|this|that|these|those|one|ones|another|the\s+(?:first|second|third|fourth|fifth|sixth|last|next|previous|former|latter|above|same|other))\b/i;

export function contentWords(text: string): string[] {
  const matches = text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu);
  if (!matches) return [];
  return matches.filter(
    (word) => word.length >= 2 && !REWRITE_STOP_WORDS.has(word),
  );
}

export function hasMetaInstructions(message: string): boolean {
  return META_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(message);
  });
}

export function hasFollowUpReference(message: string): boolean {
  const words = contentWords(message);
  if (CONTINUATION_PATTERN.test(message)) {
    if (ANAPHORA_PATTERN.test(message)) return true;
    if (words.length <= MIN_REWRITE_CONTENT_WORDS) return true;
  }
  if (FOLLOW_UP_QUESTION_PATTERN.test(message)) return true;
  if (ANAPHORA_PATTERN.test(message) && words.length > 0) {
    if (words.length < MIN_REWRITE_CONTENT_WORDS + 2) return true;
  }
  return false;
}

export function isFollowUpQuery(message: string): boolean {
  return hasFollowUpReference(message);
}

export function isAmbiguousQuery(message: string): boolean {
  return contentWords(message).length < MIN_REWRITE_CONTENT_WORDS;
}

export function isCleanSearchQuery(message: string): boolean {
  return (
    Boolean(message.trim()) &&
    !hasMetaInstructions(message) &&
    !hasFollowUpReference(message) &&
    !isAmbiguousQuery(message)
  );
}

export function decideRewrite(
  message: string,
  config: Pick<RetrievalRewriteConfig, 'enabled'>,
): RewriteDecision {
  if (!config.enabled) {
    return { shouldRewrite: false, trigger: null, skipReason: 'disabled' };
  }
  if (!message.trim()) {
    return { shouldRewrite: false, trigger: null, skipReason: 'empty_message' };
  }
  if (hasMetaInstructions(message)) {
    return {
      shouldRewrite: true,
      trigger: 'meta_instructions',
      skipReason: null,
    };
  }
  if (hasFollowUpReference(message)) {
    return { shouldRewrite: true, trigger: 'follow_up', skipReason: null };
  }
  if (isAmbiguousQuery(message)) {
    return { shouldRewrite: true, trigger: 'ambiguous', skipReason: null };
  }
  return { shouldRewrite: false, trigger: null, skipReason: 'search_ready' };
}

export function stripMetaInstructions(message: string): string {
  let text = message.replace(/\s+/g, ' ').trim();
  let previous = '';
  while (previous !== text) {
    previous = text;
    text = text.replace(META_PREFIX_PATTERN, '').trim();
    for (const pattern of META_PATTERNS) {
      text = text.replace(pattern, ' ');
    }
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();
  }
  text = text.replace(/^[\s,.;:!?–—-]+|[\s,.;:!?–—-]+$/g, '').trim();
  if (contentWords(text).length === 0) {
    return message.replace(/\s+/g, ' ').trim();
  }
  return text;
}

export function historyTopicTerms(
  history: RetrievalHistoryTurn[],
  maxTerms = MAX_REWRITE_TOPIC_TERMS,
): string[] {
  const turns = history.slice(-MAX_REWRITE_HISTORY_TURNS);
  const source =
    [...turns]
      .reverse()
      .find(
        (turn) => turn.role === 'user' && contentWords(turn.content).length > 0,
      ) ??
    [...turns].reverse().find((turn) => contentWords(turn.content).length > 0);
  if (!source) return [];

  const terms: string[] = [];
  for (const word of contentWords(source.content)) {
    if (REFERENCE_WORDS.has(word)) continue;
    if (!terms.includes(word)) terms.push(word);
    if (terms.length >= maxTerms) break;
  }
  return terms;
}

export function extractTopicTerms(
  history: RetrievalHistoryTurn[],
  maxTerms = MAX_REWRITE_TOPIC_TERMS,
): string[] {
  return historyTopicTerms(history, maxTerms);
}

export function buildHeuristicRewrite(
  message: string,
  history: RetrievalHistoryTurn[] = [],
): string {
  const stripped = stripMetaInstructions(message);
  const subject = contentWords(stripped).filter(
    (word) => !REFERENCE_WORDS.has(word),
  );
  const topic = hasFollowUpReference(message) ? historyTopicTerms(history) : [];
  const rewritten = [...subject, ...topic].join(' ').trim();
  return rewritten || message.replace(/\s+/g, ' ').trim();
}
