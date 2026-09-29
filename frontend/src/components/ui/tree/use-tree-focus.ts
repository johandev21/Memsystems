import { useCallback, useEffect, useRef, useState } from "react";

export function useTreeFocusRegistry(onFocusItem?: (id: string) => void) {
  const [treeHasFocus, setTreeHasFocus] = useState(true);
  const treeSurfaceElement = useRef<HTMLDivElement | null>(null);
  const nodeElements = useRef(new Map<string, HTMLElement>());

  const registerTreeSurface = useCallback((element: HTMLDivElement | null) => {
    treeSurfaceElement.current = element;
  }, []);

  const registerNode = useCallback((id: string, element: HTMLElement | null) => {
    if (element) nodeElements.current.set(id, element);
    else nodeElements.current.delete(id);
  }, []);

  const focus = useCallback(
    (id: string) => {
      onFocusItem?.(id);
      nodeElements.current.get(id)?.focus();
      requestAnimationFrame(() => nodeElements.current.get(id)?.focus());
    },
    [onFocusItem],
  );

  useEffect(() => {
    const isTreeRow = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(treeSurfaceElement.current?.contains(target) && target.closest('[role="treeitem"]'));
    const handleFocusIn = (event: FocusEvent) => setTreeHasFocus(isTreeRow(event.target));
    const handlePointerDown = (event: PointerEvent) => setTreeHasFocus(isTreeRow(event.target));
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return { treeHasFocus, treeSurfaceElement, registerTreeSurface, registerNode, focus };
}
