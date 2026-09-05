import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { type Source } from "@/features/sources";
import { StudyGuideContent, type StudyGuideContentType } from "../shapes/study-guide";

import { useStudyGuideReader } from "./use-study-guide-reader";

interface StudyGuideViewProps {
  content: unknown;
  notebookId: string;
  onOpenSource?: () => void;
}

export function StudyGuideView({ content, notebookId, onOpenSource }: StudyGuideViewProps) {
  const parsed = StudyGuideContent.safeParse(content);
  if (!parsed.success) {
    return (
      <p role="alert" className="p-6 text-text-secondary">
        This study guide could not be read. Try reopening it or generating a new guide.
      </p>
    );
  }
  return (
    <StudyGuideReader guide={parsed.data} notebookId={notebookId} onOpenSource={onOpenSource} />
  );
}

function StudyGuideReader({
  guide,
  notebookId,
  onOpenSource,
}: Omit<StudyGuideViewProps, "content"> & { guide: StudyGuideContentType }) {
  const { hasReferences, sources, sectionId, openSource, navigateToSection } = useStudyGuideReader(
    guide,
    notebookId,
    onOpenSource,
  );

  return (
    <article className="mx-auto w-full max-w-3xl space-y-6 p-3 text-text-primary sm:p-6">
      <header className="space-y-3">
        <p className="text-xs font-medium text-text-tertiary">
          {guide.format === "revision" ? "Revision sheet" : "Detailed guide"}
        </p>
        <h1 className="text-2xl font-semibold break-words">
          {guide.title.replace(/-study-guide$/, "").replaceAll("-", " ")}
        </h1>
        {guide.sourceIds.length === 0 && !hasReferences && (
          <p className="text-sm text-text-tertiary">Generated without notebook sources.</p>
        )}
        <GuideMarkdown text={guide.overview} />
        <GuideList title="Learning objectives" items={guide.learningObjectives} />
      </header>
      <nav
        aria-label="Study guide contents"
        className="rounded-2xl border border-surface-border bg-surface-2 p-4"
      >
        <h2 className="mb-2 font-semibold">Contents</h2>
        <ol className="list-inside list-decimal space-y-2">
          {guide.sections.map((section) => (
            <li key={section.id}>
              <a
                className="text-sm underline underline-offset-4 focus-visible:outline-2"
                href={`#${sectionId(section.id)}`}
                onClick={(event) => navigateToSection(event, section.id)}
              >
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {hasReferences && sources.isPending && <p role="status">Loading source references…</p>}
      {hasReferences && sources.isError && (
        <div role="alert" className="text-sm text-text-secondary">
          Source references could not be loaded.{" "}
          <Button variant="outline" size="sm" onClick={() => void sources.refetch()}>
            Retry references
          </Button>
        </div>
      )}
      {guide.sections.map((section) => (
        <GuideSection
          key={section.id}
          section={section}
          anchorId={sectionId(section.id)}
          sources={sources.data ?? []}
          sourcesLoaded={sources.isSuccess}
          openSource={openSource}
        />
      ))}
    </article>
  );
}

function GuideSection({
  section,
  anchorId,
  sources,
  sourcesLoaded,
  openSource,
}: {
  section: StudyGuideContentType["sections"][number];
  anchorId: string;
  sources: Source[];
  sourcesLoaded: boolean;
  openSource: (id: string) => void;
}) {
  return (
    <section
      id={anchorId}
      tabIndex={-1}
      className="scroll-mt-4 space-y-4 rounded-2xl border border-surface-border bg-surface-2 p-4 sm:p-6"
      aria-labelledby={`${anchorId}-title`}
    >
      <h2 id={`${anchorId}-title`} className="text-xl font-semibold break-words">
        {section.title}
      </h2>
      <GuideMarkdown text={section.explanation} />
      <GuideList title="Key concepts" items={section.keyConcepts} />
      <GuideList title="Generated examples" items={section.examples} />
      <GuideList title="Common misconceptions" items={section.misconceptions} />
      <GuideList title="Takeaways" items={section.takeaways} />
      {section.sourceIds.length > 0 && (
        <div className="space-y-2 border-t border-surface-border pt-3">
          <h3 className="text-sm font-semibold">Supporting sources</h3>
          <ul className="space-y-2">
            {section.sourceIds.map((id) => {
              const source = sources.find((candidate) => candidate.id === id);
              return (
                <li key={id}>
                  {source ? (
                    <Button
                      variant="link"
                      className="h-auto max-w-full whitespace-normal p-0 text-left"
                      onClick={() => openSource(id)}
                    >
                      {source.title}
                    </Button>
                  ) : (
                    <span className="text-sm text-text-tertiary">
                      {sourcesLoaded
                        ? "Source unavailable"
                        : "Source reference unavailable until loaded"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function GuideList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">{title}</h3>
      <ul className="list-disc space-y-2 pl-5">
        {items.map((item, index) => (
          <li key={index}>
            <GuideMarkdown text={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function GuideMarkdown({ text }: { text: string }) {
  return (
    <MarkdownRenderer className="space-y-3 text-sm leading-relaxed break-words [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto [&_a]:underline">
      {text}
    </MarkdownRenderer>
  );
}
