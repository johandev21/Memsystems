import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Source } from "@/features/sources";
import type {
  CaseStudyAnalysisType,
  CaseStudyQuestionType,
} from "../../shapes/case-study";
import type { useCaseStudyProgress } from "../../hooks/use-case-study-progress";
import { CaseMarkdown } from "./case-markdown";
import { SourceRefs } from "./case-study-source-refs";

export interface CaseQuestionProps {
  question: CaseStudyQuestionType;
  index: number;
  analysis?: CaseStudyAnalysisType;
  contentHash: string;
  sources: Source[];
  sourcesLoaded: boolean;
  openSource: (id: string) => void;
  progress: ReturnType<typeof useCaseStudyProgress>;
}

export function CaseQuestion({
  question,
  index,
  analysis,
  contentHash,
  sources,
  sourcesLoaded,
  openSource,
  progress,
}: CaseQuestionProps) {
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
                  {analysis.keyPoints.map((point) => (
                    <li key={point}>
                      <CaseMarkdown text={point} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.conceptApplications.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Concepts From Your Sources</h3>
                {analysis.conceptApplications.map((app) => (
                  <div key={app.concept} className="space-y-2">
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
                  {analysis.assumptions.map((item) => (
                    <li key={item}>
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
                  {analysis.tradeoffs.map((item) => (
                    <li key={item}>
                      <CaseMarkdown text={item} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.alternativePerspectives.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Alternative Perspectives</h3>
                {analysis.alternativePerspectives.map((alt) => (
                  <div key={alt.viewpoint} className="space-y-2">
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
                    key={item}
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
