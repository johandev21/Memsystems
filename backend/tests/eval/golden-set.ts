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
  /**
   * The heading path of the section the chunk came from. It becomes the
   * section half of the contextual header the searchable text carries.
   */
  headingPath?: string[];
}

export interface GoldenSource {
  id: string;
  title: string;
  kind: 'text' | 'url' | 'file';
  processingStatus: 'ready' | 'degraded';
  chunks: GoldenChunk[];
}

export interface GoldenTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * The query-understanding trigger a query is labeled to exercise. The gate
 * asserts that the queries carrying a label measurably improve when
 * rewriting is enabled.
 */
export type GoldenUnderstanding =
  'meta_instructions' | 'follow_up' | 'ambiguous';

export interface GoldenQuery {
  id: string;
  text: string;
  /** False for queries the corpus cannot answer, which must abstain. */
  answerable: boolean;
  relevantChunkIds: string[];
  /**
   * Recent turns passed with the retrieval request. A follow-up is only
   * answerable after the rewrite resolves its references from them.
   */
  history?: GoldenTurn[];
  /** How this query depends on query understanding, when it does. */
  understanding?: GoldenUnderstanding;
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
  {
    id: 'catalog',
    title: 'Computer Science Course Catalog',
    kind: 'file',
    processingStatus: 'ready',
    // A long catalog entry shares several query terms with a question but
    // dilutes its dense cosine, while eight short prerequisite lines mention
    // the same course code and fill the dense candidate depth. Only the
    // lexical leg ranks the long entry first, so disabling the lexical leg
    // drops the answer out of the candidate set entirely.
    chunks: [
      {
        id: 'catalog-cs3300',
        text: 'CS-3300 Operating Systems is a required third-year course that introduces process scheduling, virtual memory, concurrency, file systems, and the design of reliable system software. The course is graded with a cumulative policy: weekly problem sets contribute twenty percent of the final mark, two midterm examinations contribute forty percent, and the final project contributes the remaining forty percent. Problem sets submitted after the due date lose ten percent of their value for each calendar day they are late, and no late work is accepted after the final class meeting. Students must pass the final project to pass the course, regardless of their marks on the problem sets and midterms. The syllabus also describes the laboratory schedule, the academic integrity rules that govern code submissions, the reading list for each week, and the office hours that the teaching assistants hold.',
      },
      {
        id: 'catalog-prereq-2200',
        text: 'Prerequisite for CS-2200: CS-3300.',
      },
      {
        id: 'catalog-prereq-2400',
        text: 'CS-2400 requires CS-3300.',
      },
      {
        id: 'catalog-prereq-3100',
        text: 'Prerequisite for CS-3100: CS-3300.',
      },
      {
        id: 'catalog-prereq-3400',
        text: 'CS-3400 admits CS-3300 graduates.',
      },
      {
        id: 'catalog-prereq-3500',
        text: 'Prerequisite for CS-3500: CS-3300.',
      },
      {
        id: 'catalog-prereq-4100',
        text: 'CS-4100 assumes CS-3300.',
      },
      {
        id: 'catalog-prereq-4200',
        text: 'Prerequisite for CS-4200: CS-3300.',
      },
      {
        id: 'catalog-prereq-5100',
        text: 'CS-5100 builds on CS-3300.',
      },
    ],
  },
  {
    id: 'lab-manual',
    title: 'Organic Chemistry Laboratory Manual',
    kind: 'file',
    processingStatus: 'ready',
    // A long, section-dependent source. The bodies share generic laboratory
    // vocabulary, so the dense and lexical legs cannot separate the right
    // passage from its neighbours without the section heading. The labeled
    // queries name the section, and the contextual header is what makes the
    // passage retrievable; with contextualization disabled, the section
    // tokens vanish from the chunk representation and the query abstains.
    chunks: [
      {
        id: 'lab-distillation-fraction',
        headingPath: ['Experiment 3', 'Fractional Distillation'],
        text: 'Heat the round-bottom flask slowly and collect the fraction that boils between 78 and 82 degrees in a clean receiving flask. Record the volume of the distillate and cap the flask immediately.',
      },
      {
        id: 'lab-distillation-solvent',
        headingPath: ['Experiment 3', 'Solvent Recovery'],
        text: 'After the fraction has been collected, raise the temperature and recover the remaining solvent. Record the volume, label the receiving flask, and store it before the solution cools.',
      },
      {
        id: 'lab-crystallization-seeding',
        headingPath: ['Experiment 7', 'Recrystallization'],
        text: 'Dissolve the crude solid in the minimum volume of hot solvent, then let the solution cool slowly to room temperature. Scratch the glass to seed crystal formation and collect the product by vacuum filtration.',
      },
      {
        id: 'lab-crystallization-wash',
        headingPath: ['Experiment 7', 'Washing the Product'],
        text: 'Wash the collected crystals with a small portion of cold solvent and dry them on the filter. Record the mass and the melting point before storing the sample.',
      },
      {
        id: 'lab-titration-endpoint',
        headingPath: ['Experiment 9', 'Acid-Base Titration'],
        text: 'Add the indicator and titrate until the colour changes and persists for thirty seconds. Record the volume delivered and repeat the measurement until three values agree.',
      },
      {
        id: 'lab-safety-general',
        headingPath: ['Safety'],
        text: 'Wear goggles and a lab coat at all times. Record every spill, label every container, and collect waste in the designated bins before leaving the bench.',
      },
      {
        id: 'lab-notebook-rules',
        headingPath: ['Notebook'],
        text: 'Write each entry in ink and record the date and the experiment number. Never remove a page; strike through errors so the original value stays readable.',
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
    id: 'q-course-grading',
    text: 'What is the grading policy for CS-3300?',
    answerable: true,
    relevantChunkIds: ['catalog-cs3300'],
  },
  {
    id: 'q-lab-distillation',
    text: 'What temperature range does the fractional distillation section use?',
    answerable: true,
    relevantChunkIds: ['lab-distillation-fraction'],
  },
  {
    id: 'q-lab-crystal-growth',
    text: 'What does the recrystallization section recommend for crystal growth?',
    answerable: true,
    relevantChunkIds: ['lab-crystallization-seeding'],
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
  // --- Query understanding -------------------------------------------------
  // These three queries are answered only when the pipeline rewrites the
  // message before searching. The gate fails when rewriting is disabled.
  {
    id: 'q-meta-summary',
    // "chapter" and "summary" only occur in the degraded study guide, so
    // without stripping them the query's own words outweigh its subject.
    text: 'Give me a detailed chapter summary of osmosis.',
    answerable: true,
    relevantChunkIds: ['bio-osmosis'],
    understanding: 'meta_instructions',
  },
  {
    id: 'q-followup-expand',
    // No subject words at all: the reference has to be resolved from the
    // previous turn before there is anything to search.
    text: 'Can you expand on that in more detail?',
    answerable: true,
    relevantChunkIds: ['bio-mitochondria'],
    history: [
      {
        role: 'user',
        content: 'How do mitochondria generate ATP in a cell?',
      },
      {
        role: 'assistant',
        content:
          'Mitochondria produce ATP through oxidative phosphorylation across the inner mitochondrial membrane.',
      },
    ],
    understanding: 'follow_up',
  },
  {
    id: 'q-ambiguous-respiration',
    // A short question whose only corpus term lives in a glossary stub; the
    // rewrite expands it into the material's own vocabulary.
    text: 'Where does respiration happen?',
    answerable: true,
    relevantChunkIds: ['bio-mitochondria'],
    understanding: 'ambiguous',
  },
];
