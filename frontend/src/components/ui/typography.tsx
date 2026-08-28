import * as React from "react";
import { cn } from "@/shared/utils/cn";

export const TypographyH1 = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h1
    ref={ref}
    className={cn(
      "scroll-m-20 text-center text-4xl font-semibold tracking-[-0.035em] text-balance",
      className,
    )}
    {...props}
  />
));
TypographyH1.displayName = "TypographyH1";

export const TypographyH2 = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      "scroll-m-20 border-b pb-3 text-3xl font-semibold tracking-[-0.03em] first:mt-0",
      className,
    )}
    {...props}
  />
));
TypographyH2.displayName = "TypographyH2";

export const TypographyH3 = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("scroll-m-20 text-2xl font-semibold tracking-[-0.025em]", className)}
    {...props}
  />
));
TypographyH3.displayName = "TypographyH3";

export const TypographyH4 = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h4
    ref={ref}
    className={cn("scroll-m-20 text-xl font-semibold tracking-[-0.02em]", className)}
    {...props}
  />
));
TypographyH4.displayName = "TypographyH4";

export const TypographyP = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("leading-7 [&:not(:first-child)]:mt-6", className)} {...props} />
));
TypographyP.displayName = "TypographyP";

export const TypographyBlockquote = React.forwardRef<
  HTMLQuoteElement,
  React.BlockquoteHTMLAttributes<HTMLQuoteElement>
>(({ className, ...props }, ref) => (
  <blockquote ref={ref} className={cn("mt-6 border-l-2 pl-6 italic", className)} {...props} />
));
TypographyBlockquote.displayName = "TypographyBlockquote";

export const TypographyTable = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="my-6 w-full overflow-y-auto">
    <table ref={ref} className={cn("w-full", className)} {...props} />
  </div>
));
TypographyTable.displayName = "TypographyTable";

export const TypographyTableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn("m-0 border-t p-0 even:bg-muted", className)} {...props} />
));
TypographyTableRow.displayName = "TypographyTableRow";

export const TypographyTableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right",
      className,
    )}
    {...props}
  />
));
TypographyTableHead.displayName = "TypographyTableHead";

export const TypographyTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right",
      className,
    )}
    {...props}
  />
));
TypographyTableCell.displayName = "TypographyTableCell";

export const TypographyList = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul ref={ref} className={cn("my-6 ml-6 list-disc [&>li]:mt-2", className)} {...props} />
));
TypographyList.displayName = "TypographyList";

export const TypographyInlineCode = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <code
    ref={ref}
    className={cn(
      "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
      className,
    )}
    {...props}
  />
));
TypographyInlineCode.displayName = "TypographyInlineCode";

export const TypographyLead = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-xl text-muted-foreground", className)} {...props} />
));
TypographyLead.displayName = "TypographyLead";

export const TypographyLarge = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
));
TypographyLarge.displayName = "TypographyLarge";

export const TypographySmall = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <small ref={ref} className={cn("text-sm font-medium leading-none", className)} {...props} />
  ),
);
TypographySmall.displayName = "TypographySmall";

export const TypographyMuted = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
TypographyMuted.displayName = "TypographyMuted";
