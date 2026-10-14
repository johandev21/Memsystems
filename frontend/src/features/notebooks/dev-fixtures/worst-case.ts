import type { Notebook } from "../types/notebook.types";
import type { Source } from "@/features/sources/types/source.types";
import type { SourceFolder } from "@/features/sources/types/source-folder.types";
import type { StudyMaterialDTO } from "@/features/study-material-viewer/types/study-material.types";
import type { FolderDTO } from "@/features/study-material-tree/types/folder.types";
import type { ChatMessageDTO, CitedSourceDTO } from "@/features/notebook-chat/api/chat";

export const worstCaseNotebook: Notebook = {
  id: "worst-case-notebook",
  title:
    "A Very Comprehensive Study of Philosophical Epistemology, Metaphysics, Existential Dialectics, Phenomenology, Neuroethics, Cognitive Science, Moral Philosophy, Axiology, and Transcendental Hermeneutics",
  description:
    "Detailed comparative investigation into pre-Socratic ontology, Cartesian dualism, Kantian transcendental idealism, Hegelian historical dialectics, Nietzschean perspectivism and will to power, Heideggerian Dasein, Wittgensteinian language games, Sartrean existential freedom, Quinean ontological relativity, and modern theories of artificial cognitive emergence within distributed semantic neural architectures, critically synthesized across twenty centuries of Western and Eastern philosophical thought.",
  icon: "Flame",
  folderId: null,
  banner: "https://invalid.example.test/missing-banner-image-404.jpg",
  bannerUrl: "https://invalid.example.test/missing-banner-image-404.jpg",
  bannerVariants: null,
  bannerFocalPoint: { x: 0.95, y: 0.05 },
  groundingMode: "strict",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2027-12-31T23:59:59.000Z",
};

export const worstCaseSourceFolders: SourceFolder[] = [
  {
    id: "sf-1",
    notebookId: "worst-case-notebook",
    parentId: null,
    name: "Aleksandra Wiśniewska-Kowalczyk & Very Long Compound Name That Overflows Rows",
    createdAt: "2026-01-15T08:00:00.000Z",
    updatedAt: "2026-01-15T08:00:00.000Z",
  },
  {
    id: "sf-2",
    notebookId: "worst-case-notebook",
    parentId: null,
    name: "نور الهدى عبد الرحمن (RTL Folder Name)",
    createdAt: "2026-01-16T09:00:00.000Z",
    updatedAt: "2026-01-16T09:00:00.000Z",
  },
  {
    id: "sf-3",
    notebookId: "worst-case-notebook",
    parentId: "sf-1",
    name: "Subfolder <script>alert(1)</script> & 👩🏽‍💻 Priya [approved by legal]",
    createdAt: "2026-01-17T10:00:00.000Z",
    updatedAt: "2026-01-17T10:00:00.000Z",
  },
];

