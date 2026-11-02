import { BadRequestError } from '../../../common/errors/domain-error';

export type BranchMessage = {
  id: string;
  parentId: string | null;
  preferredChildId?: string | null;
  preferredChildInitialized?: boolean;
  createdAt?: Date;
};

export function buildMessagePath<
  T extends { id: string; parentId: string | null },
>(rows: T[], targetId: string | null): T[] {
  if (!targetId) return [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const path: T[] = [];
  const visited = new Set<string>();
  let current = byId.get(targetId);
  if (!current) throw new BadRequestError('Unknown chat branch message');
  while (current) {
    if (visited.has(current.id)) {
      throw new BadRequestError('Invalid cyclic chat branch');
    }
    visited.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
    if (path[0].parentId && !current) {
      throw new BadRequestError('Invalid chat branch parent');
    }
  }
  return path;
}

export function buildRememberedMessagePath<T extends BranchMessage>(
  rows: T[],
  startId: string,
): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const path: T[] = [];
  const visited = new Set<string>();
  let current = byId.get(startId);
  if (!current) throw new BadRequestError('Unknown chat branch message');

  while (current) {
    if (visited.has(current.id)) {
      throw new BadRequestError('Invalid cyclic chat branch');
    }
    visited.add(current.id);
    path.push(current);
    const children = rows
      .filter((row) => row.parentId === current!.id)
      .sort(
        (a, b) =>
          (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0) ||
          a.id.localeCompare(b.id),
      );
    const preferredChild = children.find(
      (row) => row.id === current!.preferredChildId,
    );
    current =
      preferredChild ??
      (current.preferredChildId || !current.preferredChildInitialized
        ? children[0]
        : undefined);
  }
  return path;
}
