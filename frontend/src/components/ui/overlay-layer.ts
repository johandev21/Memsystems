import { createContext, useContext } from "react";

export const MODAL_POPOVER_LAYER = "z-modal-popover";

export const OverlayLayerContext = createContext<string | undefined>(undefined);

export function useOverlayLayer(): string | undefined {
  return useContext(OverlayLayerContext);
}
