import { useContext } from "react";
import { PaletteContext } from "../components/palette-context";

export function usePalette() {
  const ctx = useContext(PaletteContext);
  if (!ctx) {
    throw new Error("usePalette must be used within PaletteProvider");
  }
  return ctx;
}

export function usePaletteOptional() {
  return useContext(PaletteContext);
}
