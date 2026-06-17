// 6D Workbench — run orchestrator, receipt, trace validation, lineage.
//
// runSixD is the whole product: normalize the intent → decompose it into
// referencable atoms → run the six pure phase transforms in order (each sees
// everything upstream) → seal the run with a SHA-256 receipt over the
// canonicalized manifest. Re-run the same intent and you get the same bytes
// and the same hash — that is the claim, and verifyRun proves it on demand.

import { sentences, sha256Hex, slugify, stableStringify } from "./helpers";
import { PHASES } from "./phases";
import type {
  ArtifactElement,
  FeatureIntent,
  IntentRef,
  PhaseArtifact,
  RunManifest,
  TraceProblem,
} from "./types";

export const GENERATED_BY = "CADMUS Engine — deterministic · keyless · zero egress";

export type RawIntent = {
  title: string;
  context: string;
  goals: string[];
  constraints: string[];
  sourceMaterial: string[];
};

export function normalizeIntent(raw: RawIntent): FeatureIntent {
  const clean = (xs: string[]): string[] => xs.map((x) => x.trim()).filter(Boolean);
  const title = raw.title.trim();
  return {
    id: slugify(title),
    title,
    context: raw.context.trim(),
    goals: clean(raw.goals),
    constraints: clean(raw.constraints),
    sourceMaterial: clean(raw.sourceMaterial),
  };
}

export function buildIntentIndex(intent: FeatureIntent): IntentRef[] {
  const index: IntentRef[] = [{ id: "intent.title", kind: "title", text: intent.title }];
  sentences(intent.context).forEach((s, i) =>
    index.push({ id: `intent.context.${i + 1}`, kind: "context", text: s }),
  );
  intent.goals.forEach((g, i) => index.push({ id: `intent.goal.${i + 1}`, kind: "goal", text: g }));
  intent.constraints.forEach((c, i) =>
    index.push({ id: `intent.constraint.${i + 1}`, kind: "constraint", text: c }),
  );
  intent.sourceMaterial.forEach((s, i) =>
    index.push({ id: `intent.source.${i + 1}`, kind: "source", text: s }),
  );
  return index;
}

export async function runSixD(raw: RawIntent): Promise<RunManifest> {
  const intent = normalizeIntent(raw);
  const index = buildIntentIndex(intent);
  const byId = new Map<string, IntentRef | ArtifactElement>();
  for (const a of index) byId.set(a.id, a);

  const artifacts: PhaseArtifact[] = [];
  for (const phase of PHASES) {
    const art = phase({ intent, index, byId, upstream: artifacts });
    for (const e of art.elements) byId.set(e.id, e);
    artifacts.push(art);
  }

  const sansReceipt = {
    schema: "6d.run.v1" as const,
    intent,
    intentIndex: index,
    artifacts,
    generatedBy: GENERATED_BY,
  };
  const receipt = await sha256Hex(stableStringify(sansReceipt));
  return { ...sansReceipt, receipt };
}

/** Re-run the manifest's own intent and check the hash lands identically. */
export async function verifyRun(manifest: RunManifest): Promise<{ ok: boolean; recomputed: string }> {
  const fresh = await runSixD(manifest.intent);
  return { ok: fresh.receipt === manifest.receipt, recomputed: fresh.receipt };
}

export function resolvableIds(manifest: RunManifest): Set<string> {
  const ids = new Set<string>(manifest.intentIndex.map((a) => a.id));
  for (const art of manifest.artifacts) for (const e of art.elements) ids.add(e.id);
  return ids;
}

/** Trace integrity: every element has ≥1 sourceRef, and every ref resolves. */
export function validateTrace(manifest: RunManifest): { ok: boolean; problems: TraceProblem[] } {
  const ids = resolvableIds(manifest);
  const problems: TraceProblem[] = [];
  for (const art of manifest.artifacts) {
    for (const e of art.elements) {
      if (!e.sourceRefs.length) {
        problems.push({ elementId: e.id, ref: "(none)", problem: "element has no sourceRefs" });
      }
      for (const r of e.sourceRefs) {
        if (!ids.has(r)) problems.push({ elementId: e.id, ref: r, problem: "unresolvable ref" });
      }
    }
  }
  return { ok: problems.length === 0, problems };
}

/** Transitive lineage of an element — BFS over sourceRefs, cycle-safe. */
export function lineage(manifest: RunManifest, elementId: string): string[] {
  const byId = new Map<string, ArtifactElement>();
  for (const art of manifest.artifacts) for (const e of art.elements) byId.set(e.id, e);
  const out: string[] = [];
  const seen = new Set<string>([elementId]);
  const queue: string[] = [...(byId.get(elementId)?.sourceRefs ?? [])];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    const el = byId.get(id);
    if (el) queue.push(...el.sourceRefs);
  }
  return out;
}
