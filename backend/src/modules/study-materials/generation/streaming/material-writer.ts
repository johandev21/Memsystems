import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../../../database/schema';
import {
  generationRequests,
  studyMaterialAudio,
  studyMaterials,
} from '../../../../database/schema';
import {
  attachGenerationCitations,
  extractGenerationCitations,
} from '../generation-citations';
import type { GenerationGrounding } from '../generation-grounding';
import type { StartGenerationInput as StreamInput } from '../generation-request-manager';
import { generateTitle } from '../../content/content-normalizer';
import { withSlidePreviews } from '../../slides/slides-preview';
import { KokoroSpeechService } from '../../audio/kokoro-speech.service';
import { stripGeneralKnowledgeSupplement } from '../generation-supplement';
import { AudioGenerationError, isAbortError } from './stream-errors';
import { assertGeneratedWav, stripCitationMarkers } from './audio-output';

export class GenerationMaterialWriter {
  constructor(
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly speechService?: KokoroSpeechService,
  ) {}

  async saveMaterial(
    notebookId: string,
    input: StreamInput,
    normalized: unknown,
    storable: Record<string, unknown>,
    options: Record<string, unknown> | null,
    requestId: string,
    signal?: AbortSignal,
    onAudioSynthesisStart?: () => void,
  ) {
    const values = {
      notebookId,
      kind: input.kind,
      title: generateTitle(input.kind, normalized),
      content: storable,
      options,
      folderId: input.folderId ?? null,
    };
    if (input.kind !== 'audio_overview') {
      const [inserted] = await this.db
        .insert(studyMaterials)
        .values(values)
        .returning();
      return inserted;
    }
    try {
      if (!this.speechService)
        throw new Error('Speech synthesis is not configured.');
      onAudioSynthesisStart?.();
      const audioContent = storable as {
        transcript: string;
        sections?: Array<{
          heading: string;
          text: string;
          turns?: Array<{ speaker: 'host' | 'guest'; text: string }>;
        }>;
      };
      const speechSections = audioContent.sections?.length
        ? audioContent.sections.map(({ heading, text, turns }) => ({
            text: `${heading}. ${stripCitationMarkers(text)}`,
            ...(turns
              ? {
                  turns: turns.map((turn) => ({
                    speaker: turn.speaker,
                    text: stripCitationMarkers(turn.text),
                  })),
                }
              : {}),
          }))
        : [{ text: stripCitationMarkers(audioContent.transcript) }];
      const audio = await this.speechService.synthesizeSections(
        speechSections,
        input.language ?? 'en',
        signal,
      );
      if (signal?.aborted)
        throw new DOMException('Generation cancelled', 'AbortError');
      assertGeneratedWav(audio);
      return await this.db.transaction(async (tx) => {
        const [request] = await tx
          .select({ status: generationRequests.status })
          .from(generationRequests)
          .where(eq(generationRequests.id, requestId))
          .for('update');
        if (signal?.aborted || request?.status !== 'streaming')
          throw new DOMException('Generation cancelled', 'AbortError');
        let inserted: typeof studyMaterials.$inferSelect;
        if (input.replaceMaterialId) {
          const [existing] = await tx
            .select()
            .from(studyMaterials)
            .where(eq(studyMaterials.id, input.replaceMaterialId))
            .for('update');
          if (
            !existing ||
            existing.notebookId !== notebookId ||
            existing.kind !== 'audio_overview' ||
            existing.deletedAt
          )
            throw new Error(
              'The Audio Overview selected for replacement is unavailable.',
            );
          [inserted] = await tx
            .update(studyMaterials)
            .set({
              title: values.title,
              content: storable,
              options,
            })
            .where(eq(studyMaterials.id, existing.id))
            .returning();
          const [audioRow] = await tx
            .select({ id: studyMaterialAudio.studyMaterialId })
            .from(studyMaterialAudio)
            .where(eq(studyMaterialAudio.studyMaterialId, existing.id));
          if (audioRow)
            await tx
              .update(studyMaterialAudio)
              .set({ audio, contentType: 'audio/wav' })
              .where(eq(studyMaterialAudio.studyMaterialId, existing.id));
          else
            await tx.insert(studyMaterialAudio).values({
              studyMaterialId: existing.id,
              audio,
              contentType: 'audio/wav',
            });
        } else {
          [inserted] = await tx
            .insert(studyMaterials)
            .values(values)
            .returning();
          await tx.insert(studyMaterialAudio).values({
            studyMaterialId: inserted.id,
            audio,
            contentType: 'audio/wav',
          });
        }
        if (signal?.aborted)
          throw new DOMException('Generation cancelled', 'AbortError');
        return inserted;
      });
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) throw error;
      throw new AudioGenerationError(
        error instanceof Error ? error.message : 'Audio synthesis failed.',
      );
    }
  }

  prepareStorable(
    input: StreamInput,
    validated: unknown,
    grounding: Pick<GenerationGrounding, 'sources' | 'evidence'>,
  ): Record<string, unknown> {
    const storable: Record<string, unknown> =
      input.kind === 'slides'
        ? withSlidePreviews(validated as Record<string, unknown>)
        : (validated as Record<string, unknown>);
    if (input.kind === 'audio_overview') {
      const audio = storable as {
        sections: Array<{
          heading: string;
          text: string;
          turns?: Array<{ speaker: 'host' | 'guest'; text: string }>;
        }>;
      };
      audio.sections = audio.sections.map((section) => {
        const turns = section.turns?.map((turn) => ({
          ...turn,
          text: stripCitationMarkers(turn.text),
        }));
        const text = turns
          ? turns.map((turn) => turn.text).join(' ')
          : stripCitationMarkers(section.text);
        return {
          ...section,
          ...(turns ? { turns } : {}),
          text,
          citations: extractGenerationCitations(section, grounding.evidence),
        };
      });
      (audio as { transcript?: string }).transcript = audio.sections
        .map((section) => section.text)
        .join('\n\n');
    }
    const audioCitations =
      input.kind === 'audio_overview'
        ? (
            (
              storable as {
                sections: Array<{
                  citations: ReturnType<typeof extractGenerationCitations>;
                }>;
              }
            ).sections ?? []
          ).flatMap((section) => section.citations)
        : null;
    const allCitations =
      audioCitations ??
      extractGenerationCitations(storable, grounding.evidence);
    const withCitations = attachGenerationCitations(storable, allCitations);
    if (input.groundingMode === 'moderate') return withCitations;
    return stripGeneralKnowledgeSupplement(withCitations);
  }
}
