import { stripChunkContentHeader } from '../../../ai/indexing/chunking.service';
import { tokenize } from '../../../ai/retrieval/text-similarity';
import { MIN_SUBSTANTIVE_CHUNK_CHARS } from './budgets';
import type { IndexedChunkRow } from './grounding.types';

export function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export const BOILERPLATE_HEADING_PATTERNS: {
  keys: string[];
  pattern: RegExp;
}[] = [
  {
    keys: [
      'table of contents',
      'contents',
      'tabla de contenido',
      'tabla de contenidos',
      'indice general',
      'sumario',
    ],
    pattern:
      /^(?:table of )?contents$|^toc$|^(?:tabla de )?contenidos?$|^indice general$|^sumario$/i,
  },
  {
    keys: [
      'preface',
      'foreword',
      'prefacio',
      'prologo',
      'nota preliminar',
      'palabras preliminares',
    ],
    pattern:
      /^preface$|^foreword$|^prefacio$|^prologo$|^nota preliminar$|^palabras preliminares$/i,
  },
  {
    keys: [
      'acknowledgments',
      'acknowledgements',
      'agradecimientos',
      'reconocimientos',
    ],
    pattern: /^acknowledgm?ents$|^agradecimientos?$|^reconocimientos?$/i,
  },
  {
    keys: [
      'copyright',
      'colophon',
      'imprint',
      'derechos de autor',
      'creditos',
      'aviso legal',
      'colofon',
    ],
    pattern:
      /^copyright(?:\s+notice|\s+page)?$|^colophon$|^imprint$|^derechos(?:\s+de\s+autor|\s+reservados)?$|^creditos$|^aviso\s+legal$|^colofon$/i,
  },
  {
    keys: [
      'index',
      'subject index',
      'author index',
      'indice',
      'indice analitico',
      'indice tematico',
      'indice alfabetico',
      'indice de materias',
      'indice onomastico',
    ],
    pattern:
      /^(?:subject\s+|author\s+)?index$|^indice(?:\s+(?:analitico|tematico|alfabetico|de\s+materias|onomastico|de\s+autores))?$/i,
  },
  {
    keys: [
      'bibliography',
      'works cited',
      'further reading',
      'bibliografia',
      'obras citadas',
      'lecturas recomendadas',
      'lecturas adicionales',
    ],
    pattern:
      /^bibliography$|^works\s+cited$|^further\s+reading$|^bibliografia(?:\s+recomendada|\s+general)?$|^obras\s+citadas$|^lecturas\s+(?:recomendadas|adicionales|complementarias)$/i,
  },
  {
    keys: [
      'references',
      'list of references',
      'referencias',
      'lista de referencias',
      'fuentes bibliograficas',
      'referencias bibliograficas',
    ],
    pattern:
      /^(?:list\s+of\s+)?references$|^(?:lista\s+de\s+)?referencias(?:\s+bibliograficas)?$|^fuentes\s+bibliograficas$/i,
  },
  {
    keys: [
      'about the author',
      'about the authors',
      'biographical note',
      'sobre el autor',
      'sobre los autores',
      'acerca del autor',
      'acerca de los autores',
      'nota biografica',
      'biografia del autor',
    ],
    pattern:
      /^about\s+the\s+authors?$|^biographical\s+note$|^(?:sobre|acerca\s+de(?:l)?)\s+(?:el\s+|la\s+|los\s+|las\s+)?autor(?:a|es|as)?$|^nota\s+biografica$|^biografia\s+de(?:l)?\s+(?:los\s+)?autor(?:es)?$/i,
  },
  {
    keys: ['glossary', 'glosario'],
    pattern: /^glossary$|^glosario(?:\s+de\s+terminos)?$/i,
  },
  {
    keys: ['dedication', 'epigraph', 'dedicatoria', 'epigrafe'],
    pattern: /^dedication$|^epigraph$|^dedicatoria$|^epigrafe$/i,
  },
  {
    keys: [
      'front matter',
      'back matter',
      'preliminares',
      'paginas preliminares',
    ],
    pattern: /^front\s+matter$|^back\s+matter$|^(?:paginas\s+)?preliminares$/i,
  },
];

export function normalizeHeadingSegment(segment: string): string {
  return stripDiacritics(segment)
    .toLowerCase()
    .replace(/^[\s\d.:()-]+/, '')
    .replace(
      /^(?:part|parte|chapter|capitulo|cap|section|seccion|sec|appendix|apendice|anexo|unit|unidad|module|modulo)\s+[\d\w.:()-]+\s*/i,
      '',
    )
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isBoilerplateHeadingPath(
  headingPath: string[] | null | undefined,
  brief = '',
): boolean {
  if (!headingPath || headingPath.length === 0) return false;
  const normalizedBrief = stripDiacritics(brief)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const briefTokens = new Set(
    tokenize(brief).map((token) => stripDiacritics(token)),
  );

  for (const segment of headingPath) {
    const normalized = normalizeHeadingSegment(segment);
    if (!normalized) continue;
    for (const entry of BOILERPLATE_HEADING_PATTERNS) {
      if (!entry.pattern.test(normalized)) continue;
      const segmentTokens = tokenize(normalized);
      const explicitlyRequested =
        (normalizedBrief.length > 0 && normalizedBrief.includes(normalized)) ||
        (normalizedBrief.length > 0 &&
          entry.keys.some((key) => normalizedBrief.includes(key))) ||
        (segmentTokens.length > 0 &&
          segmentTokens.every((token) => briefTokens.has(token)));
      if (!explicitlyRequested) {
        return true;
      }
    }
  }
  return false;
}

export function filterSubstantiveChunks(
  chunks: IndexedChunkRow[],
  brief = '',
): {
  substantiveChunks: IndexedChunkRow[];
  excludedChunkIds: string[];
} {
  if (chunks.length === 0) {
    return { substantiveChunks: [], excludedChunkIds: [] };
  }

  const nonBoilerplate = chunks.filter(
    (chunk) => !isBoilerplateHeadingPath(chunk.headingPath, brief),
  );
  const basePool = nonBoilerplate.length > 0 ? nonBoilerplate : chunks;

  const hasLongChunkInSection = new Map<string, boolean>();
  let hasAnyLongChunkInSource = false;
  for (const chunk of basePool) {
    const key = chunk.headingPath.join(' > ');
    const len = stripChunkContentHeader(chunk.content).trim().length;
    if (len >= MIN_SUBSTANTIVE_CHUNK_CHARS) {
      hasLongChunkInSection.set(key, true);
      hasAnyLongChunkInSource = true;
    }
  }

  const substantive = basePool.filter((chunk) => {
    const len = stripChunkContentHeader(chunk.content).trim().length;
    if (len >= MIN_SUBSTANTIVE_CHUNK_CHARS) return true;
    const key = chunk.headingPath.join(' > ');
    if (key.length > 0) {
      return !hasLongChunkInSection.get(key);
    }
    return !hasAnyLongChunkInSource;
  });

  const finalSubstantive = substantive.length > 0 ? substantive : basePool;
  const keptIds = new Set(finalSubstantive.map((chunk) => chunk.chunkId));
  const excludedChunkIds = chunks
    .filter((chunk) => !keptIds.has(chunk.chunkId))
    .map((chunk) => chunk.chunkId);

  return {
    substantiveChunks: finalSubstantive,
    excludedChunkIds,
  };
}
