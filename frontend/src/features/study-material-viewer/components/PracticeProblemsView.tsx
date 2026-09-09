import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { sourcesQueryOptions, type Source } from "@/features/sources";
import {
  PracticeProblemsContent,
  type PracticeProblemsContentType,
  type PracticeProblemsDifficulty,
} from "../shapes/practice-problems";
import { usePracticeProblemsSession } from "../hooks/use-practice-problems-session";
import { useModelPersistence } from "@/features/notebooks";
import { PracticeStepperHeader } from "./practice/practice-header";
import { usePracticeChatPrompts } from "./practice/practice-chat";
import { ProblemStatementSection } from "./practice/problem-statement-section";
import { AttemptSection } from "./practice/practice-attempt-section";
import { HintsSection, SolutionSection } from "./practice/practice-solution-section";
import { PracticeExitDialog } from "./practice/practice-exit-dialog";

export interface PracticeProblemsViewProps {
  materialId: string;
  content: unknown;
  notebookId: string;
  onOpenSource?: () => void;
  onClose?: () => void;
  registerBeforeClose?: (fn: () => boolean) => void;
}

export function PracticeProblemsView({
  materialId,
  content,
  notebookId,
  onOpenSource,
  onClose,
  registerBeforeClose,
}: PracticeProblemsViewProps) {
  const parsed = PracticeProblemsContent.safeParse(content);
  if (!parsed.success) {
    return (
      <p role="alert" className="p-6 text-sm text-text-secondary">
        These practice problems could not be read. Try reopening them or generating a new set.
      </p>
    );
  }

  return (
    <PracticeProblemsReader
      set={parsed.data}
      materialId={materialId}
      notebookId={notebookId}
      onOpenSource={onOpenSource}
      onClose={onClose}
      registerBeforeClose={registerBeforeClose}
    />
  );
}

const DIFFICULTY_LABELS: Record<PracticeProblemsDifficulty, { label: string; className: string }> =
  {
    easy: {
      label: "Warmup",
      className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    },
    medium: { label: "Standard", className: "bg-primary/15 text-primary border-primary/30" },
    hard: { label: "Challenge", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  };

function PracticeProblemsReader({
  set,
  materialId,
  notebookId,
  onOpenSource,
  onClose,
  registerBeforeClose,
}: {
  set: PracticeProblemsContentType;
  materialId: string;
  notebookId: string;
  onOpenSource?: () => void;
  onClose?: () => void;
  registerBeforeClose?: (fn: () => boolean) => void;
}) {
  const { model: selectedModel } = useModelPersistence(notebookId);
  const {
    activeIdx,
    totalProblems,
    currentProblem,
    currentState,
    difficulty,
    hasUnsavedWork,
    confirmExitOpen,
    setAnswer,
    revealNextHint,
    revealSolution,
    hideSolution,
    giveUpAndReveal,
    evaluateAnswer,
    nextProblem,
    prevProblem,
    goToProblem,
    requestClose,
    confirmExit,
    cancelExit,
  } = usePracticeProblemsSession(materialId, set, onClose, selectedModel);

  useEffect(() => {
    if (registerBeforeClose) {
      registerBeforeClose(() => {
        if (hasUnsavedWork) {
          requestClose();
          return false;
        }
        return true;
      });
      return () => {
        registerBeforeClose(() => true);
      };
    }
  }, [registerBeforeClose, hasUnsavedWork, requestClose]);

  const hasReferences = set.problems.some(
    (p) => p.sourceIds.length > 0 || p.steps.some((s) => s.sourceIds.length > 0),
  );
  const sources = useQuery({ ...sourcesQueryOptions(notebookId), enabled: hasReferences });

  const sourceMap = useMemo(() => {
    const map = new Map<string, Source>();
    if (sources.data) {
      for (const s of sources.data) map.set(s.id, s);
    }
    return map;
  }, [sources.data]);

  const handleOpenSource = useCallback(
    (sourceId: string) => {
      window.dispatchEvent(new CustomEvent("open-source-viewer", { detail: { sourceId } }));
      onOpenSource?.();
    },
    [onOpenSource],
  );

  const { handleDiscussInChat, handleAskSocraticHint, handleExplainStepInChat } =
    usePracticeChatPrompts(currentProblem);

  const difficultyConfig = DIFFICULTY_LABELS[difficulty] ?? DIFFICULTY_LABELS.medium;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface-1 text-text-primary">
      <PracticeStepperHeader
        difficultyClassName={difficultyConfig.className}
        difficultyLabel={difficultyConfig.label}
        activeIdx={activeIdx}
        totalProblems={totalProblems}
        problems={set.problems}
        onGoToProblem={goToProblem}
        onPrev={prevProblem}
        onNext={nextProblem}
      />

      <main className="flex-1 px-4 py-8 sm:px-6 md:py-10">
        <div className="mx-auto max-w-4xl space-y-10 md:space-y-12">
          <ProblemStatementSection
            activeIdx={activeIdx}
            prompt={currentProblem.prompt}
            givens={currentProblem.givens}
            constraints={currentProblem.constraints}
            checklist={currentProblem.checklist}
            acceptableAlternatives={currentProblem.acceptableAlternatives}
            sourceIds={currentProblem.sourceIds}
            setSourceIds={set.sourceIds}
            sourceMap={sourceMap}
            onOpenSource={handleOpenSource}
            onDiscussInChat={handleDiscussInChat}
          />

          <AttemptSection
            studentAnswer={currentState.studentAnswer}
            isEvaluating={currentState.isEvaluating}
            evaluation={currentState.evaluation}
            evaluationError={currentState.evaluationError}
            difficulty={difficulty}
            isSolutionRevealed={currentState.isSolutionRevealed}
            onAnswerChange={(v) => setAnswer(currentProblem.id, v)}
            onEvaluate={() => evaluateAnswer(currentProblem.id)}
            onGiveUp={() => giveUpAndReveal(currentProblem.id)}
          />

          {difficulty !== "hard" && currentProblem.hints.length > 0 && (
            <HintsSection
              hints={difficulty === "easy" ? currentProblem.hints : currentProblem.hints}
              hintsRevealed={
                difficulty === "easy" ? currentProblem.hints.length : currentState.hintsRevealed
              }
              showCount={difficulty === "medium"}
              onRevealNext={() => revealNextHint(currentProblem.id)}
              onAskSocratic={handleAskSocraticHint}
            />
          )}

          <SolutionSection
            difficulty={difficulty}
            isRevealed={currentState.isSolutionRevealed}
            answer={currentProblem.answer}
            steps={currentProblem.steps}
            sourceMap={sourceMap}
            onToggleReveal={() =>
              currentState.isSolutionRevealed
                ? hideSolution(currentProblem.id)
                : revealSolution(currentProblem.id)
            }
            onGiveUp={() => giveUpAndReveal(currentProblem.id)}
            onExplainStep={handleExplainStepInChat}
            onOpenSource={handleOpenSource}
          />
        </div>
      </main>

      <PracticeExitDialog
        isOpen={confirmExitOpen}
        onCancel={cancelExit}
        onConfirm={confirmExit}
      />
    </div>
  );
}
