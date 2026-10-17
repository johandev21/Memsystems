import { StudyMaterialKind } from '../content/shapes';

export interface QuizGenerationOptions {
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'auto';
}

export interface FlashcardGenerationOptions {
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'auto';
}

export interface SlidesGenerationOptions {
  slideCount: number;
  theme:
    | 'dark'
    | 'light'
    | 'accent'
    | 'editorial'
    | 'academic'
    | 'technical'
    | 'warm'
    | 'auto';
  detailLevel: 'basic' | 'detailed' | 'auto';
}

export type StudyMaterialOptions =
  | ({ kind: 'quiz' } & QuizGenerationOptions)
  | ({ kind: 'simple_flashcard' } & FlashcardGenerationOptions)
  | ({ kind: 'slides' } & SlidesGenerationOptions);

interface PromptTemplate {
  instructions: string;
  user: (
    brief: string,
    sourceTexts: string,
    options?: {
      questionCount?: number;
      difficulty?: 'easy' | 'medium' | 'hard' | 'auto';
      roadmapOptions?: {
        phaseCount: number;
        detailLevel: 'basic' | 'detailed' | 'auto';
      };
      mindMapOptions?: {
        nodeCount: number;
        structure: 'radial' | 'hierarchical' | 'organic';
        colorGroups: boolean | 'auto';
        crossLinks: boolean;
        detailLevel: 'basic' | 'detailed' | 'auto';
      };
      slidesOptions?: {
        slideCount: number;
        theme:
          | 'dark'
          | 'light'
          | 'accent'
          | 'editorial'
          | 'academic'
          | 'technical'
          | 'warm'
          | 'auto';
        detailLevel: 'basic' | 'detailed' | 'auto';
      };
    },
  ) => string;
}

const quizTemplate: PromptTemplate = {
  instructions: `You are an expert quiz maker. Generate a quiz based on the topic, instructions, or source material provided. Generate a descriptive, unique title reflecting the core topic or overview of the material and place it in the top-level 'title' field. The top-level 'title' field must follow the Bloom Objective naming convention: an active verb followed by the core topic in natural Title Case (e.g., 'Mastering Socratic Ethics', 'Evaluating Limit Theorems'). It must be under 50 characters, without kebab-case, snake_case, or kind suffixes (never append '-quiz').
All question prompts and option texts MUST use natural language with proper capitalization and spaces.
Each question must have 2-6 options with exactly one correct answer.
Every option must have a detailed explanation of why it is correct or incorrect.
Questions should test conceptual understanding, reasoning, and application.
Randomize which option is correct across questions.
Each option must have a unique stable string 'id'. Set 'correctOptionId' to the exact id of the correct option. Never identify the correct answer by array position.`,
  user: (brief, sourceTexts, options) => {
    const sourceBlock = sourceTexts
      ? `Source material:\n${sourceTexts}\n\n`
      : 'Source material: None provided. Generate quiz using general knowledge.\n\n';
    const instructionsBlock = brief
      ? `Generate a quiz based on these instructions: ${brief}`
      : 'Generate a general quiz.';
    const countText = options?.questionCount
      ? `Generate EXACTLY ${options.questionCount} questions.`
      : 'Decide how many questions to generate based on the source material and instructions (aim for 4-20 questions).';
    const diffText =
      options?.difficulty && options.difficulty !== 'auto'
        ? `Target difficulty level: ${options.difficulty} (${
            options.difficulty === 'easy'
              ? 'Warmup: basic recall and definitions'
              : options.difficulty === 'hard'
                ? 'Challenge: deep reasoning, complex logic, and edge cases'
                : 'Standard: balanced conceptual and practical application'
          }).`
        : 'Choose the difficulty level (easy, medium, or hard) that best fits the source material and instructions.';
    return `${sourceBlock}${instructionsBlock}\n\n${countText} ${diffText}\nGenerate a quiz with questions, each having 2-6 options and exactly one correct answer.`;
  },
};

