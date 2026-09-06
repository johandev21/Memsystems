import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { sourcesQueryOptions, type Source } from "@/features/sources";
import {
  CaseStudyContent,
  type CaseStudyAnalysisType,
  type CaseStudyQuestionType,
} from "../shapes/case-study";
import { hashCaseStudyQuestion, useCaseStudyProgress } from "./useCaseStudyProgress";

interface CaseStudyViewProps {
  materialId: string;
  content: unknown;
  notebookId: string;
  onOpenSource?: () => void;
}

export function CaseStudyView({
  materialId,
  content,
  notebookId,
  onOpenSource,
}: CaseStudyViewProps) {
  const parsed = CaseStudyContent.safeParse(content);
  if (!parsed.success) {
    return (
      <p role="alert" className="p-6 text-text-secondary">
        This case study could not be read. Try reopening it or generating a new case.
      </p>
    );
  }
  return (
    <CaseStudyReader
      study={parsed.data}
      materialId={materialId}
      notebookId={notebookId}
      onOpenSource={onOpenSource}
    />
  );
}

function CaseStudyReader({
  study,
  materialId,
  notebookId,
  onOpenSource,
}: {
  study: ReturnType<typeof CaseStudyContent.parse>;
  materialId: string;
  notebookId: string;
  onOpenSource?: () => void;
}) {
  const progress = useCaseStudyProgress(materialId);
  const [confirmReset, setConfirmReset] = useState(false);
  const analysesByQuestion = useMemo(() => {
    const map: Record<string, CaseStudyAnalysisType> = {};
    for (const analysis of study.analyses) {
      map[analysis.questionId] = analysis;
    }
    return map;
  }, [study.analyses]);
  const hashes = useMemo(() => {
    const map: Record<string, string> = {};
    for (const question of study.questions) {
      map[question.id] = hashCaseStudyQuestion(question);
    }
    return map;
  }, [study.questions]);
  const hasProgress = study.questions.some((question) => {
    const entry = progress.getEntry(
      question.id,
      hashes[question.id],
      analysesByQuestion[question.id]?.checklist.length ?? 0,
    );
    return entry.response.length > 0 || entry.revealed || entry.checklist.some(Boolean);
  });
  const referencedIds = useMemo(() => {
    const ids = new Set<string>([...study.sourceIds]);
    for (const analysis of study.analyses) {
      for (const id of analysis.sourceIds) ids.add(id);
      for (const app of analysis.conceptApplications) {
        for (const id of app.sourceIds) ids.add(id);
      }
      for (const alt of analysis.alternativePerspectives) {
        for (const id of alt.sourceIds) ids.add(id);
      }
    }
    return [...ids];
  }, [study]);
  const sources = useQuery({
    ...sourcesQueryOptions(notebookId),
    enabled: referencedIds.length > 0,
  });

  const openSource = (sourceId: string) => {
    onOpenSource?.();
    window.dispatchEvent(new CustomEvent("open-source-viewer", { detail: { sourceId } }));
  };

  return (
    <article className="mx-auto w-full max-w-3xl space-y-8 py-3 text-text-primary sm:space-y-10 sm:py-6">
      <header className="space-y-4">
        <p className="text-xs font-medium text-text-tertiary">Case Study</p>
        <h1 className="text-[1.75rem] leading-tight font-semibold break-words sm:text-3xl">
          {study.title.replace(/-case-study$/, "").replaceAll("-", " ")}
        </h1>
        {study.sourceIds.length === 0 ? (
          <p className="text-sm text-text-tertiary">Generated without notebook sources.</p>
        ) : (
          <p className="text-sm text-text-tertiary">
            Generated from {study.sourceIds.length} notebook source
            {study.sourceIds.length === 1 ? "" : "s"}.
          </p>
        )}
        {study.conceptsFocus && (
          <p className="text-sm text-text-secondary">
            <span className="font-medium">Focus:</span> {study.conceptsFocus}
          </p>
        )}
      </header>
      <section className="space-y-3" aria-label="Learning Objectives">
        <h2 className="text-xl font-semibold">Learning Objectives</h2>
        <ul className="list-disc space-y-2 pl-5">
          {study.learningObjectives.map((objective, i) => (
            <li key={i}>
              <CaseMarkdown text={objective} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Case scenario" className="space-y-4">
        <h2 className="text-xl font-semibold break-words sm:text-2xl">{study.scenario.title}</h2>
        <p className="text-sm text-text-secondary">
          This scenario is fictional. Any supporting sources apply to the analysis.
        </p>
        <p className="text-sm text-text-secondary">{study.scenario.setting}</p>
        <CaseMarkdown text={study.scenario.narrative} />
      </section>

      {study.facts.length > 0 && (
        <section aria-label="Relevant Facts" className="space-y-3">
          <h2 className="text-xl font-semibold">Relevant Facts</h2>
          <ul className="list-disc space-y-2 pl-5">
            {study.facts.map((fact, i) => (
              <li key={i}>
                <CaseMarkdown text={fact} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {referencedIds.length > 0 && sources.isPending && (
        <p role="status">Loading source references…</p>
      )}
      {referencedIds.length > 0 && sources.isError && (
        <div role="alert" className="text-sm text-text-secondary">
          Source references could not be loaded.{" "}
          <Button variant="outline" size="sm" onClick={() => void sources.refetch()}>
            Retry References
          </Button>
        </div>
      )}

      <p role={progress.storageError ? "alert" : "status"} className="text-sm text-text-secondary">
        {progress.storageError ?? "Progress is saved on this device."}
      </p>
      {study.questions.map((question, index) => (
        <CaseQuestion
          key={question.id}
          question={question}
          index={index}
          analysis={analysesByQuestion[question.id]}
          contentHash={hashes[question.id]}
          sources={sources.data ?? []}
          sourcesLoaded={sources.isSuccess}
          openSource={openSource}
          progress={progress}
        />
      ))}
      {hasProgress && (
        <footer className="space-y-3">
          {confirmReset ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <p className="w-full">
                Clear all responses, checklist selections, and revealed analyses on this device?
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  progress.resetAll();
                  setConfirmReset(false);
                }}
              >
                Confirm Reset
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
              Reset Progress
            </Button>
          )}
        </footer>
      )}
    </article>
  );
}

function CaseQuestion({
  question,
  index,
  analysis,
  contentHash,
  sources,
  sourcesLoaded,
  openSource,
  progress,
}: {
  question: CaseStudyQuestionType;
  index: number;
  analysis?: CaseStudyAnalysisType;
  contentHash: string;
  sources: Source[];
  sourcesLoaded: boolean;
  openSource: (id: string) => void;
  progress: ReturnType<typeof useCaseStudyProgress>;
}) {
  const checklistLength = analysis?.checklist.length ?? 0;
  const entry = progress.getEntry(question.id, contentHash, checklistLength);

  return (
    <section aria-label={`Question ${index + 1}`} className="space-y-6">
      <h2 className="text-xl font-semibold sm:text-2xl">Question {index + 1}</h2>
      <CaseMarkdown text={question.prompt} />
      {question.hint && <p className="text-sm text-text-tertiary">Hint: {question.hint}</p>}

      <div className="space-y-2">
        <label htmlFor={`case-response-${question.id}`} className="text-base font-semibold">
          Your Response
        </label>
        <Textarea
          id={`case-response-${question.id}`}
          value={entry.response}
          onChange={(e) =>
            progress.saveResponse(question.id, e.target.value, contentHash, checklistLength)
          }
          placeholder="Write your analysis before revealing the sample reasoning."
          className="min-h-40 text-base leading-relaxed md:text-base"
        />
      </div>

      {analysis ? (
        <div className="space-y-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              progress.setRevealed(question.id, !entry.revealed, contentHash, checklistLength)
            }
            aria-expanded={entry.revealed}
            aria-controls={`case-analysis-${question.id}`}
          >
            {entry.revealed ? "Hide Analysis" : "Reveal Analysis"}
          </Button>
          <div id={`case-analysis-${question.id}`} hidden={!entry.revealed} className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Sample Reasoning</h3>
              <CaseMarkdown text={analysis.reasoning} />
            </div>
            {analysis.keyPoints.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-base font-semibold">Key Points</h3>
                <ul className="list-disc space-y-2 pl-5">
                  {analysis.keyPoints.map((point, i) => (
                    <li key={i}>
                      <CaseMarkdown text={point} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.conceptApplications.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Concepts From Your Sources</h3>
                {analysis.conceptApplications.map((app, i) => (
                  <div key={i} className="space-y-2">
                    <p className="font-medium">{app.concept}</p>
                    <CaseMarkdown text={app.application} />
                    {app.sourceIds.length > 0 && (
                      <SourceRefs
                        ids={app.sourceIds}
                        sources={sources}
                        sourcesLoaded={sourcesLoaded}
                        openSource={openSource}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            {analysis.assumptions.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-base font-semibold">Assumptions</h3>
                <ul className="list-disc space-y-2 pl-5">
                  {analysis.assumptions.map((item, i) => (
                    <li key={i}>
                      <CaseMarkdown text={item} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.tradeoffs.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-base font-semibold">Tradeoffs</h3>
                <ul className="list-disc space-y-2 pl-5">
                  {analysis.tradeoffs.map((item, i) => (
                    <li key={i}>
                      <CaseMarkdown text={item} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.alternativePerspectives.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Alternative Perspectives</h3>
                {analysis.alternativePerspectives.map((alt, i) => (
                  <div key={i} className="space-y-2">
                    <p className="font-medium">{alt.viewpoint}</p>
                    <CaseMarkdown text={alt.reasoning} />
                    {alt.sourceIds.length > 0 && (
                      <SourceRefs
                        ids={alt.sourceIds}
                        sources={sources}
                        sourcesLoaded={sourcesLoaded}
                        openSource={openSource}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            {analysis.sourceIds.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Supporting Sources</h3>
                <SourceRefs
                  ids={analysis.sourceIds}
                  sources={sources}
                  sourcesLoaded={sourcesLoaded}
                  openSource={openSource}
                />
              </div>
            )}
            {analysis.checklist.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="text-base font-semibold">Self-Assessment Checklist</legend>
                {analysis.checklist.map((item, i) => (
                  <label
                    key={i}
                    className="flex cursor-pointer items-start gap-3 py-1 text-base leading-relaxed"
                  >
                    <input
                      type="checkbox"
                      checked={entry.checklist[i] === true}
                      onChange={(e) =>
                        progress.setChecklistItem(
                          question.id,
                          i,
                          e.target.checked,
                          contentHash,
                          checklistLength,
                        )
                      }
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer"
                    />
                    <span className="min-w-0 flex-1">{item}</span>
                  </label>
                ))}
              </fieldset>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-tertiary">
          No sample analysis was included for this question.
        </p>
      )}
    </section>
  );
}

function SourceRefs({
  ids,
  sources,
  sourcesLoaded,
  openSource,
}: {
  ids: string[];
  sources: Source[];
  sourcesLoaded: boolean;
  openSource: (id: string) => void;
}) {
  if (ids.length === 0) return null;
  return (
    <ul className="space-y-1">
      {ids.map((id) => {
        const source = sources.find((candidate) => candidate.id === id);
        return (
          <li key={id} className="text-sm">
            {source ? (
              <Button
                variant="link"
                className="h-auto max-w-full whitespace-normal p-0 text-left"
                onClick={() => openSource(id)}
              >
                {source.title}
              </Button>
            ) : (
              <span className="text-text-tertiary">
                {sourcesLoaded ? "Source unavailable" : "Source reference unavailable until loaded"}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CaseMarkdown({ text }: { text: string }) {
  return (
    <MarkdownRenderer className="space-y-3 text-base leading-relaxed break-words [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-1">
      {text}
    </MarkdownRenderer>
  );
}
