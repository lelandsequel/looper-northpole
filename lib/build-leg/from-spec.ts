// STAGE 3 ← STAGE 2 — source the build work-order from the semantic 6D spec.
//
// The build leg validates a work-order. Until now that work-order was hand-
// authored; this closes the seam so it can be SOURCED from a live OMNIS semantic
// run: the story + its acceptance criteria come from the reconciled spec, traced
// to the spec's own LUNA receipt. One engine, all three stages — Agility decides,
// OMNIS specs (from reconciled meaning), the build leg builds + gates THAT spec.
//
// HONEST FRONTIER (stated, not faked): the *executable probes* — the runnable
// checks the validator executes against a build — stay hand-authored. Turning a
// prose acceptance criterion into a runnable assertion is the SAME frontier the
// semantic model's own frontier report names (deterministic prose→executable is
// unsolved). So we source the story + criteria FROM the spec (real provenance),
// and keep the probes explicit. No clock, no randomness. 🐦‍⬛ + 🔑

import type { CosmicRun } from "../six-d/cosmic";

/** A build story lifted from a semantic 6D run, traced to its spec receipt. */
export interface SpecSourcedStory {
  /** The Distribute story id from the spec (e.g. "distribute.story.1"). */
  storyId: string;
  title: string;
  /** The Agility initiative the spec was generated for (provenance). */
  sourceInitiative: string;
  /** The acceptance criteria the spec produced for this story, verbatim. */
  acceptanceText: string[];
  /** The LUNA chain head sealing the spec the story came from. */
  specReceipt: string;
  /** Did the spec's semantic layer flag a frontier (LLM-required) gap on this run? */
  frontierItems: number;
}

/**
 * Lift a story + its acceptance criteria out of a semantic 6D run. Returns null
 * if the run produced no Distribute story at that index. Deterministic — the
 * same run yields the same sourced story.
 */
export function storyFromSpec(
  run: CosmicRun,
  specReceipt: string,
  sourceInitiative: string,
  storyIndex = 0,
): SpecSourcedStory | null {
  const distribute = run.manifest.artifacts.find((a) => a.phase === "distribute");
  const stories = (distribute?.elements ?? []).filter((e) => e.kind === "story");
  const story = stories[storyIndex];
  if (!story) return null;

  // ACs are sourced via the story's acRefs → the Define acceptance criteria.
  const define = run.manifest.artifacts.find((a) => a.phase === "define");
  const defineAcs = (define?.elements ?? []).filter((e) => e.kind === "acceptance_criterion");
  const acRefs = (story.fields?.acRefs as string[] | undefined) ?? [];
  const acceptanceText = defineAcs
    .filter((ac) => acRefs.includes(ac.id))
    .map((ac) => ac.body);

  // The frontier the spec honestly reported (carried on the semantic manifest).
  const semantic = (run.manifest as { semantic?: { frontier?: { llmRequiredFor?: unknown[] } } }).semantic;
  const frontierItems = semantic?.frontier?.llmRequiredFor?.length ?? 0;

  return {
    storyId: story.id,
    title: story.title ?? story.id,
    sourceInitiative,
    acceptanceText,
    specReceipt,
    frontierItems,
  };
}
