import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { sourcesQueryOptions } from "@/features/sources";
import {
  CaseStudyContent,
  type CaseStudyAnalysisType,
  type CaseStudyContentType,
} from "../shapes/case-study";
import { hashCaseStudyQuestion, useCaseStudyProgress } from "../hooks/use-case-study-progress";
import { CaseStudyScenario } from "./case-study/case-study-scenario";
import { CaseQuestion } from "./case-study/case-study-question";

export interface CaseStudyViewProps {
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
  study: CaseStudyContentType;
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
      <CaseStudyScenario study={study} />

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
