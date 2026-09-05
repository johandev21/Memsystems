import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { sourcesQueryOptions, type Source } from "@/features/sources";
import { cn } from "@/shared/utils/cn";
import {
  PracticeProblemsContent,
  type PracticeProblemType,
  type PracticeProblemsContentType,
} from "../shapes/practice-problems";
import {
  hashProblemContent,
  usePracticeProblemsProgress,
  type PracticeRating,
} from "./usePracticeProblemsProgress";

interface PracticeProblemsViewProps {
  materialId: string;
  content: unknown;
  notebookId: string;
  onOpenSource?: () => void;
}

const RATING_OPTIONS: Array<{ id: PracticeRating; label: string }> = [
  { id: "independent", label: "Solved independently" },
  { id: "with_help", label: "Solved with help" },
  { id: "needs_practice", label: "Needs practice" },
];

export function PracticeProblemsView({ materialId, content, notebookId, onOpenSource }: PracticeProblemsViewProps) {
  const parsed = PracticeProblemsContent.safeParse(content);
  if (!parsed.success) {
    return (
      <p role="alert" className="p-6 text-text-secondary">
        These practice problems could not be read. Try reopening them or generating a new set.
      </p>
    );
  }
  return <PracticeProblemsReader set={parsed.data} materialId={materialId} notebookId={notebookId} onOpenSource={onOpenSource} />;
}

function PracticeProblemsReader({
  set,
  materialId,
  notebookId,
  onOpenSource,
}: {
  set: PracticeProblemsContentType;
  materialId: string;
  notebookId: string;
  onOpenSource?: () => void;
}) {
  const progress = usePracticeProblemsProgress(materialId);
  const [retryMode, setRetryMode] = useState(false);
  const [retryIds, setRetryIds] = useState<string[] | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const hasReferences = set.problems.some((p) => p.sourceIds.length > 0 || p.steps.some((s) => s.sourceIds.length > 0));
  const sources = useQuery({ ...sourcesQueryOptions(notebookId), enabled: hasReferences });

  const hashes = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of set.problems) {
      map[p.id] = hashProblemContent({ prompt: p.prompt, answer: p.answer, steps: p.steps, hints: p.hints });
    }
    return map;
  }, [set.problems]);

  const summary = useMemo(() => {
    let independent = 0;
    let withHelp = 0;
    let needsPractice = 0;
    for (const p of set.problems) {
      const attempt = progress.attempts[p.id];
      if (!attempt || attempt.contentHash !== hashes[p.id]) continue;
      if (attempt.rating === "independent") independent += 1;
      else if (attempt.rating === "with_help") withHelp += 1;
      else if (attempt.rating === "needs_practice") needsPractice += 1;
    }
    return { independent, withHelp, needsPractice, total: set.problems.length };
  }, [progress.attempts, set.problems, hashes]);

  const visibleProblems = retryMode
    ? set.problems.filter((p) => (retryIds ?? []).includes(p.id))
    : set.problems;

  const openSource = (sourceId: string) => {
    onOpenSource?.();
    window.dispatchEvent(new CustomEvent("open-source-viewer", { detail: { sourceId } }));
  };

  const handleRetryAll = () => {
    const ids: string[] = [];
    for (const p of set.problems) {
      const attempt = progress.attempts[p.id];
      if (attempt?.contentHash === hashes[p.id] && attempt.rating === "needs_practice") {
        ids.push(p.id);
      }
    }
    for (const id of ids) {
      progress.startRetry(id, hashes[id]);
    }
    setRetryIds(ids);
    setRetryMode(true);
  };

  return (
    <article className="mx-auto w-full max-w-3xl space-y-6 p-3 text-text-primary sm:p-6">
      <header className="space-y-3">
        <p className="text-xs font-medium text-text-tertiary">Practice Problems</p>
        <h1 className="text-2xl font-semibold break-words">
          {set.title.replace(/-practice-problems$/, "").replaceAll("-", " ")}
        </h1>
        {set.sourceIds.length === 0 ? (
          <p className="text-sm text-text-tertiary">Generated without notebook sources.</p>
        ) : (
          <p className="text-sm text-text-tertiary">
            Generated from {set.sourceIds.length} notebook source{set.sourceIds.length === 1 ? "" : "s"}. Exercises are
            generated; sources only support solution facts.
          </p>
        )}
        {set.overview && <ProblemMarkdown text={set.overview} />}
        <p className="text-xs text-text-tertiary">Progress is saved on this device.</p>
      </header>

      {progress.storageError && (
        <div role="alert" className="rounded-2xl border border-warning bg-warning/10 p-3 text-sm">
          {progress.storageError}
        </div>
      )}

      <section aria-label="Practice summary" className="rounded-2xl border border-surface-border bg-surface-2 p-4">
        <h2 className="font-semibold">Your progress</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {summary.independent} solved independently · {summary.withHelp} solved with help · {summary.needsPractice} need
          practice · {summary.total} total
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {retryMode ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRetryMode(false);
                setRetryIds(null);
              }}
            >
              Show all problems
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleRetryAll} disabled={summary.needsPractice === 0}>
              Retry needs practice ({summary.needsPractice})
            </Button>
          )}
          {confirmReset ? (
            <span className="flex items-center gap-2 text-sm">
              Clear all attempts on this device?
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  progress.resetAll();
                  setConfirmReset(false);
                  setRetryMode(false);
                  setRetryIds(null);
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
              Reset progress
            </Button>
          )}
        </div>
        {retryMode && visibleProblems.length === 0 && (
          <p className="mt-3 text-sm text-text-tertiary">No problems are marked for retry. Mark a problem as “Needs practice” to see it here.</p>
        )}
      </section>

      {hasReferences && sources.isPending && <p role="status">Loading source references…</p>}
      {hasReferences && sources.isError && (
        <div role="alert" className="text-sm text-text-secondary">
          Source references could not be loaded.{" "}
          <Button variant="outline" size="sm" onClick={() => void sources.refetch()}>
            Retry references
          </Button>
        </div>
      )}

      {visibleProblems.map((problem, index) => (
        <ProblemCard
          key={problem.id}
          problem={problem}
          index={index}
          contentHash={hashes[problem.id]}
          sources={sources.data ?? []}
          sourcesLoaded={sources.isSuccess}
          openSource={openSource}
          progress={progress}
        />
      ))}
    </article>
  );
}

