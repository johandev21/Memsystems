import type { ReactNode } from "react";
import type { CoverVariants } from "../model/types";
import { coverSrcSet, primaryCoverUrl } from "../model/artwork-assets";

// Extracted from folder-prototype/Memsystems-export.html, then rounded: 16px outer corners, 14/10px tab corners, 8-10px inner corners. Colors use the application theme.
const FOLDER_BACK_PATH =
  "M0 150.5L0 19.5Q0 5.5 13.94 5.5L77.77 5.5Q87.73 5.5 94.92 12.42L105.14 22.25Q112.33 29.167 122.29 29.167L222.07 29.167Q238 29.167 238 45.167L238 150.5Z";
const FOLDER_FRONT_PATH =
  "M7.95 0Q0 0 0 8L0 15.5A16 16 0 0 0 15.9 31.5L221.6 31.5A16 16 0 0 0 237.5 15.5L237.5 -28.5Q237.5 -44.5 221.6 -44.5L59.33 -44.5Q49.39 -44.5 49.39 -34.5L49.39 -8Q49.39 0 41.44 0Z";
const FOLDER_FRONT_PATH_EMPTY =
  "M8 0Q0 0 0 8L0 109A16 16 0 0 0 16 125L223 125A16 16 0 0 0 239 109L239 8Q239 0 231 0Z";

// Cover photos render as fill layers behind the artwork chrome; real <img>
// elements (unlike CSS backgrounds) can use srcset. The prototype artwork is
// almost entirely above the fold and each file is only a few KB, so these
// load eagerly with high priority to keep LCP fast.
function CoverFill({ url, sizes, srcSet }: { url: string; sizes?: string; srcSet?: string }) {
  return (
    <img
      src={url}
      srcSet={srcSet}
      sizes={sizes}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="absolute inset-0 size-full object-cover"
      fetchPriority="high"
      decoding="async"
    />
  );
}

function NotebookCoverSrcSet({ coverVariants }: { coverVariants?: CoverVariants | null }) {
  return coverSrcSet(coverVariants, ["w480", "w960"]);
}

const FOLDER_COVER_SRCSET = (variants: CoverVariants | null) =>
  coverSrcSet(variants, ["w240", "w480"]);

export function EmptyFolderArtwork({ title, titleFontSize, titleSlot }: { title: string; titleFontSize: number; titleSlot?: ReactNode }) {
  return (
    <span className="box-border w-59.75 h-[168.5px] relative block shrink-0 z-5">
      <span className="box-border w-59.75 h-[168.5px] absolute left-0 top-0 z-0">
        <svg
          viewBox="0 5.5 238 159.5"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-59.75 h-[159.5px] absolute left-0 top-0 overflow-visible z-0"
        >
          <path
            d={FOLDER_BACK_PATH}
            fill="var(--notebook-folder-back)"
          ></path>
        </svg>
        <svg
          viewBox="0 0 239 125"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-59.75 h-31.25 absolute left-0 top-[43.5px] overflow-visible z-1"
        >
          <path
            d={FOLDER_FRONT_PATH_EMPTY}
            fill="var(--notebook-folder-front)"
          ></path>
        </svg>
      </span>
      <span className="library-artwork__folder-title text-(length:--artwork-title-size)/[42px] box-border absolute left-15.25 top-26.75 text-(--notebook-folder-title) font-sans font-medium text-left whitespace-nowrap z-1" style={{ "--artwork-title-size": `${titleFontSize}px` } as React.CSSProperties}>
        {titleSlot ?? title}
      </span>
    </span>
  );
}

export function SingleFolderArtwork({
  title,
  titleFontSize,
  titleSlot,
  covers,
}: {
  title: string;
  titleFontSize: number;
  titleSlot?: ReactNode;
  covers: (CoverVariants | null)[];
}) {
  const cover = primaryCoverUrl(covers[0]);
  return (
    <span className="box-border w-59.75 h-[168.5px] relative block shrink-0 z-4">
      <span className="box-border w-59.75 h-[168.5px] absolute left-0 top-0 z-0">
        <svg
          viewBox="0 5.5 238 159.5"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-59.75 h-[159.5px] absolute left-0 top-0 overflow-visible z-0"
        >
          <path
            d={FOLDER_BACK_PATH}
            fill="var(--notebook-folder-back)"
          ></path>
        </svg>
        <span className="box-border w-45.75 h-26.75 absolute left-7 top-12.5 rounded-md overflow-hidden z-2 bg-(--notebook-empty-cover)">
          {cover ? <CoverFill url={cover} sizes="183px" srcSet={FOLDER_COVER_SRCSET(covers[0])} /> : null}
        </span>
        <svg
          viewBox="0 -44.5 237.5 76"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-59.75 h-19 absolute left-0 top-[92.5px] overflow-visible z-3"
        >
          <path
            d={FOLDER_FRONT_PATH}
            fill="var(--notebook-folder-front)"
          ></path>
        </svg>
      </span>
      <span className="library-artwork__folder-title text-(length:--artwork-title-size)/[42px] box-border absolute left-15.25 top-26.75 text-(--notebook-folder-title) font-sans font-medium text-left whitespace-nowrap z-1" style={{ "--artwork-title-size": `${titleFontSize}px` } as React.CSSProperties}>
        {titleSlot ?? title}
      </span>
    </span>
  );
}

