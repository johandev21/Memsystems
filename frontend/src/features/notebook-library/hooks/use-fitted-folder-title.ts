import { useLayoutEffect, useState } from "react";

const MAX_SIZE = 29.4;
const MIN_SIZE = 16;
const AVAILABLE_WIDTH = 170;

export function useFittedFolderTitle(title: string) {
  const [fontSize, setFontSize] = useState(MAX_SIZE);

  useLayoutEffect(() => {
    let cancelled = false;
    const measure = () => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      const widthAt = (size: number) => {
        context.font = `500 ${size}px Poppins, system-ui, sans-serif`;
        return context.measureText(title).width;
      };
      if (widthAt(MAX_SIZE) <= AVAILABLE_WIDTH) {
        if (!cancelled) setFontSize(MAX_SIZE);
        return;
      }
      let low = MIN_SIZE;
      let high = MAX_SIZE;
      for (let index = 0; index < 12; index += 1) {
        const middle = (low + high) / 2;
        if (widthAt(middle) <= AVAILABLE_WIDTH) low = middle;
        else high = middle;
      }
      if (!cancelled) setFontSize(Math.max(MIN_SIZE, Number(low.toFixed(2))));
    };
    measure();
    void document.fonts?.ready.then(measure);
    return () => {
      cancelled = true;
    };
  }, [title]);

  return fontSize;
}