export const worstCaseSources: Source[] = [
  {
    id: "src-1",
    notebookId: "worst-case-notebook",
    folderId: "sf-1",
    kind: "file",
    modality: "document",
    title:
      "Supercalifragilisticexpialidocious_hyperparameter_optimization_analysis_for_extremely_deep_residual_recurrent_transformer_models_v2_final_final_approved_by_legal_2026_q4_revision.pdf",
    url: null,
    contentType: "application/pdf",
    fileSize: 104857600,
    processingStatus: "ready",
    createdAt: "2026-01-01T12:00:00.000Z",
  },
  {
    id: "src-2",
    notebookId: "worst-case-notebook",
    folderId: "sf-1",
    kind: "url",
    modality: "document",
    title:
      "https://example.com/workspaces/acme/projects/q3-launch/docs/9f8e7d6c5b4a?tab=comments&filter=unresolved&deeply=nested&parameter=overflow&utm_source=very-long-campaign-tracking-parameter-that-never-ends",
    url: "https://example.com/workspaces/acme/projects/q3-launch/docs/9f8e7d6c5b4a?tab=comments&filter=unresolved&deeply=nested&parameter=overflow&utm_source=very-long-campaign-tracking-parameter-that-never-ends",
    contentType: "text/html",
    fileSize: null,
    processingStatus: "ready",
    createdAt: "2026-01-02T13:00:00.000Z",
  },
  {
    id: "src-3",
    notebookId: "worst-case-notebook",
    folderId: null,
    kind: "file",
    modality: "audio",
    title: "Đặng Thị Ngọc Hân — Audio Lecture Transcriptions & Multi-Speaker Diarization",
    url: null,
    contentType: "audio/mpeg",
    fileSize: 45000000,
    processingStatus: "processing",
    processingStage: "transcribing",
    createdAt: "2026-01-03T14:00:00.000Z",
  },
  {
    id: "src-4",
    notebookId: "worst-case-notebook",
    folderId: null,
    kind: "file",
    modality: "dataset",
    title: "Corrupted_Database_Dump_2026_Archive_with_Uncaught_Exception_SyntaxError.csv",
    url: null,
    contentType: "text/csv",
    fileSize: 12000000,
    processingStatus: "failed",
    processingErrorCode: "ERR_BUFFER_OVERFLOW",
    processingErrorMessage:
      "Fatal error: Connection terminated abruptly due to invalid SSL handshake and malformed binary header sequence (code: ERR_BUFFER_OVERFLOW)",
    createdAt: "2026-01-04T15:00:00.000Z",
  },
  {
    id: "src-5",
    notebookId: "worst-case-notebook",
    folderId: null,
    kind: "url",
    modality: "document",
    title: "Financial Times — Macroeconomic Sovereign Debt Realignment in Sub-Saharan Africa",
    url: "https://example.com/ft-paywalled-article",
    contentType: "text/html",
    fileSize: null,
    processingStatus: "degraded",
    createdAt: "2026-01-05T16:00:00.000Z",
  },
  {
    id: "src-6",
    notebookId: "worst-case-notebook",
    folderId: null,
    kind: "text",
    modality: "document",
    title: "J",
    url: null,
    contentType: "text/plain",
    fileSize: 10,
    processingStatus: "ready",
    createdAt: "2026-01-06T17:00:00.000Z",
  },
  {
    id: "src-7",
    notebookId: "worst-case-notebook",
    folderId: "sf-2",
    kind: "text",
    modality: "document",
    title: "نور الهدى عبد الرحمن: دراسة في الفلسفة الإسلامية المعاصرة (1980-2025)",
    url: null,
    contentType: "text/plain",
    fileSize: 8500,
    processingStatus: "ready",
    createdAt: "2026-01-07T18:00:00.000Z",
  },
  {
    id: "src-8",
    notebookId: "worst-case-notebook",
    folderId: null,
    kind: "file",
    modality: "document",
    title: "Rindfleischetikettierungsüberwachungsaufgabenübertragungsgesetz.pdf",
    url: null,
    contentType: "application/pdf",
    fileSize: 320000,
    processingStatus: "ready",
    createdAt: "2026-01-08T19:00:00.000Z",
  },
  {
    id: "src-9",
    notebookId: "worst-case-notebook",
    folderId: null,
    kind: "text",
    modality: "document",
    title: "🦊 Fox & 👩🏽‍💻 Priya: Collaborative Research Notes & Experiments",
    url: null,
    contentType: "text/plain",
    fileSize: 12000,
    processingStatus: "ready",
    createdAt: "2026-01-09T20:00:00.000Z",
  },
  {
    id: "src-10",
    notebookId: "worst-case-notebook",
    folderId: null,
    kind: "text",
    modality: "document",
    title: "<script>alert('xss')</script> &amp; <b>Bold Title</b>",
    url: null,
    contentType: "text/plain",
    fileSize: 450,
    processingStatus: "ready",
    createdAt: "2026-01-10T21:00:00.000Z",
  },
  {
    id: "src-11",
    notebookId: "worst-case-notebook",
    folderId: null,
    kind: "text",
    modality: "document",
    title: "   Leading and Trailing Spaces Item   ",
    url: null,
    contentType: "text/plain",
    fileSize: 200,
    processingStatus: "ready",
    createdAt: "2026-01-11T22:00:00.000Z",
  },
];