export function DoubleFolderArtwork({
  title,
  titleFontSize,
  titleSlot,
  covers,
}: {
  title: string;
  titleFontSize: number;
  titleSlot?: ReactNode;
  covers: (CoverVariants | null)[];
}) {
  const firstCover = primaryCoverUrl(covers[0]);
  const secondCover = primaryCoverUrl(covers[1]);
  return (
    <span className="box-border w-59.75 h-[168.5px] relative block shrink-0 z-6">
      <span className="box-border w-59.75 h-[168.5px] absolute left-0 top-0 z-0">
        <svg
          viewBox="0 5.5 238 159.5"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-59.75 h-[159.5px] absolute left-0 top-0 overflow-visible z-0"
        >
          <path
            d={FOLDER_BACK_PATH}
            fill="var(--notebook-folder-back)"
          ></path>
        </svg>
        <span className="box-border w-22.5 h-26.75 absolute left-7 top-12.5 rounded-md overflow-hidden z-2 bg-(--notebook-empty-cover)">
          {firstCover ? <CoverFill url={firstCover} sizes="90px" srcSet={FOLDER_COVER_SRCSET(covers[0])} /> : null}
        </span>
        <span className="box-border w-22.5 h-26.75 absolute left-30.25 top-12.5 rounded-md overflow-hidden z-3 bg-(--notebook-empty-cover)">
          {secondCover ? <CoverFill url={secondCover} sizes="90px" srcSet={FOLDER_COVER_SRCSET(covers[1])} /> : null}
        </span>
        <svg
          viewBox="0 -44.5 237.5 76"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-59.75 h-19 absolute left-0 top-[92.5px] overflow-visible z-4"
        >
          <path
            d={FOLDER_FRONT_PATH}
            fill="var(--notebook-folder-front)"
          ></path>
        </svg>
      </span>
      <span className="library-artwork__folder-title text-(length:--artwork-title-size)/[42px] box-border absolute left-15.25 top-26.75 text-(--notebook-folder-title) font-sans font-medium text-left whitespace-nowrap z-1" style={{ "--artwork-title-size": `${titleFontSize}px` } as React.CSSProperties}>
        {titleSlot ?? title}
      </span>
    </span>
  );
}

export function ManyFolderArtwork({
  title,
  titleFontSize,
  titleSlot,
  covers,
  extraCount,
}: {
  title: string;
  titleFontSize: number;
  titleSlot?: ReactNode;
  covers: (CoverVariants | null)[];
  extraCount: number;
}) {
  const firstCover = primaryCoverUrl(covers[0]);
  const secondCover = primaryCoverUrl(covers[1]);
  return (
    <span className="box-border w-59.75 h-[168.5px] relative block shrink-0 z-3">
      <span className="box-border w-59.75 h-[168.5px] absolute left-0 top-0 z-0">
        <svg
          viewBox="0 5.5 238 159.5"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-59.75 h-[159.5px] absolute left-0 top-0 overflow-visible z-0"
        >
          <path
            d={FOLDER_BACK_PATH}
            fill="var(--notebook-folder-back)"
          ></path>
        </svg>
        <span className="box-border w-16.75 h-26.75 absolute left-7 top-12.5 rounded-md overflow-hidden z-2 bg-(--notebook-empty-cover)">
          {firstCover ? <CoverFill url={firstCover} sizes="67px" srcSet={FOLDER_COVER_SRCSET(covers[0])} /> : null}
        </span>
        <span className="box-border w-16.75 h-26.75 absolute left-24.75 top-12.5 rounded-md overflow-hidden z-3 bg-(--notebook-empty-cover)">
          {secondCover ? <CoverFill url={secondCover} sizes="67px" srcSet={FOLDER_COVER_SRCSET(covers[1])} /> : null}
        </span>
        <span className="box-border w-10.25 h-20.5 absolute left-42.5 top-12.5 bg-(--notebook-overflow-surface) rounded-md overflow-hidden z-4">
          <span className="text-base/[24px] box-border absolute left-[19.5px] top-3 text-(--notebook-overflow-foreground) font-sans font-medium text-left whitespace-nowrap z-0">
            {extraCount}
          </span>
          <span className="text-xs/[16px] box-border absolute left-[11.5px] top-4 text-(--notebook-overflow-foreground) font-sans font-medium text-left whitespace-nowrap z-1">
            +
          </span>
        </span>
        <svg
          viewBox="0 -44.5 237.5 76"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-59.75 h-19 absolute left-0 top-[92.5px] overflow-visible z-5"
        >
          <path
            d={FOLDER_FRONT_PATH}
            fill="var(--notebook-folder-front)"
          ></path>
        </svg>
      </span>
      <span className="library-artwork__folder-title text-(length:--artwork-title-size)/[42px] box-border absolute left-15.25 top-26.75 text-(--notebook-folder-title) font-sans font-medium text-left whitespace-nowrap z-1" style={{ "--artwork-title-size": `${titleFontSize}px` } as React.CSSProperties}>
        {titleSlot ?? title}
      </span>
    </span>
  );
}

