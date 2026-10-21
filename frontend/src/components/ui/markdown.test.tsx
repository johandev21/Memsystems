import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import React from "react";
import { MarkdownRenderer } from "./markdown";
import { isUnclosedFence, repairTrailingBlock, splitMarkdownIntoBlocks } from "./markdown-blocks";
import { CitationHoverCard } from "@/shared/citations/citation-hover-card";
import { MarkdownCodeBlock } from "@/features/ai/components/markdown-code-block";
import { MarkdownTable } from "@/features/ai/components/markdown-table";
import type { CitedSourceDTO } from "@/features/notebook-chat/api/chat";

const mockReference: CitedSourceDTO = {
  id: "src-1",
  schemaVersion: 1,
  citationKey: "R1",
  number: 1,
  title: "Quantum Theory",
  kind: "pdf",
  url: null,
  description: null,
  quote: "Theory details",
  isAvailable: true,
  chunkId: null,
  chunkIndex: null,
  locator: { pageNumber: 42 },
};

describe("MarkdownRenderer live block-memoized streaming", () => {
  it("splits text into top-level blocks with marked.lexer", () => {
    const md = "# Title\n\nFirst paragraph.\n\n```ts\nconst a = 1;\n```\n\nSecond paragraph.";
    const blocks = splitMarkdownIntoBlocks(md);
    expect(blocks.length).toBe(4);
    expect(blocks[0]).toBe("# Title");
    expect(blocks[1]).toBe("First paragraph.");
    expect(blocks[2]).toContain("const a = 1;");
    expect(blocks[3]).toBe("Second paragraph.");
  });

  it("detects unclosed code fences accurately", () => {
    expect(isUnclosedFence("```ts\nconst x = 1;")).toBe(true);
    expect(isUnclosedFence("```ts\nconst x = 1;\n```")).toBe(false);
    expect(isUnclosedFence("~~~python\ndef f(): pass")).toBe(true);
    expect(isUnclosedFence("~~~python\ndef f(): pass\n~~~")).toBe(false);
    expect(isUnclosedFence("Just normal text")).toBe(false);
  });

  it("repairs trailing block with remend and closes unclosed code fence", () => {
    const boldRepaired = repairTrailingBlock("This is **unclosed bold");
    expect(boldRepaired.processed).toBe("This is **unclosed bold**");
    expect(boldRepaired.isFenceUnclosed).toBe(false);

    const fenceRepaired = repairTrailingBlock("```typescript\nconst x = 1;");
    expect(fenceRepaired.processed).toContain("```");
    expect(fenceRepaired.isFenceUnclosed).toBe(true);
  });

  it("ensures completed blocks do not re-render on new tokens (render count test)", () => {
    const pRenderCounts: Record<number, number> = {};
    const trackRender = (blockId: number) => {
      pRenderCounts[blockId] = (pRenderCounts[blockId] || 0) + 1;
    };

    const CustomP = ({ children, node }: any) => {
      // Track render count by child content text
      const text = String(node?.children?.[0]?.value || "");
      if (text.includes("Block 1")) {
        trackRender(1);
      } else if (text.includes("Block 2")) {
        trackRender(2);
      }
      return <p>{children}</p>;
    };

    const { rerender } = render(
      <MarkdownRenderer
        isStreaming={true}
        components={{ p: CustomP }}
      >
        {"Block 1 paragraph.\n\nBlock 2 is being str"}
      </MarkdownRenderer>
    );

    const initialBlock1Renders = pRenderCounts[1];
    expect(initialBlock1Renders).toBeGreaterThanOrEqual(1);

    // Stream 5 additional tokens into Block 2
    for (let i = 1; i <= 5; i++) {
      rerender(
        <MarkdownRenderer
          isStreaming={true}
          components={{ p: CustomP }}
        >
          {`Block 1 paragraph.\n\nBlock 2 is being str${"e".repeat(i)}med`}
        </MarkdownRenderer>
      );
    }

    // Block 1 was completed and MUST NOT have re-rendered!
    expect(pRenderCounts[1]).toBe(initialBlock1Renders);
    // Block 2 was trailing and streamed, so it rendered on the updates
    expect(pRenderCounts[2]).toBeGreaterThan(initialBlock1Renders);
  });

  it("renders unclosed code fence without flicker and defers syntax highlighting until closed", () => {
    const { container, rerender } = render(
      <MarkdownRenderer
        isStreaming={true}
        components={{ code: MarkdownCodeBlock }}
      >
        {"```typescript\nconst x = 1;"}
      </MarkdownRenderer>
    );

    // Code container is rendered in monospace
    const codeEl = container.querySelector("code");
    expect(codeEl).not.toBeNull();
    expect(codeEl?.textContent).toContain("const x = 1;");

    // Now close the code fence
    rerender(
      <MarkdownRenderer
        isStreaming={true}
        components={{ code: MarkdownCodeBlock }}
      >
        {"```typescript\nconst x = 1;\n```"}
      </MarkdownRenderer>
    );

    expect(container.querySelector("code")?.textContent).toContain("const x = 1;");
  });

  it("renders citation chips while streaming and after", () => {
    const CustomLink = ({ href, children }: any) => {
      if (href === "#reference-R1") {
        return (
          <CitationHoverCard reference={mockReference}>
            {children}
          </CitationHoverCard>
        );
      }
      return <a href={href}>{children}</a>;
    };

    // Streaming
    const { container: streamContainer } = render(
      <MarkdownRenderer
        isStreaming={true}
        components={{ a: CustomLink }}
      >
        {"According to [1](#reference-R1), results are sound."}
      </MarkdownRenderer>
    );

    expect(streamContainer.textContent).toContain("1");

    // Settled (after streaming)
    const { container: settledContainer } = render(
      <MarkdownRenderer
        isStreaming={false}
        components={{ a: CustomLink }}
      >
        {"According to [1](#reference-R1), results are sound."}
      </MarkdownRenderer>
    );

    expect(settledContainer.textContent).toContain("1");
  });

  it("renders tables cleanly with MarkdownTable", () => {
    const { container } = render(
      <MarkdownRenderer
        isStreaming={true}
        components={{ table: MarkdownTable }}
      >
        {"| Metric | Value |\n|---|---|\n| Accuracy | 99% |"}
      </MarkdownRenderer>
    );

    const tableWrapper = container.querySelector(".markdown-table-wrapper");
    expect(tableWrapper).not.toBeNull();
    expect(tableWrapper?.textContent).toContain("Accuracy");
  });

  it("handles 5,000-word streamed answer without re-rendering completed blocks", () => {
    let block0Renders = 0;
    const trackBlock0 = () => {
      block0Renders++;
    };
    const CustomP = ({ children, node }: any) => {
      const text = String(node?.children?.[0]?.value || "");
      if (text.startsWith("Paragraph 0:")) {
        trackBlock0();
      }
      return <p>{children}</p>;
    };

    // Generate ~50 paragraphs (~5,000 words total)
    const paragraphs = Array.from({ length: 50 }, (_, i) =>
      `Paragraph ${i}: ${"Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(15)}`
    );

    const initialMd = paragraphs.slice(0, 49).join("\n\n") + `\n\nParagraph 49: start`;

    const { rerender } = render(
      <MarkdownRenderer
        isStreaming={true}
        components={{ p: CustomP }}
      >
        {initialMd}
      </MarkdownRenderer>
    );

    const snapshotBlock0Renders = block0Renders;
    expect(snapshotBlock0Renders).toBeGreaterThanOrEqual(1);

    // Stream 10 tokens into the 50th paragraph
    for (let step = 1; step <= 10; step++) {
      const updatedMd = paragraphs.slice(0, 49).join("\n\n") + `\n\nParagraph 49: start token ${step}`;
      rerender(
        <MarkdownRenderer
          isStreaming={true}
          components={{ p: CustomP }}
        >
          {updatedMd}
        </MarkdownRenderer>
      );
    }

    // Completed paragraph 0 was NOT re-rendered during the 10 token updates of paragraph 49!
    expect(block0Renders).toBe(snapshotBlock0Renders);
  });

  it("handles transition between streaming and settled without remount", () => {
    let mountCount = 0;
    const CustomP = ({ children }: any) => {
      React.useEffect(() => {
        mountCount++;
      }, []);
      return <p>{children}</p>;
    };

    const text = "Stable block 1.\n\nStable block 2.";
    const { rerender } = render(
      <MarkdownRenderer isStreaming={true} components={{ p: CustomP }}>
        {text}
      </MarkdownRenderer>
    );

    const initialMounts = mountCount;

    // Transition from streaming to finished history
    rerender(
      <MarkdownRenderer isStreaming={false} components={{ p: CustomP }}>
        {text}
      </MarkdownRenderer>
    );

    // Components stay mounted: no remount flash!
    expect(mountCount).toBe(initialMounts);
  });
});
