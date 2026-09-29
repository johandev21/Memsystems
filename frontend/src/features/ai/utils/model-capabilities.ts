import type { ModelOption } from "../types/model.types";

/**
 * A Model may start a Study Material Generation or evaluate a practice answer
 * only when the Gateway reported `structured-output` for it in a successfully
 * synced catalog. Missing capability data counts as incapable.
 */
export function isStudyMaterialCapable(
  model: ModelOption | null | undefined,
  capabilitiesVerified: boolean,
): boolean {
  return capabilitiesVerified === true && model?.capabilities?.structuredOutput === true;
}
