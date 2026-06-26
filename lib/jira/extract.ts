import type { CosmicRun } from "@/lib/six-d/cosmic";
import type { ArtifactElement } from "@/lib/six-d/types";

import type { JiraEmitPayload, JiraEpic, JiraStory } from "./types";
import { JIRA_EMIT_SCHEMA } from "./types";

function distributePhase(run: CosmicRun) {
  return run.manifest.artifacts.find((a) => a.phase === "distribute");
}

function defineAcs(run: CosmicRun): ArtifactElement[] {
  const define = run.manifest.artifacts.find((a) => a.phase === "define");
  return (define?.elements ?? []).filter((e) => e.kind === "acceptance_criterion");
}

function acceptanceForStory(story: ArtifactElement, defineAcsList: ArtifactElement[]): string[] {
  const acRefs = (story.fields?.acRefs as string[] | undefined) ?? [];
  return defineAcsList.filter((ac) => acRefs.includes(ac.id)).map((ac) => ac.body);
}

/**
 * Lift epic + stories + ACs from a sealed CosmicRun. Pure and deterministic.
 * Returns null when the Distribute phase produced no epic or no stories.
 */
export function extractJiraPayload(
  run: CosmicRun,
  initiativeId: string,
  specReceipt: string,
): JiraEmitPayload | null {
  const distribute = distributePhase(run);
  if (!distribute) return null;

  const epicEl = distribute.elements.find((e) => e.kind === "epic");
  const storyEls = distribute.elements.filter((e) => e.kind === "story");
  if (!epicEl || storyEls.length === 0) return null;

  const acs = defineAcs(run);

  const epic: JiraEpic = {
    epicId: epicEl.id,
    title: epicEl.title ?? epicEl.id,
    description: epicEl.body,
  };

  const stories: JiraStory[] = storyEls.map((story) => {
    const labels = (story.fields?.labels as string[] | undefined) ?? [];
    const dependsOn = (story.fields?.dependsOn as string[] | undefined) ?? [];
    const estimate = story.fields?.estimate;
    return {
      storyId: story.id,
      title: story.title ?? story.id,
      description: story.body,
      acceptanceCriteria: acceptanceForStory(story, acs),
      estimate: typeof estimate === "string" ? estimate : undefined,
      labels,
      dependsOn,
    };
  });

  return {
    schema: JIRA_EMIT_SCHEMA,
    initiativeId,
    specReceipt,
    cosmicRunHash: run.runHash,
    epic,
    stories,
  };
}