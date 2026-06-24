import { STALE_DATA_STORY } from "@/lib/build-leg";
import type { BuildWorkOrder } from "@/lib/build-leg";

/**
 * Work-order for the build leg. HL-002 pricing probes today; COSMIC-sourced AC
 * text is wired via storyFromSpec — executable probes remain hand-authored until
 * prose→probe frontier is solved (see lib/build-leg/from-spec.ts).
 */
export function workOrderForInitiative(initiativeId: string): BuildWorkOrder {
  return {
    ...STALE_DATA_STORY,
    sourceInitiative: initiativeId,
    storyId: `build.${initiativeId}`,
  };
}