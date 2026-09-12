import { TreeContext, type TreeController } from "./controller-state";

export function TreeControllerProvider({
  controller,
  children,
}: {
  controller: TreeController;
  children: React.ReactNode;
}) {
  return <TreeContext.Provider value={controller}>{children}</TreeContext.Provider>;
}
