import type { ReactNode } from "react";

// Extracted from folder-prototype/Memsystems-export.html, then rounded: 16px outer corners, 14/10px tab corners, 8-10px inner corners. Colors use the application theme.
const FOLDER_BACK_PATH =
  "M0 150.5L0 19.5Q0 5.5 13.94 5.5L77.77 5.5Q87.73 5.5 94.92 12.42L105.14 22.25Q112.33 29.167 122.29 29.167L222.07 29.167Q238 29.167 238 45.167L238 150.5Z";
const FOLDER_FRONT_PATH =
  "M7.95 0Q0 0 0 8L0 15.5A16 16 0 0 0 15.9 31.5L221.6 31.5A16 16 0 0 0 237.5 15.5L237.5 -28.5Q237.5 -44.5 221.6 -44.5L59.33 -44.5Q49.39 -44.5 49.39 -34.5L49.39 -8Q49.39 0 41.44 0Z";
const FOLDER_FRONT_PATH_EMPTY =
  "M8 0Q0 0 0 8L0 109A16 16 0 0 0 16 125L223 125A16 16 0 0 0 239 109L239 8Q239 0 231 0Z";

export function EmptyFolderArtwork({ title, titleFontSize, titleSlot }: { title: string; titleFontSize: number; titleSlot?: ReactNode }) {
  return (
    <span className="box-border w-[239px] h-[168.5px] relative block shrink-0 [z-index:5]">
      <span className="box-border w-[239px] h-[168.5px] absolute left-0 top-0 [z-index:0]">
        <svg
          viewBox="0 5.5 238 159.5"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-[239px] h-[159.5px] absolute left-0 top-0 overflow-visible [z-index:0]"
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
          className="box-border w-[239px] h-[125px] absolute left-0 top-[43.5px] overflow-visible [z-index:1]"
        >
          <path
            d={FOLDER_FRONT_PATH_EMPTY}
            fill="var(--notebook-folder-front)"
          ></path>
        </svg>
      </span>
      <span className="prototype-artwork__folder-title text-[29.4px]/[42px] box-border absolute left-[61px] top-[107px] text-[color:var(--notebook-folder-title)] font-[Poppins,system-ui,sans-serif] font-medium text-left [white-space:nowrap] [z-index:1]" style={{ fontSize: titleFontSize }}>
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
  covers: (string | null)[];
}) {
  return (
    <span className="box-border w-[239px] h-[168.5px] relative block shrink-0 [z-index:4]">
      <span className="box-border w-[239px] h-[168.5px] absolute left-0 top-0 [z-index:0]">
        <svg
          viewBox="0 5.5 238 159.5"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-[239px] h-[159.5px] absolute left-0 top-0 overflow-visible [z-index:0]"
        >
          <path
            d={FOLDER_BACK_PATH}
            fill="var(--notebook-folder-back)"
          ></path>
        </svg>
        <span
          className="box-border w-[183px] h-[107px] absolute left-[28px] top-[50px] rounded-[8px] overflow-hidden [z-index:2]"
          style={{
            backgroundImage: covers[0] ? `url(${covers[0]})` : undefined,
            backgroundColor: covers[0] ? undefined : "var(--notebook-empty-cover)",
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
          }}
        ></span>
        <svg
          viewBox="0 -44.5 237.5 76"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-[239px] h-[76px] absolute left-0 top-[92.5px] overflow-visible [z-index:3]"
        >
          <path
            d={FOLDER_FRONT_PATH}
            fill="var(--notebook-folder-front)"
          ></path>
        </svg>
      </span>
      <span className="prototype-artwork__folder-title text-[29.4px]/[42px] box-border absolute left-[61px] top-[107px] text-[color:var(--notebook-folder-title)] font-[Poppins,system-ui,sans-serif] font-medium text-left [white-space:nowrap] [z-index:1]" style={{ fontSize: titleFontSize }}>
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
  covers: (string | null)[];
}) {
  return (
    <span className="box-border w-[239px] h-[168.5px] relative block shrink-0 [z-index:6]">
      <span className="box-border w-[239px] h-[168.5px] absolute left-0 top-0 [z-index:0]">
        <svg
          viewBox="0 5.5 238 159.5"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-[239px] h-[159.5px] absolute left-0 top-0 overflow-visible [z-index:0]"
        >
          <path
            d={FOLDER_BACK_PATH}
            fill="var(--notebook-folder-back)"
          ></path>
        </svg>
        <span
          className="box-border w-[90px] h-[107px] absolute left-[28px] top-[50px] rounded-[8px] overflow-hidden [z-index:2]"
          style={{
            backgroundImage: covers[0] ? `url(${covers[0]})` : undefined,
            backgroundColor: covers[0] ? undefined : "var(--notebook-empty-cover)",
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
          }}
        ></span>
        <span
          className="box-border w-[90px] h-[107px] absolute left-[121px] top-[50px] rounded-[8px] overflow-hidden [z-index:3]"
          style={{
            backgroundImage: covers[1] ? `url(${covers[1]})` : undefined,
            backgroundColor: covers[1] ? undefined : "var(--notebook-empty-cover)",
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
          }}
        ></span>
        <svg
          viewBox="0 -44.5 237.5 76"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-[239px] h-[76px] absolute left-0 top-[92.5px] overflow-visible [z-index:4]"
        >
          <path
            d={FOLDER_FRONT_PATH}
            fill="var(--notebook-folder-front)"
          ></path>
        </svg>
      </span>
      <span className="prototype-artwork__folder-title text-[29.4px]/[42px] box-border absolute left-[61px] top-[107px] text-[color:var(--notebook-folder-title)] font-[Poppins,system-ui,sans-serif] font-medium text-left [white-space:nowrap] [z-index:1]" style={{ fontSize: titleFontSize }}>
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
  covers: (string | null)[];
  extraCount: number;
}) {
  return (
    <span className="box-border w-[239px] h-[168.5px] relative block shrink-0 [z-index:3]">
      <span className="box-border w-[239px] h-[168.5px] absolute left-0 top-0 [z-index:0]">
        <svg
          viewBox="0 5.5 238 159.5"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-[239px] h-[159.5px] absolute left-0 top-0 overflow-visible [z-index:0]"
        >
          <path
            d={FOLDER_BACK_PATH}
            fill="var(--notebook-folder-back)"
          ></path>
        </svg>
        <span
          className="box-border w-[67px] h-[107px] absolute left-[28px] top-[50px] rounded-[8px] overflow-hidden [z-index:2]"
          style={{
            backgroundImage: covers[0] ? `url(${covers[0]})` : undefined,
            backgroundColor: covers[0] ? undefined : "var(--notebook-empty-cover)",
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
          }}
        ></span>
        <span
          className="box-border w-[67px] h-[107px] absolute left-[99px] top-[50px] rounded-[8px] overflow-hidden [z-index:3]"
          style={{
            backgroundImage: covers[1] ? `url(${covers[1]})` : undefined,
            backgroundColor: covers[1] ? undefined : "var(--notebook-empty-cover)",
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
          }}
        ></span>
        <span className="box-border w-[41px] h-[82px] absolute left-[170px] top-[50px] bg-[var(--notebook-overflow-surface)] rounded-[8px] overflow-hidden [z-index:4]">
          <span className="text-[16.8px]/[24px] box-border absolute left-[19.5px] top-[12px] text-[color:var(--notebook-overflow-foreground)] font-[Poppins,system-ui,sans-serif] font-medium text-left [white-space:nowrap] [z-index:0]">
            {extraCount}
          </span>
          <span className="text-[11.2px]/[16px] box-border absolute left-[11.5px] top-[16px] text-[color:var(--notebook-overflow-foreground)] font-[Poppins,system-ui,sans-serif] font-medium text-left [white-space:nowrap] [z-index:1]">
            +
          </span>
        </span>
        <svg
          viewBox="0 -44.5 237.5 76"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="box-border w-[239px] h-[76px] absolute left-0 top-[92.5px] overflow-visible [z-index:5]"
        >
          <path
            d={FOLDER_FRONT_PATH}
            fill="var(--notebook-folder-front)"
          ></path>
        </svg>
      </span>
      <span className="prototype-artwork__folder-title text-[29.4px]/[42px] box-border absolute left-[61px] top-[107px] text-[color:var(--notebook-folder-title)] font-[Poppins,system-ui,sans-serif] font-medium text-left [white-space:nowrap] [z-index:1]" style={{ fontSize: titleFontSize }}>
        {titleSlot ?? title}
      </span>
    </span>
  );
}

