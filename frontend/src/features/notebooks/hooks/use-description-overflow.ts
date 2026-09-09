import { useCallback, useEffect, useRef, useState } from "react";

export function useDescriptionOverflow(description: string) {
  const captionRef = useRef<HTMLParagraphElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const [prevDescription, setPrevDescription] = useState(description);

  if (prevDescription !== description) {
    setPrevDescription(description);
    setIsExpanded(false);
  }

  const measureOverflow = useCallback(() => {
    const caption = captionRef.current;
    if (!caption) return;
    setIsOverflowing(caption.scrollHeight > caption.clientHeight + 1);
  }, []);

  useEffect(() => {
    const caption = captionRef.current;
    if (!caption || isExpanded) return;
    measureOverflow();
    const observer = new ResizeObserver(measureOverflow);
    observer.observe(caption);
    return () => observer.disconnect();
  }, [description, isExpanded, measureOverflow]);

  return { captionRef, isExpanded, isOverflowing, setIsExpanded };
}
