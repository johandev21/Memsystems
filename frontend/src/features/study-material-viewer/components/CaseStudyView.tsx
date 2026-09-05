import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { sourcesQueryOptions, type Source } from "@/features/sources";
import { CaseStudyContent, type CaseStudyAnalysisType, type CaseStudyQuestionType } from "../shapes/case-study";
import { hashCaseStudyQuestion, useCaseStudyProgress } from "./useCaseStudyProgress";

interface CaseStudyViewProps {
  materialId: string;
  content: unknown;
  notebookId: string;
  onOpenSource?: () => void;
}

export function CaseStudyView({ materialId, content, notebookId, onOpenSource }: CaseStudyViewProps) {
  const parsed = CaseStudyContent.safeParse(content);
  if (!parsed.success) {
    return (
      <p role="alert" className="p-6 text-text-secondary">
        This case study could not be read. Try reopening it or generating a new case.
      </p>
    );
  }
  return <CaseStudyReader study={parsed.data} materialId={materialId} notebookId={notebookId} onOpenSource={onOpenSource} />;
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
  const sources = useQuery({ ...sourcesQueryOptions(notebookId), enabled: referencedIds.length > 0 });

  const openSource = (sourceId: string) => {
    onOpenSource?.();
    window.dispatchEvent(new CustomEvent("open-source-viewer", { detail: { sourceId } }));
  };

  return (
    <article className="mx-auto w-full max-w-3xl space-y-6 p-3 text-text-primary sm:p-6">
      <header className="space-y-3">
        <p className="text-xs font-medium text-text-tertiary">Case Study</p>
        <h1 className="text-2xl font-semibold break-words">
          {study.title.replace(/-case-study$/, "").replaceAll("-", " ")}
        </h1>
        {study.sourceIds.length === 0 ? (
          <p className="text-sm text-text-tertiary">Generated without notebook sources.</p>
        ) : (
          <p className="text-sm text-text-tertiary">
            Generated from {study.sourceIds.length} notebook source{study.sourceIds.length === 1 ? "" : "s"}.
            The scenario below is fictional; sources only support the analysis.
          </p>
        )}
        {study.conceptsFocus && (
          <p className="text-sm text-text-secondary">
            <span className="font-medium">Focus:</span> {study.conceptsFocus}
          </p>
        )}
        <div className="space-y-2">
          <h2 className="font-semibold">Learning objectives</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {study.learningObjectives.map((objective, i) => (
              <li key={i}>
                <CaseMarkdown text={objective} />
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-text-tertiary">Progress is saved on this device.</p>
      </header>

      <section aria-label="Case scenario" className="space-y-3 rounded-2xl border border-dashed border-surface-border-strong bg-surface-2 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{study.scenario.title}</h2>
          <span className="rounded-full border border-surface-border-strong bg-surface-1 px-2.5 py-0.5 text-xs font-medium text-text-secondary">
            Fictional scenario
          </span>
        </div>
        <p className="text-sm text-text-secondary">{study.scenario.setting}</p>
        <CaseMarkdown text={study.scenario.narrative} />
      </section>

      {study.facts.length > 0 && (
        <section aria-label="Relevant facts" className="space-y-2 rounded-2xl border border-surface-border bg-surface-2 p-4 sm:p-6">
          <h2 className="font-semibold">Relevant facts</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {study.facts.map((fact, i) => (
              <li key={i}>
                <CaseMarkdown text={fact} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {progress.storageError && (
        <div role="alert" className="rounded-2xl border border-warning bg-warning/10 p-3 text-sm">
          {progress.storageError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {confirmReset ? (
          <span className="flex items-center gap-2 text-sm">
            Clear written responses on this device?
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                progress.resetAll();
                setConfirmReset(false);
              }}
            >
              Confirm reset
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
          </span>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
            Reset responses
          </Button>
        )}
      </div>

      {referencedIds.length > 0 && sources.isPending && <p role="status">Loading source references…</p>}
      {referencedIds.length > 0 && sources.isError && (
        <div role="alert" className="text-sm text-text-secondary">
          Source references could not be loaded.{" "}
          <Button variant="outline" size="sm" onClick={() => void sources.refetch()}>
            Retry references
          </Button>
        </div>
      )}

      {study.questions.map((question, index) => (
        <QuestionCard
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
    </article>
  );
}

function QuestionCard({
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
    <section aria-label={`Question ${index + 1}`} className="space-y-4 rounded-2xl border border-surface-border bg-surface-2 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Question {index + 1}</h2>
      <CaseMarkdown text={question.prompt} />
      {question.hint && <p className="text-sm text-text-tertiary">Hint: {question.hint}</p>}

      <div className="space-y-2">
        <label htmlFor={`case-response-${question.id}`} className="text-sm font-semibold">
          Your response
        </label>
        <Textarea
          id={`case-response-${question.id}`}
          value={entry.response}
          onChange={(e) => progress.saveResponse(question.id, e.target.value, contentHash, checklistLength)}
          placeholder="Write your analysis before revealing the sample reasoning."
          className="min-h-[120px] text-sm"
        />
      </div>

      {analysis ? (
        <div className="space-y-3">
          {!entry.revealed ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => progress.setRevealed(question.id, true, contentHash, checklistLength)}
              aria-expanded={false}
              aria-controls={`case-analysis-${question.id}`}
            >
              Reveal analysis
            </Button>
          ) : (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => progress.setRevealed(question.id, false, contentHash, checklistLength)}
                aria-expanded={true}
                aria-controls={`case-analysis-${question.id}`}
              >
                Hide analysis
              </Button>
              <div id={`case-analysis-${question.id}`} className="space-y-4 rounded-xl border border-primary/30 bg-surface-1 p-3 sm:p-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Sample reasoning</h3>
                  <CaseMarkdown text={analysis.reasoning} />
                </div>
                {analysis.keyPoints.length > 0 && (
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">Key points</h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
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
                    <h3 className="text-sm font-semibold">Concepts from your sources</h3>
                    {analysis.conceptApplications.map((app, i) => (
                      <div key={i} className="rounded-xl border border-surface-border p-3 text-sm">
                        <p className="font-medium">{app.concept}</p>
                        <CaseMarkdown text={app.application} />
                        {app.sourceIds.length > 0 && (
                          <SourceRefs ids={app.sourceIds} sources={sources} sourcesLoaded={sourcesLoaded} openSource={openSource} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {analysis.assumptions.length > 0 && (
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">Assumptions</h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
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
                    <h3 className="text-sm font-semibold">Tradeoffs</h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
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
                    <h3 className="text-sm font-semibold">Alternative perspectives</h3>
                    {analysis.alternativePerspectives.map((alt, i) => (
                      <div key={i} className="rounded-xl border border-surface-border p-3 text-sm">
                        <p className="font-medium">{alt.viewpoint}</p>
                        <CaseMarkdown text={alt.reasoning} />
                        {alt.sourceIds.length > 0 && (
                          <SourceRefs ids={alt.sourceIds} sources={sources} sourcesLoaded={sourcesLoaded} openSource={openSource} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {analysis.sourceIds.length > 0 && (
                  <div className="space-y-2 border-t border-surface-border pt-3">
                    <h3 className="text-sm font-semibold">Supporting sources</h3>
                    <p className="text-xs text-text-tertiary">Fictional details above are invented; sources only support the analysis.</p>
                    <SourceRefs ids={analysis.sourceIds} sources={sources} sourcesLoaded={sourcesLoaded} openSource={openSource} />
                  </div>
                )}
                {analysis.checklist.length > 0 && (
                  <fieldset className="space-y-2 border-t border-surface-border pt-3">
                    <legend className="text-sm font-semibold">Self-assessment checklist</legend>
                    {analysis.checklist.map((item, i) => (
                      <label key={i} className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={entry.checklist[i] === true}
                          onChange={(e) => progress.setChecklistItem(question.id, i, e.target.checked, contentHash, checklistLength)}
                          className="mt-1 h-4 w-4 shrink-0 cursor-pointer"
                        />
                        <span className="min-w-0 flex-1">{item}</span>
                      </label>
                    ))}
                  </fieldset>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-text-tertiary">No sample analysis was included for this question.</p>
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
              <Button variant="link" className="h-auto max-w-full whitespace-normal p-0 text-left" onClick={() => openSource(id)}>
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
    <MarkdownRenderer className="space-y-2 text-sm leading-relaxed break-words [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto [&_a]:underline">
      {text}
    </MarkdownRenderer>
  );
}
