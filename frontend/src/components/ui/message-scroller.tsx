import {
  MessageScroller as MessageScrollerPrimitive,
  useMessageScroller,
} from "@shadcn/react/message-scroller";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { ArrowDownIcon } from "lucide-react";

function MessageScrollerProvider(
  props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>,
) {
  return <MessageScrollerPrimitive.Provider {...props} />;
}

function MessageScroller({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
  return (
    <MessageScrollerPrimitive.Root
      data-slot="message-scroller"
      className={cn(
        "group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

function MessageScrollerViewport({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
  return (
    <MessageScrollerPrimitive.Viewport
      data-slot="message-scroller-viewport"
      className={cn(
        "size-full min-h-0 min-w-0 scroll-fade-b scrollbar-thin scrollbar-gutter-stable overflow-y-auto overscroll-contain contain-content outline-none focus:outline-none focus-visible:outline-none data-autoscrolling:scrollbar-thumb-transparent data-autoscrolling:scrollbar-track-transparent",
        className,
      )}
      {...props}
    />
  );
}

function MessageScrollerContent({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
  return (
    <MessageScrollerPrimitive.Content
      data-slot="message-scroller-content"
      className={cn("flex h-max min-h-full flex-col gap-8", className)}
      {...props}
    />
  );
}

function MessageScrollerItem({
  className,
  scrollAnchor = false,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
  return (
    <MessageScrollerPrimitive.Item
      data-slot="message-scroller-item"
      scrollAnchor={scrollAnchor}
      className={cn("min-w-0 shrink-0", className)}
      {...props}
    />
  );
}

export type MessageScrollerButtonProps = React.ComponentProps<
  typeof MessageScrollerPrimitive.Button
> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size"> & {
    onScrollToEnd?: () => void;
  };

function MessageScrollerButton({
  direction = "end",
  className,
  children,
  render,
  variant = "secondary",
  size = "icon-sm",
  onScrollToEnd,
  onClick,
  ...props
}: MessageScrollerButtonProps) {
  const { t } = useTranslation();
  const { scrollToEnd } = useMessageScroller();
  const stopFollowingRef = React.useRef<(() => void) | null>(null);

  React.useEffect(
    () => () => {
      stopFollowingRef.current?.();
    },
    [],
  );

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (e.defaultPrevented) return;

      if (direction === "end") {
        onScrollToEnd?.();

        const viewport = e.currentTarget
          .closest('[data-slot="message-scroller"]')
          ?.querySelector('[data-slot="message-scroller-viewport"]');
        const activeAnchor = viewport?.querySelector('[data-scroll-anchor="true"]');
        if (activeAnchor) {
          activeAnchor.setAttribute("data-scroll-anchor", "false");
        }

        scrollToEnd({ behavior: props.behavior ?? "smooth" });

        if (viewport instanceof HTMLElement) {
          stopFollowingRef.current?.();

          let frame = 0;
          let active = true;
          const content = viewport.querySelector('[data-slot="message-scroller-content"]');
          const followEnd = () => {
            if (!active) return;
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(() => {
              if (active) {
                viewport.scrollTo({
                  top: viewport.scrollHeight,
                  behavior: props.behavior ?? "smooth",
                });
              }
            });
          };
          const stopFollowing = () => {
            if (!active) return;
            active = false;
            window.cancelAnimationFrame(frame);
            resizeObserver.disconnect();
            mutationObserver.disconnect();
            viewport.removeEventListener("wheel", onWheel);
            viewport.removeEventListener("touchstart", onTouchStart);
            viewport.removeEventListener("touchmove", onTouchMove);
            viewport.removeEventListener("keydown", onKeyDown);
            viewport.removeEventListener("pointerdown", onPointerDown);
            viewport.removeEventListener("pointerup", onPointerUp);
            if (stopFollowingRef.current === stopFollowing) {
              stopFollowingRef.current = null;
            }
          };
          const onWheel = (event: WheelEvent) => {
            if (event.deltaY < 0) stopFollowing();
          };
          const onKeyDown = (event: KeyboardEvent) => {
            if (["ArrowUp", "PageUp", "Home"].includes(event.key)) stopFollowing();
          };
          let touchStartY: number | null = null;
          const onTouchStart = (event: TouchEvent) => {
            touchStartY = event.touches[0]?.clientY ?? null;
          };
          const onTouchMove = (event: TouchEvent) => {
            const touchY = event.touches[0]?.clientY;
            if (touchStartY !== null && touchY !== undefined && touchY > touchStartY) {
              stopFollowing();
            }
          };
          let pointerStartTop = viewport.scrollTop;
          const onPointerDown = () => {
            pointerStartTop = viewport.scrollTop;
          };
          const onPointerUp = () => {
            if (viewport.scrollTop < pointerStartTop) stopFollowing();
          };
          const resizeObserver = new ResizeObserver(followEnd);
          const mutationObserver = new MutationObserver(followEnd);

          if (content) {
            resizeObserver.observe(content);
            mutationObserver.observe(content, {
              childList: true,
              characterData: true,
              subtree: true,
            });
          }
          resizeObserver.observe(viewport);
          viewport.addEventListener("wheel", onWheel, { passive: true });
          viewport.addEventListener("touchstart", onTouchStart, { passive: true });
          viewport.addEventListener("touchmove", onTouchMove, { passive: true });
          viewport.addEventListener("keydown", onKeyDown);
          viewport.addEventListener("pointerdown", onPointerDown);
          viewport.addEventListener("pointerup", onPointerUp);
          stopFollowingRef.current = stopFollowing;
          followEnd();
        }
      }
    },
    [direction, onClick, onScrollToEnd, props.behavior, scrollToEnd],
  );

  return (
    <MessageScrollerPrimitive.Button
      data-slot="message-scroller-button"
      data-direction={direction}
      data-variant={variant}
      data-size={size}
      direction={direction}
      className={cn(
        "absolute inset-s-1/2 -translate-x-1/2 border-border bg-background text-foreground transition-[translate,scale,opacity] duration-200 hover:bg-muted hover:text-foreground data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=false]:duration-400 data-[active=false]:ease-[cubic-bezier(0.7,0,0.84,0)] data-[active=true]:translate-y-0 data-[active=true]:scale-100 data-[active=true]:opacity-100 data-[active=true]:ease-[cubic-bezier(0.23,1,0.32,1)] data-[direction=end]:bottom-4 data-[direction=end]:data-[active=false]:translate-y-full data-[direction=start]:top-4 data-[direction=start]:data-[active=false]:-translate-y-full rtl:translate-x-1/2 data-[direction=start]:[&_svg]:rotate-180",
        className,
      )}
      render={render ?? <Button variant={variant} size={size} />}
      onClick={handleClick}
      {...props}
    >
      {children ?? (
        <>
          <ArrowDownIcon />
          <span className="sr-only">
            {direction === "end" ? t("messageScroller.toEnd") : t("messageScroller.toStart")}
          </span>
        </>
      )}
    </MessageScrollerPrimitive.Button>
  );
}

export {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
};