export const worstCaseStudyMaterialFolders: FolderDTO[] = [
  {
    id: "smf-1",
    notebookId: "worst-case-notebook",
    parentId: null,
    name: "Konstantin Oberhauser-Wettstein's Comprehensive Exam Materials & Handouts",
    deletedAt: null,
    createdAt: "2026-01-12T00:00:00.000Z",
    updatedAt: "2026-01-12T00:00:00.000Z",
  },
  {
    id: "smf-2",
    notebookId: "worst-case-notebook",
    parentId: null,
    name: "Benachrichtigungseinstellungen & Study Guides (German Compound Test)",
    deletedAt: null,
    createdAt: "2026-01-13T00:00:00.000Z",
    updatedAt: "2026-01-13T00:00:00.000Z",
  },
];

export const worstCaseStudyMaterials: StudyMaterialDTO[] = [
  {
    id: "sm-1",
    notebookId: "worst-case-notebook",
    folderId: "smf-2",
    kind: "study_guide",
    title:
      "Rindfleischetikettierungsüberwachungsaufgabenübertragungsgesetz und Verbraucherschutzgrundlagenermittlungskatalog",
    content: { sections: [] },
    options: null,
    deletedAt: null,
    createdAt: "2026-01-14T00:00:00.000Z",
    updatedAt: "2026-01-14T00:00:00.000Z",
  },
  {
    id: "sm-2",
    notebookId: "worst-case-notebook",
    folderId: null,
    kind: "simple_flashcard",
    title: "Jo",
    content: { cards: [] },
    options: null,
    deletedAt: null,
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
  },
  {
    id: "sm-3",
    notebookId: "worst-case-notebook",
    folderId: null,
    kind: "quiz",
    title: "Quantum Electrodynamics: $\\int_{-\\infty}^{\\infty} e^{-x^2} dx$ & Metric Tensors $g_{\\mu\\nu}$",
    content: { questions: [] },
    options: null,
    deletedAt: null,
    createdAt: "2026-01-16T00:00:00.000Z",
    updatedAt: "2026-01-16T00:00:00.000Z",
  },
  {
    id: "sm-4",
    notebookId: "worst-case-notebook",
    folderId: null,
    kind: "mind_map",
    title: "خريطة المفاهيم: العلاقات السببية في المنطق الصوري المعاصر",
    content: { root: {} },
    options: null,
    deletedAt: null,
    createdAt: "2026-01-17T00:00:00.000Z",
    updatedAt: "2026-01-17T00:00:00.000Z",
  },
  {
    id: "sm-5",
    notebookId: "worst-case-notebook",
    folderId: null,
    kind: "practice_problems",
    title: "12,345 Practice Problems for Advanced Multilinear Tensor Calculus & Differential Topology",
    content: { problems: [] },
    options: null,
    deletedAt: null,
    createdAt: "2026-01-18T00:00:00.000Z",
    updatedAt: "2026-01-18T00:00:00.000Z",
  },
  {
    id: "sm-6",
    notebookId: "worst-case-notebook",
    folderId: null,
    kind: "slides",
    title: "Q3 Board Deck — FINAL (revised) v12 [approved by legal].pptx",
    content: { slides: [] },
    options: null,
    deletedAt: null,
    createdAt: "2026-01-19T00:00:00.000Z",
    updatedAt: "2026-01-19T00:00:00.000Z",
  },
];

export const worstCaseCitations: CitedSourceDTO[] = Array.from({ length: 12 }, (_, i) => ({
  id: `cite-${i + 1}`,
  schemaVersion: 1,
  citationKey: `key-${i + 1}`,
  chunkId: `chunk-${i + 1}`,
  chunkIndex: i,
  number: i + 1,
  title:
    i === 0
      ? "Supercalifragilisticexpialidocious_hyperparameter_optimization_analysis_for_extremely_deep_residual_recurrent_transformer_models_v2_final_final_approved_by_legal_2026_q4_revision.pdf"
      : i === 1
        ? "Jo"
        : `Citation ${i + 1}: Bartholomew Fitzgerald on Northwind Systems Architecture`,
  kind: i % 2 === 0 ? "file" : "url",
  url: `https://example.com/workspaces/acme/projects/q3-launch/docs/citation-${i + 1}?filter=all`,
  description: "Detailed theoretical explanation and empirical validation.",
  quote:
    "This quote contains an unbreakable sequence bartholomew.fitzgerald@northwind-industries-holdings.example.com that tests word wrapping inside citation hover cards.",
  isAvailable: true,
  sectionPath: ["Section 1", "Subsection B", "Paragraph 4"],
}));

