import type { ModelOption } from "../types/model.types";

export function isStudyMaterialCapable(
  model: ModelOption | null | undefined,
  capabilitiesVerified: boolean,
): boolean {
  return capabilitiesVerified === true && model?.capabilities?.structuredOutput === true;
}