function ProblemCard({
  problem,
  index,
  contentHash,
  sources,
  sourcesLoaded,
  openSource,
  progress,
}: {
  problem: PracticeProblemType;
  index: number;
  contentHash: string;
  sources: Source[];
  sourcesLoaded: boolean;
  openSource: (id: string) => void;
  progress: ReturnType<typeof usePracticeProblemsProgress>;
}) {
  const stored = progress.getAttempt(problem.id, contentHash);
  const response = stored?.response ?? "";
  const previousResponse = stored?.previousResponse;
  const rating = stored?.rating ?? null;
  const hintsRevealed = stored?.hintsRevealed ?? 0;
  const stepsRevealed = stored?.stepsRevealed ?? 0;
  const solutionRevealed = stored?.solutionRevealed ?? false;

  const hintsRemaining = Math.max(0, problem.hints.length - hintsRevealed);
  const stepsRemaining = Math.max(0, problem.steps.length - stepsRevealed);

  return (
    <section aria-label={`Problem ${index + 1}`} className="space-y-4 rounded-2xl border border-surface-border bg-surface-2 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Problem {index + 1}</h2>
      <ProblemMarkdown text={problem.prompt} />

      {problem.givens.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Given</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {problem.givens.map((given, i) => (
              <li key={i}>
                <ProblemMarkdown text={given} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {problem.constraints.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Constraints</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {problem.constraints.map((constraint, i) => (
              <li key={i}>
                <ProblemMarkdown text={constraint} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor={`response-${problem.id}`} className="text-sm font-semibold">
          Your attempt
        </label>
        <Textarea
          id={`response-${problem.id}`}
          value={response}
          onChange={(e) => progress.saveResponse(problem.id, e.target.value, contentHash)}
          placeholder="Write your solution here. Code is not executed."
          className="min-h-[120px] text-sm"
        />
        {previousResponse && (
          <details className="rounded-xl border border-surface-border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Previous attempt</summary>
            <div className="mt-2 whitespace-pre-wrap break-words text-text-secondary">{previousResponse}</div>
          </details>
        )}
      </div>

      {problem.hints.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Hints</h3>
            <span className="text-xs text-text-tertiary">
              {hintsRevealed} of {problem.hints.length} revealed{hintsRemaining > 0 ? ` · ${hintsRemaining} remaining` : ""}
            </span>
          </div>
          {problem.hints.slice(0, hintsRevealed).map((hint, i) => (
            <div key={i} className="rounded-xl border border-surface-border bg-surface-1 p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-text-tertiary">Hint {i + 1}</p>
              <ProblemMarkdown text={hint} />
            </div>
          ))}
          {hintsRemaining > 0 && (
            <Button variant="outline" size="sm" onClick={() => progress.setHintsRevealed(problem.id, hintsRevealed + 1, contentHash)}>
              Reveal hint {hintsRevealed + 1} of {problem.hints.length}
            </Button>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Worked solution</h3>
          <span className="text-xs text-text-tertiary">
            {stepsRevealed} of {problem.steps.length} steps revealed
          </span>
        </div>
        {problem.steps.slice(0, stepsRevealed).map((step, i) => (
          <div key={step.id} className="rounded-xl border border-surface-border bg-surface-1 p-3">
            <p className="text-sm font-semibold">
              Step {i + 1}: {step.title}
            </p>
            <ProblemMarkdown text={step.explanation} />
            {step.sourceIds.length > 0 && (
              <SourceRefs ids={step.sourceIds} sources={sources} sourcesLoaded={sourcesLoaded} openSource={openSource} />
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {stepsRemaining > 0 && (
            <Button variant="outline" size="sm" onClick={() => progress.setStepsRevealed(problem.id, stepsRevealed + 1, contentHash)}>
              Reveal step {stepsRevealed + 1} of {problem.steps.length}
            </Button>
          )}
          {!solutionRevealed ? (
            <Button variant="secondary" size="sm" onClick={() => progress.setSolutionRevealed(problem.id, true, contentHash)}>
              Reveal full solution
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => progress.setSolutionRevealed(problem.id, false, contentHash)}>
              Hide solution
            </Button>
          )}
        </div>
        {solutionRevealed && (
          <div className="space-y-2 rounded-xl border border-primary/30 bg-surface-1 p-3">
            <p className="text-sm font-semibold">Final answer</p>
            <ProblemMarkdown text={problem.answer} />
          </div>
        )}
      </div>

      {solutionRevealed && problem.checklist.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Self-check</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {problem.checklist.map((item, i) => (
              <li key={i}>
                <ProblemMarkdown text={item} />
              </li>
            ))}
          </ul>
          {problem.acceptableAlternatives.length > 0 && (
            <div className="text-sm">
              <p className="font-medium">Acceptable alternatives</p>
              <ul className="list-disc space-y-1 pl-5">
                {problem.acceptableAlternatives.map((alt, i) => (
                  <li key={i}>
                    <ProblemMarkdown text={alt} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {problem.sourceIds.length > 0 && (
        <div className="space-y-2 border-t border-surface-border pt-3">
          <h3 className="text-sm font-semibold">Supporting sources</h3>
          <p className="text-xs text-text-tertiary">Generated exercise; sources only support solution facts.</p>
          <SourceRefs ids={problem.sourceIds} sources={sources} sourcesLoaded={sourcesLoaded} openSource={openSource} />
        </div>
      )}

      {solutionRevealed && (
        <div className="space-y-2 border-t border-surface-border pt-3">
          <h3 className="text-sm font-semibold">How did it go?</h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Rate your attempt">
            {RATING_OPTIONS.map((option) => (
              <Button
                key={option.id}
                variant={rating === option.id ? "default" : "outline"}
                size="sm"
                className={cn(rating === option.id && "cursor-pointer")}
                onClick={() => progress.setRating(problem.id, rating === option.id ? null : option.id, contentHash)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => progress.startRetry(problem.id, contentHash)}>
            Retry this problem
          </Button>
        </div>
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

function ProblemMarkdown({ text }: { text: string }) {
  return (
    <MarkdownRenderer className="space-y-2 text-sm leading-relaxed break-words [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto [&_a]:underline">
      {text}
    </MarkdownRenderer>
  );
}
