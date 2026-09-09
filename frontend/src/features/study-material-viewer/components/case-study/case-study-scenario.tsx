import { CaseMarkdown } from "./case-markdown";
import type { CaseStudyContentType } from "../../shapes/case-study";

export interface CaseStudyScenarioProps {
  study: CaseStudyContentType;
}

export function CaseStudyScenario({ study }: CaseStudyScenarioProps) {
  return (
    <>
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
          {study.learningObjectives.map((objective) => (
            <li key={objective}>
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
            {study.facts.map((fact) => (
              <li key={fact}>
                <CaseMarkdown text={fact} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
