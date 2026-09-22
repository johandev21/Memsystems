# Memsystems

Memsystems is a single-user study workspace. A person collects source material in a notebook, chats with an AI about that material, and generates study materials from it.

For the system overview, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). This file is only the vocabulary.

## Language

### Workspace

**Notebook**:
The top-level study workspace. It owns sources, chat, and study materials.
_Avoid_: project, workspace, board

**Library**:
The home collection that organizes notebooks into library folders.
_Avoid_: dashboard, home, shelf

**Library Folder**:
A folder in the library that groups notebooks. It can contain notebooks and other library folders.
_Avoid_: folder, directory (use the full name)

**Study Material Folder**:
A folder inside one notebook that groups study materials. It is a different hierarchy from the library folder.
_Avoid_: folder, directory (use the full name)

**Studio**:
The right-hand pane of a notebook. It hosts the generation entries and the study material tree.
_Avoid_: sidebar, resources panel

**Banner**:
The cover image of a notebook. It has several size variants and a focal point.
_Avoid_: cover, thumbnail

**Artwork**:
The generated folder and notebook visuals on the library cards.
_Avoid_: cover, illustration

### Sources

**Source**:
Material ingested into a notebook. A source is text, a URL, or a file.
_Avoid_: document, artifact, resource

**Source Version**:
An immutable interpretation of a source's content. New extractions and transcripts create new versions.
_Avoid_: revision, snapshot

**Degraded Source**:
A source whose extracted content was judged unusable, such as navigation-only text or a paywall page. It keeps its version for inspection but is never used as Evidence.
_Avoid_: failed source, broken source

**Source Segment**:
An ordered semantic unit of a source version, such as a heading, table, formula, or transcript line.
_Avoid_: block, section

**Source Chunk**:
An embedding unit derived from source segments. Retrieval returns chunks.
_Avoid_: passage, fragment

**Processing Stage**:
The current step of source ingestion: uploading, extracting, transcribing, analyzing visuals, or indexing.
_Avoid_: phase, step, status

**Upload Intent**:
A short-lived, single-use record that authorizes one file upload. The file is consumed only after the finalize step.
_Avoid_: upload token, ticket

**Web Search**:
Discovery of candidate sources from the web. The user imports the useful candidates into a notebook.
_Avoid_: crawl, scraping

### Study materials

**Study Material**:
An artifact generated from sources. Each study material has exactly one kind.
_Avoid_: resource, content, artifact

**Kind**:
One of the eight fixed study material types: quiz, simple flashcard, roadmap, mind map, slides, study guide, practice problems, or case study.
_Avoid_: type, category

**Flashcards**:
The user-facing name of the `simple_flashcard` kind.
_Avoid_: cards, deck

**Brief**:
The user's written instructions and options for one generation.
_Avoid_: prompt (reserve "prompt" for chat input)

**Generation**:
The streaming creation of one study material from a brief and selected sources.
_Avoid_: synthesis, creation

**Generation Request**:
The persisted record of a generation stream. The client uses its id to cancel the generation.
_Avoid_: job, task

**Material Viewer**:
The full-screen component that renders one study material and its per-kind interactions.
_Avoid_: player, preview

**Trash**:
The set of soft-deleted study materials and study material folders inside a notebook.
_Avoid_: recycle bin, archive

**Study Material Tree**:
The tree in the studio that shows study material folders and study materials, with drag and drop and keyboard navigation.
_Avoid_: file tree, explorer

### AI and chat

**Chat**:
The notebook conversation with the AI, grounded in the notebook's sources.
_Avoid_: conversation, messages

**Turn**:
One user message and the assistant reply that follows it. The UI groups messages into turns.
_Avoid_: exchange, round

**Citation**:
A link from an assistant message to the source evidence that the message used. Each citation has a key such as R1.
_Avoid_: reference, footnote

**Evidence**:
A retrieved source passage that the AI can cite. Evidence exists only for the current reply.
_Avoid_: context, passage

**Gateway**:
The AI provider connection configured in settings. It supplies the model catalog and runs the models.
_Avoid_: provider, API

**Model**:
One AI model from the gateway catalog. The user selects a model per notebook, with a global fallback.
_Avoid_: LLM, engine

**Embeddings Connection**:
The Voyage AI connection used to embed and retrieve source chunks.
_Avoid_: vector store, index

**Lexical Leg**:
The full-text half of hybrid retrieval. It matches the exact terms, names, numbers, and identifiers of a query against a chunk's searchable text.
_Avoid_: keyword search, BM25

**Reciprocal Rank Fusion**:
The rank-based merge of the dense and lexical candidate lists. It orders by the ranks each list gave a candidate instead of comparing their scores.
_Avoid_: score fusion, reranking (reranking is the later cross-encoder stage)

**Query Understanding**:
The retrieval stage that turns a chat message into the query the search legs run. It strips instructions about tone, length, and format, resolves follow-up references from the recent turns, and can add paraphrases that are fused with the primary query.
_Avoid_: query rewriting, query expansion, query planning

**Rewritten Query**:
The search query query understanding produced from a chat message. It is what the legs and the reranker run, and what the retrieval trace records alongside the original message.
_Avoid_: transformed query, expanded query

**Hypothetical Answer**:
A generated passage that would answer a short query, embedded for the dense leg when the query itself carries too little to match on.
_Avoid_: HyDE, pseudo-document, generated document

**Evidence Assembly**:
The stage that turns the candidates above the relevance threshold into the final Evidence set: overlapping passages collapse, a Source cannot fill the set, selected passages carry their section context, and the set stays inside the token budget.
_Avoid_: context packing, truncation, evidence selection

**Supporting Span**:
The one or two sentences of a Source Chunk that a Citation points at, instead of the whole chunk.
_Avoid_: excerpt, snippet (the excerpt is the stored text; the span is the passage it points at)

**Nearest-Evidence Attribution**:
The post-generation check that links a claim the model left unmarked to the Evidence passage that best supports it.
_Avoid_: auto-citation, inferred citation

### Settings and appearance

**Palette**:
An accent color set for the whole app, selected on the appearance settings card.
_Avoid_: theme (use the full name)

**Scheme**:
The light or dark mode of the app, selected independently of the palette.
_Avoid_: mode, theme (use the full name)

**Base Language**:
The language that the app sends to chat and generation prompts. It follows the interface language.
_Avoid_: locale, language (reserve "language" for the interface)
