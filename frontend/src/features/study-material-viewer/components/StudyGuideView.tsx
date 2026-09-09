import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { type Source } from "@/features/sources";
import { StudyGuideContent, type StudyGuideContentType } from "../shapes/study-guide";

import { useStudyGuideReader } from "../hooks/use-study-guide-reader";

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
    <article className="mx-auto w-full max-w-3xl space-y-8 py-3 text-text-primary sm:space-y-10 sm:py-6">
      <header className="space-y-4">
        <p className="text-xs font-medium text-text-tertiary">
          {guide.format === "revision" ? "Revision Sheet" : "Detailed Guide"}
        </p>
        <h1 className="text-[1.75rem] leading-tight font-semibold break-words sm:text-3xl">
          {guide.title.replace(/-study-guide$/, "").replaceAll("-", " ")}
        </h1>
        {guide.sourceIds.length === 0 && !hasReferences && (
          <p className="text-sm text-text-tertiary">Generated without notebook sources.</p>
        )}
        <GuideMarkdown text={guide.overview} headingLevel={2} />
      </header>
      <GuideList title="Learning Objectives" items={guide.learningObjectives} headingLevel={2} />
      <nav aria-label="Study guide contents" className="space-y-3">
        <h2 className="text-xl font-semibold">Contents</h2>
        <ol className="list-decimal space-y-2 pl-5 marker:text-text-secondary">
          {guide.sections.map((section) => (
            <li key={section.id}>
              <a
                className="leading-relaxed break-words underline underline-offset-4 focus-visible:outline-2"
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
            Retry References
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
      className="scroll-mt-6 space-y-6 focus-visible:outline-2 focus-visible:outline-offset-4"
      aria-labelledby={`${anchorId}-title`}
    >
      <h2 id={`${anchorId}-title`} className="text-xl font-semibold break-words sm:text-2xl">
        {section.title}
      </h2>
      <GuideMarkdown text={section.explanation} headingLevel={3} />
      <GuideList title="Key Concepts" items={section.keyConcepts} />
      <GuideList title="Generated Examples" items={section.examples} />
      <GuideList title="Common Misconceptions" items={section.misconceptions} />
      <GuideList title="Takeaways" items={section.takeaways} />
      {section.sourceIds.length > 0 && (
        <div className="space-y-2 text-sm text-text-secondary">
          <h3 className="font-semibold">Supporting Sources</h3>
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

function GuideList({
  title,
  items,
  headingLevel = 3,
}: {
  title: string;
  items: string[];
  headingLevel?: 2 | 3;
}) {
  if (!items.length) return null;
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="space-y-2">
      <Heading className={headingLevel === 2 ? "text-xl font-semibold" : "text-base font-semibold"}>
        {title}
      </Heading>
      <ul className="list-disc space-y-2 pl-5">
        {items.map((item) => (
          <li key={item}>
            <GuideMarkdown text={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function GuideMarkdown({ text, headingLevel = 4 }: { text: string; headingLevel?: 2 | 3 | 4 }) {
  const Heading = headingLevel === 2 ? "h2" : headingLevel === 3 ? "h3" : "h4";
  const renderHeading = ({ children }: { children?: React.ReactNode }) => (
    <Heading className="font-semibold">{children}</Heading>
  );
  return (
    <MarkdownRenderer
      components={{
        h1: renderHeading,
        h2: renderHeading,
        h3: renderHeading,
        h4: renderHeading,
        h5: renderHeading,
        h6: renderHeading,
        hr: () => null,
      }}
      className="typeset typeset-chat break-words [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto"
    >
      {text}
    </MarkdownRenderer>
  );
}