const simpleFlashcardTemplate: PromptTemplate = {
  instructions: `You are an expert at creating study flashcards.
Generate a set of clear, concise flashcards based on the topic, instructions, or source material provided. Generate a descriptive, unique title reflecting the core topic or overview of the material and place it in the top-level 'title' field. The top-level 'title' field must follow the Bloom Objective naming convention: an active verb followed by the core topic in natural Title Case (e.g., 'Recalling Key Organelles', 'Memorizing Greek Philosophers'). It must be under 50 characters, without kebab-case, snake_case, or kind suffixes (never append '-flashcards').
All flashcard fronts and backs MUST use natural language with proper capitalization and spaces.
Each flashcard must have a 'front' (a clear, self-contained question) and a 'back' (a complete but concise answer).
The front is shown on its own before the answer is revealed, so it must be fully understandable without the back and must NEVER contain a blank to fill in. Do not use "___", "[...]" or any other placeholder for a missing word.
Use markdown formatting where appropriate.`,
  user: (brief, sourceTexts, options) => {
    const sourceBlock = sourceTexts
      ? `Source material:\n${sourceTexts}\n\n`
      : '';
    const instructionsBlock = brief
      ? `Generate flashcards based on these instructions: ${brief}`
      : 'Generate a set of flashcards.';
    const countText = options?.questionCount
      ? `Generate EXACTLY ${options.questionCount} flashcards.`
      : 'Decide how many flashcards to generate based on the source material and instructions (aim for 5-25 flashcards).';
    const diffText =
      options?.difficulty && options.difficulty !== 'auto'
        ? `Target difficulty level: ${options.difficulty} (${
            options.difficulty === 'easy'
              ? 'Basic recall and definitions'
              : options.difficulty === 'hard'
                ? 'Deep analysis, complex reasoning, and edge cases'
                : 'Conceptual understanding and application'
          }).`
        : 'Choose the difficulty level (easy, medium, or hard) that best fits the source material and instructions.';
    return `${sourceBlock}${instructionsBlock}\n\n${countText} ${diffText}\n\nGenerate a set of flashcards, each containing a front (a clear question) and back (the answer). Every front must be a complete, self-contained question with no blanks or placeholders.`;
  },
};

const roadmapTemplate: PromptTemplate = {
  instructions: `You are an expert learning designer. Create a structured learning roadmap. Generate a descriptive, unique title reflecting the core topic or overview of the material and place it in the top-level 'title' field. The top-level 'title' field must follow the Bloom Objective naming convention: an active verb followed by the core topic in natural Title Case (e.g., 'Navigating Modern European History', 'Mastering Full-Stack Architecture'). It must be under 50 characters, without kebab-case, snake_case, or kind suffixes (never append '-roadmap').
All phase titles and topic titles MUST use natural Title Case capitalization with spaces (e.g. 'Life and Key Milestones', 'Influences and Context', 'Major Works Overview', 'Hello Brazil and Chile'). NEVER use kebab-case for phase titles or topic titles.
Organize content into phases, each containing ordered topics.
Each phase should have a clear title and optional description.
Topics should build upon each other logically.`,
  user: (brief, sourceTexts, options) => {
    const sourceBlock = sourceTexts
      ? `Source material:\n${sourceTexts}\n\n`
      : '';
    const instructionsBlock = brief
      ? `Generate a learning roadmap based on these instructions: ${brief}`
      : 'Generate a general learning roadmap.';
    const opts = options?.roadmapOptions;
    const phaseText = opts?.phaseCount
      ? `Create EXACTLY ${opts.phaseCount} phases.`
      : 'Decide how many phases to create based on the source material and instructions.';
    const detailText =
      opts?.detailLevel && opts.detailLevel !== 'auto'
        ? `Detail level: ${
            opts.detailLevel === 'detailed'
              ? 'Include detailed topic descriptions and explanations'
              : 'Keep topics concise with brief descriptions'
          }.`
        : 'Choose the detail level (basic or detailed) that best fits the source material and instructions.';
    return `${sourceBlock}${instructionsBlock}\n\n${phaseText} ${detailText}\n\nGenerate a learning roadmap with phases and ordered topics.`;
  },
};

