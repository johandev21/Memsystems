import type { StudyMaterialKind } from '../../content/shapes';

const groundingKindByInstance = new WeakMap<object, StudyMaterialKind>();

export function setGroundingKind<T extends object>(
  grounding: T,
  kind: StudyMaterialKind,
): T {
  groundingKindByInstance.set(grounding, kind);
  return grounding;
}

export function getGroundingKind(
  grounding: object,
): StudyMaterialKind | undefined {
  return groundingKindByInstance.get(grounding);
}