export const worstCaseChatMessages: ChatMessageDTO[] = [
  {
    id: "msg-1",
    role: "user",
    content:
      "Can you summarize the document for bartholomew.fitzgerald@northwind-industries-holdings.example.com from https://example.com/workspaces/acme/projects/q3-launch/docs/9f8e7d6c5b4a?tab=comments&filter=unresolved? Also compare with Jo's findings.",
    parts: [
      {
        type: "text",
        text: "Can you summarize the document for bartholomew.fitzgerald@northwind-industries-holdings.example.com from https://example.com/workspaces/acme/projects/q3-launch/docs/9f8e7d6c5b4a?tab=comments&filter=unresolved? Also compare with Jo's findings.",
      },
    ],
    metadata: {},
    groundingMode: "strict",
    citedSourceIds: null,
    citedSources: [],
    createdAt: "2026-01-20T10:00:00.000Z",
  },
  {
    id: "msg-2",
    role: "assistant",
    content: `Based on the provided corpus, here is the synthesis for **Bartholomew Fitzgerald** (\`bartholomew.fitzgerald@northwind-industries-holdings.example.com\`) and **Aleksandra Wiśniewska-Kowalczyk** [1]:

### 1. Architectural Overview & Parameter Extremes

The system handles arbitrary tensor operations where \`Supercalifragilisticexpialidocious_hyperparameter_optimization_analysis_for_extremely_deep_residual_recurrent_transformer_models_v2_final_final\` requires:

$$\\mathcal{L}_{total} = \\sum_{i=1}^{N} \\lambda_i \\mathbb{E}_{x \\sim \\mathcal{D}} \\left[ \\| f_\\theta(x_i) - y_i \\|^2 \\right] + \\gamma \\Omega(\\Theta)$$

### 2. Multi-Column Metrics Comparison Table

| Identifier | Colleague Email | Status & Role | Baseline Accuracy | Latency (ms) | Throughput (req/s) | Validation Error Rate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **P-001** | \`bartholomew.fitzgerald@northwind-industries-holdings.example.com\` | Senior Product Design Engineer, Platform Infrastructure | 99.84% | 1,284.05 | 14,200 | 0.00000000012 |
| **P-002** | \`a@b.co\` | Intern [2] | 42.00% | 12.00 | 1,000,000 | 0.58000000000 |
| **P-003** | \`ops@sub.department.region.example.co.uk\` | Lead System Administrator | 88.50% | 340.50 | 54,000 | 0.01200000000 |

### 3. Edge Case Logic & Unbreakable Identifiers

\`\`\`typescript
const LONG_CONFIGURATION_STRING_WITHOUT_ANY_SPACES_OR_BREAKS_THAT_TESTS_HORIZONTAL_SCROLLING_BEHAVIOR = "https://example.com/workspaces/acme/projects/q3-launch/docs/9f8e7d6c5b4a?tab=comments&filter=unresolved&deeply=nested&parameter=overflow";
\`\`\`

Referenced sources [1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11], and [12] detail these exact findings.`,
    reasoning: `Analyzing user request regarding bartholomew.fitzgerald@northwind-industries-holdings.example.com.
Step 1: Extract entity mentions and cross-reference with cited corpus.
Step 2: Inspect URL parameters: tab=comments, filter=unresolved, tracking tags.
Step 3: Evaluate cognitive impact of pre-Socratic ontology vs modern LLM retrieval constraints.
Step 4: Formulate structured synthesis with tabular comparison and mathematical verification.
Finalizing response formulation with multi-citation referencing.`,
    parts: [
      {
        type: "reasoning",
        text: `Analyzing user request regarding bartholomew.fitzgerald@northwind-industries-holdings.example.com.
Step 1: Extract entity mentions and cross-reference with cited corpus.
Step 2: Inspect URL parameters: tab=comments, filter=unresolved, tracking tags.
Step 3: Evaluate cognitive impact of pre-Socratic ontology vs modern LLM retrieval constraints.
Step 4: Formulate structured synthesis with tabular comparison and mathematical verification.
Finalizing response formulation with multi-citation referencing.`,
      },
      {
        type: "text",
        text: `Based on the provided corpus, here is the synthesis for **Bartholomew Fitzgerald** (\`bartholomew.fitzgerald@northwind-industries-holdings.example.com\`) and **Aleksandra Wiśniewska-Kowalczyk** [1]:

### 1. Architectural Overview & Parameter Extremes

The system handles arbitrary tensor operations where \`Supercalifragilisticexpialidocious_hyperparameter_optimization_analysis_for_extremely_deep_residual_recurrent_transformer_models_v2_final_final\` requires:

$$\\mathcal{L}_{total} = \\sum_{i=1}^{N} \\lambda_i \\mathbb{E}_{x \\sim \\mathcal{D}} \\left[ \\| f_\\theta(x_i) - y_i \\|^2 \\right] + \\gamma \\Omega(\\Theta)$$

### 2. Multi-Column Metrics Comparison Table

| Identifier | Colleague Email | Status & Role | Baseline Accuracy | Latency (ms) | Throughput (req/s) | Validation Error Rate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **P-001** | \`bartholomew.fitzgerald@northwind-industries-holdings.example.com\` | Senior Product Design Engineer, Platform Infrastructure | 99.84% | 1,284.05 | 14,200 | 0.00000000012 |
| **P-002** | \`a@b.co\` | Intern [2] | 42.00% | 12.00 | 1,000,000 | 0.58000000000 |
| **P-003** | \`ops@sub.department.region.example.co.uk\` | Lead System Administrator | 88.50% | 340.50 | 54,000 | 0.01200000000 |

### 3. Edge Case Logic & Unbreakable Identifiers

\`\`\`typescript
const LONG_CONFIGURATION_STRING_WITHOUT_ANY_SPACES_OR_BREAKS_THAT_TESTS_HORIZONTAL_SCROLLING_BEHAVIOR = "https://example.com/workspaces/acme/projects/q3-launch/docs/9f8e7d6c5b4a?tab=comments&filter=unresolved&deeply=nested&parameter=overflow";
\`\`\`

Referenced sources [1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11], and [12] detail these exact findings.`,
      },
    ],
    metadata: {},
    groundingMode: "strict",
    citedSourceIds: worstCaseCitations.map((c) => ({
      schemaVersion: 1,
      citationKey: c.citationKey,
      sourceId: c.id,
      chunkId: c.chunkId,
      chunkIndex: c.chunkIndex,
      number: c.number,
      title: c.title,
      kind: c.kind,
      url: c.url,
      description: c.description,
      quote: c.quote,
      sectionPath: c.sectionPath,
      context: null,
    })),
    citedSources: worstCaseCitations,
    createdAt: "2026-01-20T10:01:00.000Z",
  },
  {
    id: "msg-3",
    role: "user",
    content: "Why?",
    parts: [{ type: "text", text: "Why?" }],
    metadata: {},
    groundingMode: "strict",
    citedSourceIds: null,
    citedSources: [],
    createdAt: "2026-01-20T10:02:00.000Z",
  },
  {
    id: "msg-4",
    role: "assistant",
    content: "Because the parameter limits outlined in [3] exceeded the capacity bound.",
    parts: [
      {
        type: "text",
        text: "Because the parameter limits outlined in [3] exceeded the capacity bound.",
      },
    ],
    metadata: {},
    groundingMode: "strict",
    citedSourceIds: [
      {
        schemaVersion: 1,
        citationKey: worstCaseCitations[2].citationKey,
        sourceId: worstCaseCitations[2].id,
        chunkId: worstCaseCitations[2].chunkId,
        chunkIndex: worstCaseCitations[2].chunkIndex,
        number: worstCaseCitations[2].number,
        title: worstCaseCitations[2].title,
        kind: worstCaseCitations[2].kind,
        url: worstCaseCitations[2].url,
        description: worstCaseCitations[2].description,
        quote: worstCaseCitations[2].quote,
        sectionPath: worstCaseCitations[2].sectionPath,
        context: null,
      },
    ],
    citedSources: [worstCaseCitations[2]],
    createdAt: "2026-01-20T10:02:30.000Z",
  },
];
