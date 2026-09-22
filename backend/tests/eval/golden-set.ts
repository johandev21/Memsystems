/**
 * The labeled golden set for the retrieval evaluation harness: a small corpus
 * of Sources and Source Chunks plus real study queries, each labeled with the
 * Source Chunks that should answer it.
 *
 * Add a labeled query by appending a `GoldenQuery` whose `relevantChunkIds`
 * point at existing chunk ids. Add a chunk by appending it to a source's
 * `chunks`; ids must stay stable, because labels and the baseline metrics
 * refer to them. Unanswerable queries are queries the corpus cannot answer;
 * retrieval must abstain on them.
 */

export interface GoldenChunk {
  id: string;
  text: string;
}

export interface GoldenSource {
  id: string;
  title: string;
  kind: 'text' | 'url' | 'file';
  processingStatus: 'ready' | 'degraded';
  chunks: GoldenChunk[];
}

export interface GoldenQuery {
  id: string;
  text: string;
  /** False for queries the corpus cannot answer, which must abstain. */
  answerable: boolean;
  relevantChunkIds: string[];
}

export const GOLDEN_SOURCES: GoldenSource[] = [
  {
    id: 'bio-notes',
    title: 'Cell Biology Lecture Notes',
    kind: 'text',
    processingStatus: 'ready',
    chunks: [
      {
        id: 'bio-mitochondria',
        text: 'Mitochondria are membrane-bound organelles that generate most of the chemical energy needed to power a cell. They produce adenosine triphosphate through oxidative phosphorylation, a process driven by an electrochemical proton gradient across the inner mitochondrial membrane.',
      },
      {
        id: 'bio-osmosis',
        text: 'Osmosis is the net movement of water molecules across a selectively permeable membrane, from a region of lower solute concentration to a region of higher solute concentration. The osmotic pressure needed to stop the flow depends on the size of the solute gradient.',
      },
      {
        id: 'bio-enzymes',
        text: 'Enzymes are biological catalysts that speed up reactions by lowering the activation energy barrier. A competitive inhibitor competes with the substrate for the active site, whereas a noncompetitive inhibitor binds an allosteric site and changes the shape of the enzyme.',
      },
    ],
  },
  {
    id: 'stats-primer',
    title: 'Statistics Primer',
    kind: 'text',
    processingStatus: 'ready',
    chunks: [
      {
        id: 'stats-pvalue',
        text: 'A p-value is the probability of obtaining a result at least as extreme as the observed data, assuming that the null hypothesis is true. Researchers compare the p-value with a significance level, conventionally 0.05, before deciding to reject the null hypothesis.',
      },
      {
        id: 'stats-interval',
        text: 'A confidence interval estimates a population parameter as a range of plausible values. A 95 percent confidence interval means that repeated sampling would capture the true parameter in roughly 95 percent of samples.',
      },
      {
        id: 'stats-regression',
        text: 'Simple linear regression fits a straight line that minimises the sum of squared residuals between observed outcomes and predictions. The slope coefficient describes the expected change in the response variable for a one-unit increase in the predictor.',
      },
    ],
  },
  {
    id: 'wwii-timeline',
    title: 'World War II Timeline',
    kind: 'file',
    processingStatus: 'ready',
    chunks: [
      {
        id: 'wwii-versailles',
        text: 'The Treaty of Versailles was signed on 28 June 1919, formally ending World War I. Its reparations clauses imposed heavy financial obligations on Germany and redrew several European borders.',
      },
      {
        id: 'wwii-barbarossa',
        text: 'Operation Barbarossa began on 22 June 1941, when German forces invaded the Soviet Union along a broad front. The campaign stalled before Moscow in the winter of 1941.',
      },
      {
        id: 'wwii-dday',
        text: 'The D-Day landings took place on 6 June 1944, when Allied forces landed on five beaches in Normandy. The operation opened the western front and accelerated the liberation of France.',
      },
    ],
  },
  {
    id: 'bge-guide',
    title: 'Beyond Good and Evil Study Guide',
    kind: 'url',
    processingStatus: 'degraded',
    chunks: [
      {
        id: 'bge-navigation',
        text: 'Chapter 1 Chapter 2 Chapter 3 Chapter 4 Chapter 5 Summary Analysis Themes Quotes.',
      },
      {
        id: 'bge-signin',
        text: 'Sign in to continue reading. Table of contents. Promotional offer. Related study guides.',
      },
    ],
  },
  {
    id: 'glossary',
    title: 'Course Glossary',
    kind: 'text',
    processingStatus: 'ready',
    // Short glossary entries are legitimate source content and legitimate
    // retrieval noise: they share a distinctive term with a query but do not
    // answer it. The dense leg over-ranks them because they are short; the
    // reranker demotes them. The gate fails if that stops happening.
    chunks: [
      {
        id: 'gloss-mitochondria',
        text: 'Mitochondria: see cellular respiration.',
      },
      {
        id: 'gloss-osmosis',
        text: 'Osmosis: see diffusion and water potential.',
      },
      {
        id: 'gloss-pvalue',
        text: 'P-value: see significance testing.',
      },
      {
        id: 'gloss-barbarossa',
        text: 'Operation Barbarossa: see the Eastern Front.',
      },
    ],
  },
];

export const GOLDEN_QUERIES: GoldenQuery[] = [
  {
    id: 'q-atp',
    text: 'How do mitochondria generate ATP in a cell?',
    answerable: true,
    relevantChunkIds: ['bio-mitochondria'],
  },
  {
    id: 'q-osmosis',
    text: 'What is osmosis across a selectively permeable membrane?',
    answerable: true,
    relevantChunkIds: ['bio-osmosis'],
  },
  {
    id: 'q-inhibitor',
    text: 'How does a competitive inhibitor affect an enzyme?',
    answerable: true,
    relevantChunkIds: ['bio-enzymes'],
  },
  {
    id: 'q-pvalue',
    text: 'What does a p-value tell us about the null hypothesis?',
    answerable: true,
    relevantChunkIds: ['stats-pvalue'],
  },
  {
    id: 'q-confidence',
    text: 'How should I interpret a 95 percent confidence interval?',
    answerable: true,
    relevantChunkIds: ['stats-interval'],
  },
  {
    id: 'q-regression',
    text: 'Explain the slope coefficient in simple linear regression.',
    answerable: true,
    relevantChunkIds: ['stats-regression'],
  },
  {
    id: 'q-versailles',
    text: 'When was the Treaty of Versailles signed?',
    answerable: true,
    relevantChunkIds: ['wwii-versailles'],
  },
  {
    id: 'q-barbarossa',
    text: 'When did Operation Barbarossa begin?',
    answerable: true,
    relevantChunkIds: ['wwii-barbarossa'],
  },
  {
    id: 'q-dday',
    text: 'Where did the D-Day landings take place?',
    answerable: true,
    relevantChunkIds: ['wwii-dday'],
  },
  {
    id: 'q-degraded-source',
    text: 'What does the Beyond Good and Evil study guide say about master morality?',
    answerable: false,
    relevantChunkIds: [],
  },
  {
    id: 'q-sourdough',
    text: 'How do I bake sourdough bread with a starter culture?',
    answerable: false,
    relevantChunkIds: [],
  },
  {
    id: 'q-quantum',
    text: 'What is the Schrodinger equation for a hydrogen atom?',
    answerable: false,
    relevantChunkIds: [],
  },
];