const mindMapTemplate: PromptTemplate = {
  instructions: `You are an expert at visualizing knowledge structures. Create a mind map. Generate a descriptive, unique title reflecting the core topic or overview of the material and place it in the top-level 'title' field. The top-level 'title' field must follow the Bloom Objective naming convention: an active verb followed by the core topic in natural Title Case (e.g., 'Connecting Operating Systems Concepts', 'Mapping Cellular Metabolism'). It must be under 50 characters, without kebab-case, snake_case, or kind suffixes (never append '-mind-map').
All node labels MUST use natural Title Case capitalization with spaces.
Generate nodes with clear labels and edges showing relationships.
Most edges should be directed (from parent to child concept).
Identify the root node that represents the main topic.
Return one JSON object with this exact shape:
{"title":"Mapping Core Concepts","rootId":"root-node-id","nodes":[{"id":"root-node-id","label":"Main Topic","color":"#64748b","position":{"x":0,"y":0}},{"id":"child-node-id","label":"Related Concept","color":"#64748b","position":{"x":1,"y":0}}],"edges":[{"id":"edge-1","sourceId":"root-node-id","targetId":"child-node-id","label":"relates to","directed":true}]}.
Every node must include string "id" and "label" fields. Node "color" must be a six-digit hex color and "position" must contain numeric "x" and "y" values.
Every edge must include string "id", "sourceId", "targetId", and "label" fields plus a boolean "directed" field. "rootId" must match the id of a node.`,
  user: (brief, sourceTexts, options) => {
    const sourceBlock = sourceTexts
      ? `Source material:\n${sourceTexts}\n\n`
      : '';
    const instructionsBlock = brief
      ? `Generate a mind map based on these instructions: ${brief}`
      : 'Generate a general mind map.';
    const opts = options?.mindMapOptions;
    const countText = opts?.nodeCount
      ? `Generate approximately ${opts.nodeCount} nodes.`
      : 'Decide how many nodes to create based on the source material and instructions.';
    const structureText = opts?.structure
      ? `Use a ${opts.structure} layout structure.`
      : '';
    const colorText =
      opts?.colorGroups === 'auto'
        ? 'Decide whether color grouping clarifies the map based on the source material and instructions; use distinct colors to group related nodes only when it helps.'
        : opts?.colorGroups
          ? 'Use distinct colors to group related nodes by theme or category.'
          : '';
    const crossText = opts?.crossLinks
      ? 'Include cross-links between related nodes across different branches.'
      : '';
    const detailText =
      opts?.detailLevel && opts.detailLevel !== 'auto'
        ? `Detail level: ${
            opts.detailLevel === 'detailed'
              ? 'Use descriptive labels and include meaningful relationship labels.'
              : 'Keep labels concise and focus on the most important relationships.'
          }.`
        : 'Choose the detail level (basic or detailed) that best fits the source material and instructions.';
    return `${sourceBlock}${instructionsBlock}\n\n${countText} ${structureText} ${detailText}\n${colorText} ${crossText}\n\nGenerate a mind map with nodes and labeled edges showing relationships.`;
  },
};