function NotebookCoverLabel({
  title,
  titleSlot,
}: {
  title: string;
  titleSlot?: ReactNode;
}) {
  return (
    <span className="box-border w-fit max-w-[calc(100%_-_12px)] h-fit absolute left-1.5 top-22 flex flex-row gap-1.5 px-2 py-0 justify-start items-center bg-(--notebook-label-surface) rounded-md z-0">
      <span className="box-border w-6 shrink-0 h-6 overflow-hidden relative">
        <svg
          viewBox="0 0 4 1"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-1 h-0.5 absolute left-0.5 top-1.5 overflow-visible z-0"
        >
          <path
            d="M0 0l4 0"
            fill="none"
            stroke="var(--notebook-label-foreground)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          ></path>
        </svg>
        <svg
          viewBox="0 0 4 1"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-1 h-0.5 absolute left-0.5 top-2.5 overflow-visible z-1"
        >
          <path
            d="M0 0l4 0"
            fill="none"
            stroke="var(--notebook-label-foreground)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          ></path>
        </svg>
        <svg
          viewBox="0 0 4 1"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-1 h-0.5 absolute left-0.5 top-3.5 overflow-visible z-2"
        >
          <path
            d="M0 0l4 0"
            fill="none"
            stroke="var(--notebook-label-foreground)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          ></path>
        </svg>
        <svg
          viewBox="0 0 4 1"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-1 h-0.5 absolute left-0.5 top-4.5 overflow-visible z-3"
        >
          <path
            d="M0 0l4 0"
            fill="none"
            stroke="var(--notebook-label-foreground)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          ></path>
        </svg>
        <svg
          viewBox="0 0 16 20"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-4 h-5 absolute left-1 top-0.5 overflow-visible z-4"
        >
          <path
            d="M2 0l12 0c1.10457 0 2 0.89543 2 2l0 16c0 1.10457-0.89543 2-2 2l-12 0c-1.10457 0-2-0.89543-2-2l0-16c0-1.10457 0.89543-2 2-2z"
            fill="none"
            stroke="var(--notebook-label-foreground)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          ></path>
        </svg>
        <svg
          viewBox="0 0 1 20"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-0.5 h-5 absolute left-4 top-0.5 overflow-visible z-5"
        >
          <path
            d="M0 0l0 20"
            fill="none"
            stroke="var(--notebook-label-foreground)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          ></path>
        </svg>
      </span>
      <span className="min-w-0 text-base/[42px] box-border text-(--notebook-label-foreground) font-sans font-medium text-left whitespace-nowrap">
        {titleSlot ?? title}
      </span>
    </span>
  );
}

export function CoveredNotebookArtwork({
  title,
  coverUrl,
  coverVariants,
  titleSlot,
}: {
  title: string;
  coverUrl: string;
  coverVariants?: CoverVariants | null;
  titleSlot?: ReactNode;
}) {
  return (
    <span
      className="box-border w-59.75 h-34.25 relative block shrink-0 library-notebook-surface rounded-xl overflow-hidden z-0"
    >
      <CoverFill url={coverUrl} sizes="239px" srcSet={NotebookCoverSrcSet({ coverVariants })} />
      <NotebookCoverLabel title={title} titleSlot={titleSlot} />
    </span>
  );
}

export function EmptyNotebookArtwork({ title, titleSlot }: { title: string; titleSlot?: ReactNode }) {
  return (
    <span className="box-border w-59.75 h-34.25 relative block shrink-0 bg-(--notebook-empty-cover) library-notebook-surface rounded-xl overflow-hidden z-1">
      <NotebookCoverLabel title={title} titleSlot={titleSlot} />
    </span>
  );
}
