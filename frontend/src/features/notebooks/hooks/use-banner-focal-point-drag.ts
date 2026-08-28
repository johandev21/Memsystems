import { useRef, useState } from "react";

interface DragStart {
  mouseX: number;
  mouseY: number;
  initialX: number;
  initialY: number;
}

export function useBannerFocalPointDrag({
  enabled,
  focalPoint,
  onChange,
}: {
  enabled: boolean;
  focalPoint: { x: number; y: number };
  onChange: (point: { x: number; y: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<DragStart | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (event: React.MouseEvent) => {
    if (!enabled || (event.target as HTMLElement).closest("button, input")) return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      initialX: focalPoint.x,
      initialY: focalPoint.y,
    };
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    onChange({
      x: clamp(
        dragStartRef.current.initialX - (event.clientX - dragStartRef.current.mouseX) / rect.width,
      ),
      y: clamp(
        dragStartRef.current.initialY - (event.clientY - dragStartRef.current.mouseY) / rect.height,
      ),
    });
  };

  const stopDragging = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  return { containerRef, isDragging, handleMouseDown, handleMouseMove, stopDragging };
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}
