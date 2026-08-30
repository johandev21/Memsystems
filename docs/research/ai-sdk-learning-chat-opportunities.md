# AI SDK opportunities for a better learning chat

**Research date:** 2026-08-29  
**Scope:** The notebook chat, AI SDK 6, images, files, audio, learning tools, persistence, quality checks, and monitoring. This report does not propose an app-code change.

## Short answer

Memsystems already has the base of a useful study chat. It streams answers, saves the chat in each notebook, retrieves relevant source passages, shows inline references, lets the learner choose a model, and can show model reasoning.

The main opportunity is not “more chat.” It is a shift from an answer box to a study loop:

1. Let the learner show the problem with an image, file, or voice note.
2. Ask the learner to recall or explain before showing the answer.
3. Give clear feedback that points back to notebook sources.
4. Let the learner save the result as a quiz, flashcard set, roadmap, or mind map.
5. Measure whether the loop helps, not only whether the model returns text.

The AI SDK can support this direction. It has message parts for text, files, reasoning, sources, tool calls, and custom data. It also has structured output, image generation, speech, transcription, stream recovery, testing helpers, and optional telemetry. Each provider and model supports a different subset, so the app must show only the actions that the selected model can use. The [AI SDK Core overview](https://ai-sdk.dev/docs/ai-sdk-core) lists these feature groups, and the [prompt guide](https://ai-sdk.dev/docs/foundations/prompts) notes that file support depends on the provider and model.

## What the app has now

The table below is based on the current repository, not only on the README.

| Area | Current state | Evidence |
|---|---|---|
| Live answers | Good base. The server uses `streamText`, sends text and reasoning as they arrive, and saves a partial answer when the learner stops it. | [chat.service.ts](../../backend/src/modules/chat/chat.service.ts) |
| Notebook context | Good base. Each turn retrieves relevant chunks from notebook sources. The prompt asks for source-backed claims and stable reference keys. | [chat.service.ts](../../backend/src/modules/chat/chat.service.ts), [chat-citations.ts](../../backend/src/modules/chat/chat-citations.ts) |
| References | Good base. Saved answers include source, chunk, quote, and availability data. The UI can show a reference popover. | [chat-citations.ts](../../backend/src/modules/chat/chat-citations.ts), [reference-popover.tsx](../../frontend/src/features/notebook-chat/components/reference-popover.tsx) |
| Saved history | Present, but narrow. The database saves role, plain text, reasoning, and citations. It does not save the full message parts that files, tools, and rich study cards need. | [schema.ts](../../backend/src/database/schema.ts), [chat.ts](../../frontend/src/features/notebook-chat/api/chat.ts) |
| Conversation memory | Limited. The learner can see the full saved history, but the model receives only the six most recent messages. There is no summary of older turns. | [chat.service.ts](../../backend/src/modules/chat/chat.service.ts) |
| Tutor behavior | Too passive for active study. The current system prompt tells the tutor not to ask follow-up questions unless they are required. This makes it harder to check recall, ask for an explanation, or adapt the next step to the learner's answer. | [chat.service.ts](../../backend/src/modules/chat/chat.service.ts) |
| Reasoning | Partly complete. Reasoning is shown while an answer streams and is saved by the server. After a reload, the frontend rebuilds each saved message with only its text, so saved reasoning is not restored. | [chat.service.ts](../../backend/src/modules/chat/chat.service.ts), [use-chat-panel.ts](../../frontend/src/features/notebook-chat/hooks/use-chat-panel.ts) |
| Images and files in chat | UI groundwork exists, but notebook chat is text-only. The shared prompt input can prepare file parts. The notebook composer does not show the attachment action, the transport removes all non-text parts, and the server accepts only text and reasoning. | [prompt-input.tsx](../../frontend/src/features/ai/components/prompt-input/prompt-input.tsx), [composer.tsx](../../frontend/src/features/notebook-chat/components/composer.tsx), [use-chat-panel.ts](../../frontend/src/features/notebook-chat/hooks/use-chat-panel.ts), [chat.controller.ts](../../backend/src/modules/chat/chat.controller.ts) |
| Audio | Missing from chat. There is no voice recording, transcription, audio-message handling, or read-aloud response path. | [notebook-chat feature](../../frontend/src/features/notebook-chat), [chat module](../../backend/src/modules/chat) |
| Study actions in chat | Missing. Chat does not give the model tools to create or update a quiz, flashcard set, roadmap, or mind map. Those study-material flows exist outside chat. | [chat.service.ts](../../backend/src/modules/chat/chat.service.ts), [study-materials module](../../backend/src/modules/study-materials) |
| Error and retry experience | Incomplete. The hook refreshes cached data after an error, but it does not expose a visible chat error or retry control. AI SDK provides both error state and regeneration for this use case. | [use-chat-panel.ts](../../frontend/src/features/notebook-chat/hooks/use-chat-panel.ts), [AI SDK error handling](https://ai-sdk.dev/docs/ai-sdk-ui/error-handling) |
| Copy and regenerate | Incomplete. Handlers reach the message list, but the assistant message does not render either action. Regeneration also needs server rules so it replaces a saved answer instead of adding duplicate history. | [chat-message-list.tsx](../../frontend/src/features/notebook-chat/components/chat-message-list.tsx), [assistant-message.tsx](../../frontend/src/features/notebook-chat/components/assistant-message.tsx), [useChat reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat) |
| Quality and cost data | Missing from the chat record. There is no saved model ID, token use, finish reason, response time, learner rating, or learning result. | [schema.ts](../../backend/src/database/schema.ts) |

## What AI SDK adds

### 1. One message can contain more than text

AI SDK separates the message shown in the interface from the smaller message sent to the model. A UI message can contain text, a file, reasoning, a source, a tool state, custom data, and metadata. This makes one saved message a good home for a learner's image, a source card, or an interactive quiz card. See the official [`UIMessage` reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message).

`useChat` can send file attachments. Image and text files are converted automatically; other file types need app code. The official [chatbot guide](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot#attachments) gives the attachment flow. The model-facing message format accepts text with images and files, while actual support still depends on the selected provider and model. See [`ModelMessage`](https://ai-sdk.dev/docs/reference/ai-sdk-core/model-message) and the [file-prompt guide](https://ai-sdk.dev/docs/foundations/prompts#file-parts).

**Product use:** A learner can attach a photo of a handwritten step, a diagram, a chart, or a page and ask a question about it.

### 2. Voice can enter as text, and answers can play as audio

AI SDK has an experimental transcription function. It accepts common binary or URL forms and can return text, segments, language, and duration when the provider supplies them. See [Transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription).

AI SDK also has experimental speech generation. It turns text into audio and supports provider-specific choices such as voice, language, speed, and file format. See [Speech](https://ai-sdk.dev/docs/ai-sdk-core/speech).

Some language models accept audio directly, but this support is much narrower than text or image support. For example, the official OpenAI provider page documents audio input only for specific audio models and also lists separate transcription and speech models. See the [OpenAI provider guide](https://ai-sdk.dev/providers/ai-sdk-providers/openai#audio-input).

**Product use:** Start with “record, transcribe, edit, send.” This gives the learner control over the words before the question enters the chat. Add “read this answer aloud” as an optional action. Do not make audio the only way to receive an answer.

### 3. Tools can turn a reply into a study action

AI SDK tools can run on the server, run in the browser, or wait for user approval. Tool calls and results can appear as parts of the assistant message. See the official [chat tool guide](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage) and [tool approval guide](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#tool-execution-approval).

**Product use:** Give the tutor a small, safe set of study tools:

- `quiz_me`: ask one question and wait for the learner's answer.
- `check_my_answer`: compare the answer with cited source passages and give corrective feedback.
- `explain_my_step`: inspect a learner's written or photographed work.
- `make_flashcards`, `make_quiz`, `make_roadmap`, and `make_mind_map`: prepare a study material from the current exchange.
- `save_study_material`: save only after the learner confirms the preview.

The last step must require approval because it changes notebook data. The model can suggest an action, but the learner stays in control.

### 4. Structured output can make reliable cards and previews

AI SDK can ask a model for data that follows an app-defined shape. It validates the result against that shape and can combine this with tool calls. See [Generating Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data).

AI SDK can also stream custom data parts and update a part with the same ID. These parts are suitable for live status, interactive content, and source cards. See [Streaming Custom Data](https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data). Tool parts can render a matching React component, which the official docs call a generative user interface. See [Generative User Interfaces](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces).

**Product use:** Render a real question card with “Show hint,” “Check answer,” confidence, feedback, and “Save to study materials.” Do not ask the model to imitate this interface with Markdown.

### 5. Sources can be first-class message parts

AI SDK UI has source parts for URLs and documents, and the stream protocol can send them with the answer. Some providers can also return web sources from the generation result. See [`UIMessage` source parts](https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message#sourceurluipart), [streamed data and sources](https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data#sources), and [provider sources](https://ai-sdk.dev/docs/ai-sdk-core/generating-text#sources).

**Product use:** Keep the current chunk-level notebook references. They contain more useful local detail than a plain URL. In a later cleanup, carry them as typed message data or source parts so references can appear during the stream and survive in the same message record as the answer. This is a data-model improvement, not a reason to discard the current citation work.

### 6. Image generation is available, but it is not the first priority

AI SDK has `generateImage` for image models and returns the generated image plus media type and usage data. See [Image Generation](https://ai-sdk.dev/docs/ai-sdk-core/image-generation).

**Product use:** It can create a mnemonic scene or a simple concept illustration. For factual diagrams, prefer the app's structured mind map or another checked diagram format. A free-form generated image is harder to verify against a source. Label all generated images and keep the source-backed text beside them.

### 7. Chat streams can be saved and, with extra storage, resumed

The AI SDK persistence guide recommends saving the UI message form because it contains the parts and state required by the interface. It also recommends validating saved messages that contain tools, metadata, or custom data before use. See [Chatbot Message Persistence](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence).

`useChat` can reconnect to an active stream after a reload, but the app must add stream storage and resume endpoints. The official guide also states that stream resume is not compatible with abort behavior. See [Chatbot Resume Streams](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams).

**Product use:** Keep the Stop button for normal tutor answers. Do not add resume only because the SDK has it. Use background completion or stream resume for long work, such as a large study-material generation, where a reload must not lose the result.

### 8. Testing and monitoring can make model changes safer

AI SDK includes mock models and stream helpers for repeatable tests without a provider call. See [Testing](https://ai-sdk.dev/docs/ai-sdk-core/testing). It also has experimental OpenTelemetry support for selected generation calls. This can record traces that help inspect model use and timing. See [Telemetry](https://ai-sdk.dev/docs/ai-sdk-core/telemetry).

AI SDK DevTools can inspect prompts, results, tool calls, token use, and timing during local development. The official guide warns that it stores AI interactions as plain text and is for local development only. See [DevTools](https://ai-sdk.dev/docs/ai-sdk-core/devtools).

**Product use:** Add fixed chat checks for answer accuracy, citation support, malformed model output, image input, tool approval, interrupted streams, and deleted sources. Add a small model evaluation set before changing the default model. Vercel's [introduction to evaluations](https://vercel.com/kb/guide/an-introduction-to-evals) describes evaluations as tests for variable model output.

## Which ideas are likely to help learning?

These are product recommendations, not promises made by AI SDK.

- **Ask before telling.** In a controlled study, retrieval practice produced larger gains in meaningful learning than elaborative study with concept mapping. This supports a “try an answer first” mode, not a chat that gives the full answer at once. See [Karpicke and Blunt, 2011](https://pubmed.ncbi.nlm.nih.gov/21252317/).
- **Give corrective feedback.** Two experiments found that feedback improved later retention, including for correct answers given with low confidence. This supports answer checking, confidence input, and clear correction. See [Butler, Karpicke, and Roediger, 2008](https://pubmed.ncbi.nlm.nih.gov/18605878/).
- **Ask for self-explanation.** A study of learners using worked examples found that stronger learners generated more explanations, linked steps to principles, and monitored gaps in their understanding more accurately. This supports prompts such as “Why does this step work?” and “Which source passage supports your answer?” See [Chi et al., 1989](https://doi.org/10.1207/s15516709cog1302_1).

These studies support a direction, not a universal result for every learner or subject. Memsystems still needs its own outcome checks.

## Recommended plan

### Phase 0 — Make the current chat dependable

Do this before adding new media.

1. Show a clear error state with Retry. Preserve the learner's draft after a failure.
2. Finish the visible Copy and Regenerate actions.
3. Define regeneration rules in the database. A retry must replace or branch from an answer; it must not create a duplicate user turn.
4. Save and restore the full ordered message parts. Fix saved reasoning so a reload matches the live chat.
5. Save basic message metadata: selected model, creation and finish time, finish reason, and token use when available. AI SDK message metadata is designed for values such as model, token use, timestamps, and performance data. See [Message Metadata](https://ai-sdk.dev/docs/ai-sdk-ui/message-metadata).
6. Add model capability flags for image input, file input, audio input, tools, structured output, and reasoning. Hide or explain an action when the selected model cannot do it.

### Phase 1 — Add the highest-value learning loop

1. Replace the blanket “do not ask follow-up questions” rule with clear chat modes. Normal questions can get a direct answer. Study mode should ask one useful question at a time and adapt to the learner's reply.
2. Add image attachment to notebook chat with a preview, remove action, file limits, and an accessible description field.
3. Add voice recording through transcription. Put the transcript in the composer so the learner can edit it before send.
4. Add a “Quiz me” interaction that asks one question, waits, checks the answer, asks for confidence, and gives cited feedback.
5. Add a preview-and-confirm tool that turns the exchange into an existing study material.
6. Stream the study state as typed parts: question, learner answer, checking, feedback, and saved result.

### Phase 2 — Improve continuity and choice

1. Add more than one chat thread inside a notebook. Give each thread a short title.
2. Add Edit and Branch from this message. AI SDK `regenerate` can target a specific message, but the app must define and save the branch. See the [`useChat` reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat#regenerate).
3. Summarize older turns instead of silently dropping all but the last six. Keep source IDs and unresolved learner questions in that summary.
4. Add “Read aloud” to assistant messages. Generate and cache audio only when requested.
5. Consider direct PDF or other file attachments only after the app defines whether the item is a temporary chat attachment or a reusable notebook source.

### Phase 3 — Measure learning quality

1. Add an optional “Did this help you understand?” rating with short issue choices: unclear, unsupported, too much detail, too little detail, or wrong level.
2. Track study outcomes such as first-attempt answer, confidence, correction, later retry, and study-material use. Do not treat message count as learning.
3. Build a small evaluation set from safe sample notebooks. Include source-backed questions, questions that the sources cannot answer, image questions, and misconceptions.
4. Compare models on correctness, source support, feedback quality, delay, and cost before changing defaults.
5. Keep prompt and content capture private. Use local DevTools only with non-sensitive test data. In production, record the minimum telemetry needed for quality and operations.

## Suggested first release

A focused first release can be small:

- Fix visible Retry and correct Regenerate behavior.
- Store full message parts and metadata.
- Add image attachment for models that support images.
- Add record → transcribe → edit → send.
- Add one structured `quiz_me` tool with answer feedback and source references.
- Add one confirmed `save_study_material` action.
- Add a 20–30 case evaluation set for the main notebook subjects.

This release would make the chat more useful without turning it into a broad autonomous agent. It would also reuse Memsystems' strongest product concepts: notebooks, sources, references, and study materials.

## Important limits

- Provider and model support varies. A feature in AI SDK does not mean every model in the current selector can use it.
- Speech and transcription are experimental AI SDK features at the research date. Their API can change.
- A file attachment can contain private or unsafe data. Apply size limits, media checks, access control, retention rules, and clear deletion behavior.
- Do not store large data URLs in chat rows. Put durable files in the existing storage layer and save an owned reference in the message.
- Do not expose private model reasoning as if it were a teaching explanation. A short, source-backed explanation made for the learner is a different product feature.
- Tools that change notebook data must show a preview and require learner approval.
- Generated images and model feedback can be wrong. Keep references visible and test the learning flow with real users.

## Source policy

AI SDK claims in this report use official `ai-sdk.dev` or Vercel pages. Learning claims use the original study record or publisher DOI. Repository claims link to the current local files. No secondary AI SDK tutorial was used.
