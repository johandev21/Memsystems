import { createContext, useContext } from "react";
import type { ReactElement } from "react";

export interface MessageBranchContextType {
  currentBranch: number;
  totalBranches: number;
  goToPrevious: () => void;
  goToNext: () => void;
  branches: ReactElement[];
  setBranches: (branches: ReactElement[]) => void;
}

export const MessageBranchContext = createContext<MessageBranchContextType | null>(null);

export const useMessageBranch = () => {
  const context = useContext(MessageBranchContext);
  if (!context) {
    throw new Error("MessageBranch components must be used within MessageBranch");
  }
  return context;
};