export function CoveredNotebookArtwork({ title, coverUrl, titleSlot }: { title: string; coverUrl: string; titleSlot?: ReactNode }) {
  return (
    <span
      className="box-border w-[239px] h-[137px] relative block shrink-0 prototype-notebook-surface rounded-[14px] overflow-hidden [z-index:0]"
      style={{
        backgroundImage: `url(${coverUrl})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
    >
      <span className="box-border w-fit max-w-[calc(100%_-_12px)] h-fit absolute left-[6px] top-[88px] flex flex-row gap-[6px] p-[0px_8px] justify-start items-center bg-[var(--notebook-label-surface)] rounded-[8px] [z-index:0]">
        <span className="box-border w-[24px] shrink-0 h-[24px] overflow-hidden relative">
          <svg
            viewBox="0 0 4 1"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
            className="box-border w-[4px] h-[2px] absolute left-[2px] top-[6px] overflow-visible [z-index:0]"
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
            className="box-border w-[4px] h-[2px] absolute left-[2px] top-[10px] overflow-visible [z-index:1]"
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
            className="box-border w-[4px] h-[2px] absolute left-[2px] top-[14px] overflow-visible [z-index:2]"
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
            className="box-border w-[4px] h-[2px] absolute left-[2px] top-[18px] overflow-visible [z-index:3]"
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
            className="box-border w-[16px] h-[20px] absolute left-[4px] top-[2px] overflow-visible [z-index:4]"
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
            className="box-border w-[2px] h-[20px] absolute left-[16px] top-[2px] overflow-visible [z-index:5]"
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
        <span className="min-w-0 text-[16px]/[42px] box-border text-[color:var(--notebook-label-foreground)] font-[Poppins,system-ui,sans-serif] font-medium text-left [white-space:nowrap]">
          {titleSlot ?? title}
        </span>
      </span>
    </span>
  );
}

export function EmptyNotebookArtwork({ title, titleSlot }: { title: string; titleSlot?: ReactNode }) {
  return (
    <span className="box-border w-[239px] h-[137px] relative block shrink-0 bg-[var(--notebook-empty-cover)] prototype-notebook-surface rounded-[14px] overflow-hidden [z-index:1]">
      <span className="box-border w-fit max-w-[calc(100%_-_12px)] h-fit absolute left-[6px] top-[88px] flex flex-row gap-[6px] p-[0px_8px] justify-start items-center bg-[var(--notebook-label-surface)] rounded-[8px] [z-index:0]">
        <span className="box-border w-[24px] shrink-0 h-[24px] overflow-hidden relative">
          <svg
            viewBox="0 0 4 1"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
            className="box-border w-[4px] h-[2px] absolute left-[2px] top-[6px] overflow-visible [z-index:0]"
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
            className="box-border w-[4px] h-[2px] absolute left-[2px] top-[10px] overflow-visible [z-index:1]"
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
            className="box-border w-[4px] h-[2px] absolute left-[2px] top-[14px] overflow-visible [z-index:2]"
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
            className="box-border w-[4px] h-[2px] absolute left-[2px] top-[18px] overflow-visible [z-index:3]"
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
            className="box-border w-[16px] h-[20px] absolute left-[4px] top-[2px] overflow-visible [z-index:4]"
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
            className="box-border w-[2px] h-[20px] absolute left-[16px] top-[2px] overflow-visible [z-index:5]"
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
        <span className="min-w-0 text-[16px]/[42px] box-border text-[color:var(--notebook-label-foreground)] font-[Poppins,system-ui,sans-serif] font-medium text-left [white-space:nowrap]">
          {titleSlot ?? title}
        </span>
      </span>
    </span>
  );
}