const slidesTemplate: PromptTemplate = {
  instructions: `You are an expert presentation designer. Create a slide deck as structured scenes. Generate a descriptive, unique title reflecting the core topic and place it in the top-level 'title' field. The top-level 'title' field must follow the Bloom Objective naming convention: an active verb followed by the core topic in natural Title Case (e.g., 'Exploring Nietzsche Philosophy', 'Unpacking Climate Economics'). It must be under 50 characters, without kebab-case, snake_case, or kind suffixes (never append '-slides').
All slide titles MUST use natural Title Case capitalization with spaces. NEVER use kebab-case for slide titles, subtitles, or element text.
Choose ONE coherent visual direction for the entire deck via the top-level 'design' object: {"preset":"dark"|"light"|"editorial"|"academic"|"technical"|"warm","background":"#RRGGBB","surface":"#RRGGBB","primary":"#RRGGBB","secondary":"#RRGGBB","text":"#RRGGBB","muted":"#RRGGBB","fontHeading":"Inter"|"Arial"|"Helvetica"|"Georgia"|"Verdana"|"Times New Roman","fontBody":"Inter"|"Arial"|"Helvetica"|"Georgia"|"Verdana"|"Times New Roman","radius":"none"|"small"|"large"|"pill","density":"airy"|"balanced"|"dense","decoration":"minimal"|"geometric"|"editorial"|"diagrammatic"}. Prefer simply setting "preset" and letting the server resolve full tokens; only override colors with valid six-digit hex values.
Each slide must have a unique string 'id', a 'role' (one of 'title', 'section', 'content', 'comparison', 'timeline', 'process', 'statistic', 'quote', 'cards', 'takeaways', 'closing'), a 'title', and optionally 'subtitle', 'speakerNotes', and 'elements' (max 6 per slide).
Element types and shapes:
- {"type":"text","text":"...","style":{"variant":"heading"|"body"|"caption","align":"left"|"center"}}
- {"type":"bullet-list","items":["..."],"style":{"columns":1|2}}
- {"type":"card-group","cards":[{"title":"...","body":"..."}],"columns":2|3}
- {"type":"comparison","left":{"heading":"...","points":["..."]},"right":{"heading":"...","points":["..."]}}
- {"type":"timeline","steps":[{"title":"...","body":"..."}]} (2-6 steps, chronology only)
- {"type":"process","steps":[{"title":"...","body":"..."}]} (2-6 steps, sequences only)
- {"type":"statistic","value":"...","label":"...","context":"..."} (only for quantitative facts present in the source material)
- {"type":"quote","quote":"...","attribution":"..."} (only real quotes from the source material, or clearly marked paraphrase)
- {"type":"shape","variant":"accent-bar"|"dots"|"ring"|"grid"|"wave"}
Composition rules: the first slide MUST be role 'title'; the final slide MUST be 'closing' or 'takeaways'. Do NOT use more than two consecutive 'content' slides — vary roles meaningfully. Use 'comparison' for contrasts, 'timeline' for chronology, 'process' for sequences, 'statistic' for notable quantitative facts, and 'section' only for major transitions (max 3 per deck). Prefer visual hierarchy over filling empty space: limit each slide to a readable amount of content (3-5 bullets, 2-4 cards, 2-6 steps). Do NOT invent images, citations, statistics, or quotations. Preserve the learning objective and source-grounded meaning. Do NOT include images, previews, or HTML — structured JSON only.`,
  user: (brief, sourceTexts, options) => {
    const sourceBlock = sourceTexts
      ? `Source material:\n${sourceTexts}\n\n`
      : '';
    const instructionsBlock = brief
      ? `Generate a slide deck based on these instructions: ${brief}`
      : 'Generate a general slide deck.';
    const opts = options?.slidesOptions;
    const countText =
      opts?.slideCount && opts.slideCount > 0
        ? `Create EXACTLY ${opts.slideCount} slides.`
        : 'Decide how many slides to create based on the source material and instructions (aim for 6-12 slides).';
    const themeText =
      opts?.theme && opts.theme !== 'auto'
        ? `Visual direction: use the "${opts.theme}" design preset as the deck's coherent visual language (set design.preset to "${opts.theme === 'accent' ? 'warm' : opts.theme}").`
        : 'Visual direction: choose the design preset (dark, light, editorial, academic, technical, warm) that best fits the source material and instructions.';
    const detailText =
      opts?.detailLevel && opts.detailLevel !== 'auto'
        ? `Detail level: ${
            opts.detailLevel === 'detailed'
              ? 'Include substantive bullets, cards, and step bodies per slide'
              : 'Keep bullets and bodies concise'
          }.`
        : 'Choose the detail level (basic or detailed) that best fits the source material and instructions.';
    return `${sourceBlock}${instructionsBlock}\n\n${countText} ${themeText} ${detailText}\n\nGenerate a slide deck with a top-level 'design' object and ordered slide scenes. Use a mixture of at least three different slide roles. Do not include a 'previews' field — previews are generated server-side.`;
  },
};

const templates: Record<StudyMaterialKind, PromptTemplate> = {
  quiz: quizTemplate,
  simple_flashcard: simpleFlashcardTemplate,
  roadmap: roadmapTemplate,
  mind_map: mindMapTemplate,
  slides: slidesTemplate,
};

export function getPromptTemplate(kind: StudyMaterialKind): PromptTemplate {
  return templates[kind];
}
