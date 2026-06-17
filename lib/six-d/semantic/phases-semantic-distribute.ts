// 6D Semantic Layer — DISTRIBUTE phase (semantic promotion).
//
// This is the Tier-2 promotion of v1 `distributePhase` (phases.ts §3).
//
// WHAT IS PROMOTED:
//   v1 calls `bucketsFor(g.text)` on each goal text to derive labels and
//   dependency rules. `bucketsFor` is a keyword-phrase scan — pure string
//   matching. The semantic model gives us something richer: each requirement is
//   typed (EARS class + modality + polarity), each requirement carries the ids of
//   the canonical entities it governs, and each entity has a reconciled role
//   (actor / system / action) with provenance refs. Here, story labels come from
//   the typed requirements a story covers, and those requirements are cited via
//   sourceRefs on the story. Entity ids from `requirement.entityRefs` surface in
//   the story's `fields` so downstream phases share one canonical identity
//   reference instead of a bare noun string.
//
// WHAT IS KEPT STRUCTURAL (no change from v1):
//   • Element KINDS: epic, story, dependency_graph — same three, same names.
//   • Story fields: estimate, labels, dependsOn, acRefs — downstream phases
//     (develop, detect, deliver) and the gate read all of them.
//   • Deterministic t-shirt sizing: AC count + dependency bump.
//   • Dependency-graph rules: audit-after-risk, ui-after-risk/auth — unchanged.
//   • AC assignment logic: by goal ref first, then by label affinity.
//   • Open-question discipline: calibration note, and honest gaps for narrative
//     requirements the model could not type.
//
// HONEST GAP:
//   If a requirement covering a story goal is typed as "narrative" (the
//   deterministic EARS parser could not classify it), a brief open-question is
//   surfaced rather than guessing a label bucket. The story still gets a label
//   from the other typed requirements it covers; only the narrative gap is named.
//
// Pure: no clock, no randomness, no network. Same ctx + model → same artifact.

import { BUCKET_ORDER, type Bucket, cap, stripPeriod, tidy } from "../helpers";
import type { ArtifactElement, OpenQuestion, PhaseArtifact, PhaseCtx, PhaseId } from "../types";
import { PHASE_META } from "../types";
import { actionsFrom, actorsFrom, entityById, systemsFrom } from "./adapter";
import type { IntentSemanticModel } from "./model";
import type { CanonicalEntity } from "./nebula";

// ── Local collector (mirrors phases.ts `C`, kept private here) ───────────────

class SC {
  els: ArtifactElement[] = [];
  oqs: OpenQuestion[] = [];
  private counts = new Map<string, number>();
  constructor(private phase: PhaseId) {}

  el(
    kind: string,
    body: string,
    sourceRefs: string[],
    extra?: { title?: string; fields?: Record<string, string | string[]> },
  ): ArtifactElement {
    const n = (this.counts.get(kind) ?? 0) + 1;
    this.counts.set(kind, n);
    const e: ArtifactElement = { id: `${this.phase}.${kind}.${n}`, kind, body, sourceRefs };
    if (extra?.title) e.title = extra.title;
    if (extra?.fields) e.fields = extra.fields;
    this.els.push(e);
    return e;
  }

  oq(about: string, question: string, blocking = false): OpenQuestion {
    const q: OpenQuestion = {
      id: `${this.phase}.oq.${this.oqs.length + 1}`,
      phase: this.phase,
      about,
      question,
      blocking,
    };
    this.oqs.push(q);
    return q;
  }

  done(): PhaseArtifact {
    const meta = PHASE_META.find((m) => m.phase === this.phase)!;
    return { ...meta, elements: this.els, openQuestions: this.oqs };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SIZE_UP: Record<string, string> = { S: "M", M: "L", L: "L" };

const phaseEls = (ctx: PhaseCtx, phase: PhaseId, kind?: string): ArtifactElement[] => {
  const art = ctx.upstream.find((a) => a.phase === phase);
  if (!art) return [];
  return kind ? art.elements.filter((e) => e.kind === kind) : art.elements;
};

/** Intent atoms of a given kind. */
const atoms = (ctx: PhaseCtx, kind: string) => ctx.index.filter((a) => a.kind === kind);

/**
 * THE PROMOTION: derive labels for a goal from the TYPED requirements it covers,
 * and from canonical entities that were reconciled FROM that goal atom.
 *
 * v1: `bucketsFor(g.text)` — keyword phrase scan over the raw goal text.
 * Semantic: TWO grounding paths, both deterministic:
 *
 *   PATH A — via requirements (sourceRef → goalRef):
 *     Each requirement already carries typed EARS class + modality + polarity +
 *     budget and a list of entity ids (entityRefs) reconciled from that clause.
 *     We map requirement typing + entity roles to label buckets.
 *
 *   PATH B — via entities (entity.sourceRefs ∋ goalRef):
 *     An entity may have been reconciled from a mention INSIDE the goal atom even
 *     if the ASTRAL requirement for that goal has empty entityRefs (e.g. when the
 *     EARS parser classified the clause but NEBULA's entitiesByRef lookup did not
 *     populate the entity back into the requirement). Walking entities that list
 *     the goalRef in their sourceRefs captures this case without inventing anything.
 *
 * Label mapping (deterministic):
 *   • entity.role === "system" + key matches auth/idp/sso/credential  → "auth"
 *   • entity.role === "system" + key matches audit/log/trail/record    → "audit"
 *   • entity.role === "action" + key matches audit/log/trail/record    → "audit"
 *   • entity.role === "action" + key matches auth/challenge/credential → "auth"
 *   • entity.role === "action" + key matches risk/fraud/reversal       → "risk"
 *   • entity.role === "action" + key matches export/import/data/pii    → "data"
 *   • requirement.typing.polarity === "exclude" or EARS "unwanted"     → "risk"
 *   • requirement.typing.canonical.budget present + mandatory          → "performance"
 *   • EARS "constraint" + budget in text (numbers+units)               → "performance"
 *
 * Returns labels in BUCKET_ORDER, entity ids grounding them, and narrative gaps.
 */
function labelsFromModel(
  goalRef: string,
  model: IntentSemanticModel,
): { labels: Bucket[]; narrativeGaps: string[]; entityIds: string[] } {
  const hits = new Set<Bucket>();
  const narrativeGaps: string[] = [];
  const entityIds: string[] = [];

  // ── PATH A: typed requirements whose sourceRef is this goal atom ─────────
  const coveredReqs = model.requirements.filter((r) => r.sourceRef === goalRef);
  for (const req of coveredReqs) {
    if (req.typing.ears === "narrative") {
      narrativeGaps.push(req.text);
      // still continue to PATH B entities for this req's entityRefs
    }

    if (req.typing.polarity === "exclude" || req.typing.ears === "unwanted") {
      hits.add("risk");
    }
    if (req.typing.modality === "mandatory" && req.typing.canonical.budget !== undefined) {
      hits.add("performance");
    }
    // EARS "constraint" with a budget phrase in the text
    if (req.typing.ears === "constraint" && /\b\d+(\.\d+)?\s*(ms|s|sec|%|m|min)\b/i.test(req.text)) {
      hits.add("performance");
    }

    for (const eId of req.entityRefs) {
      entityIds.push(eId);
      applyEntityLabel(entityById(model, eId), req.typing.modality, hits);
    }
  }

  // ── PATH B: entities whose sourceRefs include this goal atom ─────────────
  // Captures mentions NEBULA reconciled from the goal atom that weren't threaded
  // back into the requirement's entityRefs (e.g. when the EARS parser ran before
  // NEBULA resolved the mention into an entity id at that atom).
  for (const ent of model.entities) {
    if (!ent.sourceRefs.includes(goalRef)) continue;
    if (!entityIds.includes(ent.id)) {
      entityIds.push(ent.id);
    }
    // Use "unspecified" modality for path B (we don't have a paired requirement)
    applyEntityLabel(ent, "unspecified", hits);
  }

  const labels = BUCKET_ORDER.filter((b) => hits.has(b));
  return { labels, narrativeGaps, entityIds: [...new Set(entityIds)] };
}

/** Apply label buckets from a single entity, given the modality of its covering req. */
function applyEntityLabel(
  ent: CanonicalEntity | undefined,
  modality: string,
  hits: Set<Bucket>,
): void {
  if (!ent) return;
  const key = ent.key.toLowerCase();

  if (ent.role === "system") {
    if (/\b(auth|idp|sso|login|credential|step.?up|re.?auth|identity)\b/.test(key)) {
      hits.add("auth");
    } else if (/\b(audit|log|trail|record)\b/.test(key)) {
      hits.add("audit");
    }
  }

  if (ent.role === "action") {
    if (/\b(audit|log|trail|record)\b/.test(key)) hits.add("audit");
    if (/\b(auth|verify|authenticate|challenge|credential)\b/.test(key)) hits.add("auth");
    if (/\b(risk|fraud|reverse|reversal|unauthori[sz])\b/.test(key)) hits.add("risk");
    if (/\b(export|import|data|pii|encrypt)\b/.test(key)) hits.add("data");
  }

  if (ent.role === "actor" && modality === "mandatory" && !hits.size) {
    hits.add("ui");
  }
}

// ── Entity provenance refs ────────────────────────────────────────────────────

const refsOf = (e: CanonicalEntity): string[] =>
  e.sourceRefs.length ? e.sourceRefs : ["intent.title"];

// ═══════════════════════════════════════════════════════════════════════
// distributePhaseSemantic
// ═══════════════════════════════════════════════════════════════════════

/**
 * Semantic promotion of v1 `distributePhase`.
 *
 * Signature: same shape as the other semantic phases — `(ctx, model)`.
 * Element kinds + fields: identical to v1 (epic, story, dependency_graph;
 * fields: estimate, labels, dependsOn, acRefs). Downstream phases and the
 * gate depend on this contract — it is not changed.
 *
 * THE PROMOTION lives in two places:
 *   1. Labels — derived from typed requirements covering each story's goal
 *      (EARS class + modality + entity role), NOT from `bucketsFor(g.text)`.
 *   2. sourceRefs — the story now cites the canonical entity ids that ground
 *      its typed requirements, so every label can be traced back to a
 *      reconciled entity (actor / system / action) not a keyword match.
 *
 * What stays structural:
 *   t-shirt sizing, dep rules, AC assignment, element kinds+fields, oqs.
 */
export function distributePhaseSemantic(
  ctx: PhaseCtx,
  model: IntentSemanticModel,
): PhaseArtifact {
  const c = new SC("distribute");
  const { intent } = ctx;
  const goals = atoms(ctx, "goal");
  const contextAtoms = atoms(ctx, "context");
  const defineStories = phaseEls(ctx, "define", "story");
  const defineAcs = phaseEls(ctx, "define", "acceptance_criterion");
  const objective = phaseEls(ctx, "define", "objective")[0];

  // All canonical entities — for provenance surfacing
  const actors = actorsFrom(model);
  const systems = systemsFrom(model);
  const actions = actionsFrom(model);
  const allEntities = [...actors, ...systems, ...actions];

  // ── Epic ───────────────────────────────────────────────────────────────────
  // Identical to v1; no model upgrade needed here — the epic cites the objective
  // and the context atom, which already carry their own provenance.
  c.el(
    "epic",
    `${objective ? objective.body : tidy(intent.title)}${contextAtoms[0] ? ` ${tidy(contextAtoms[0].text)}` : ""}`,
    [...(objective ? [objective.id] : ["intent.title"]), ...(contextAtoms[0] ? [contextAtoms[0].id] : [])],
    { title: intent.title },
  );

  // ── Story label derivation (THE PROMOTION) ─────────────────────────────────
  // v1: storyBuckets[i] = bucketsFor(g.text) — keyword scan over raw goal text.
  // Semantic: derive from typed requirements + canonical entity roles.
  const storyLabelsResult = goals.map((g) => labelsFromModel(g.id, model));
  const storyBuckets: Bucket[][] = storyLabelsResult.map((r) => r.labels);
  const storyEntityIds: string[][] = storyLabelsResult.map((r) => r.entityIds);
  const storyNarrativeGaps: string[][] = storyLabelsResult.map((r) => r.narrativeGaps);

  // ── AC assignment (same logic as v1) ─────────────────────────────────────
  const acAssignment = new Map<string, number>(); // ac.id → story index
  for (const ac of defineAcs) {
    const goalIdx = goals.findIndex((g) => ac.sourceRefs.includes(g.id));
    if (goalIdx >= 0) {
      acAssignment.set(ac.id, goalIdx);
      continue;
    }
    const byBucket = storyBuckets.findIndex((bs) =>
      bs.some((b) => ac.body.toLowerCase().includes(b)),
    );
    acAssignment.set(ac.id, byBucket >= 0 ? byBucket : 0);
  }

  // ── Dependency rules (identical deterministic logic to v1) ────────────────
  const idxWith = (b: Bucket): number => storyBuckets.findIndex((bs) => bs.includes(b));
  const dependsOn: number[][] = goals.map(() => []);
  const riskIdx = idxWith("risk");
  for (let i = 0; i < goals.length; i++) {
    if (storyBuckets[i].includes("audit") && riskIdx >= 0 && riskIdx !== i) {
      dependsOn[i].push(riskIdx);
    }
    if (storyBuckets[i].includes("ui")) {
      const core = riskIdx >= 0 ? riskIdx : idxWith("auth");
      if (core >= 0 && core !== i && !dependsOn[i].includes(core)) dependsOn[i].push(core);
    }
  }

  // ── Stories ───────────────────────────────────────────────────────────────
  const storyIds: string[] = goals.map((_, i) => `distribute.story.${i + 1}`);

  for (let i = 0; i < goals.length; i++) {
    const g = goals[i];
    const src = defineStories[i];
    const acs = defineAcs.filter((ac) => acAssignment.get(ac.id) === i);
    let estimate = acs.length <= 1 ? "S" : acs.length <= 3 ? "M" : "L";
    if (dependsOn[i].length) estimate = SIZE_UP[estimate];
    const deps = dependsOn[i].map((d) => storyIds[d]);

    const body = [
      src ? src.body : `Deliver: ${tidy(g.text)}`,
      "",
      "Acceptance:",
      ...acs.map((ac) => `- ${ac.body}`),
    ].join("\n");

    // THE PROMOTION: sourceRefs now include the canonical entity ids that ground
    // the story's typed requirements, not just the goal + ACs.
    const entityProvenanceRefs = storyEntityIds[i]
      .flatMap((eId) => {
        const ent = allEntities.find((e) => e.id === eId);
        return ent ? refsOf(ent) : [];
      });

    const sourceRefs = [
      ...(src ? [src.id] : []),
      g.id,
      ...acs.map((ac) => ac.id),
      ...entityProvenanceRefs,
    ].filter((ref, pos, arr) => arr.indexOf(ref) === pos); // deduplicate

    c.el(
      "story",
      body,
      sourceRefs,
      {
        title: cap(stripPeriod(g.text)),
        fields: {
          estimate,
          labels: storyBuckets[i].length ? storyBuckets[i] : ["general"],
          dependsOn: deps,
          acRefs: acs.map((ac) => ac.id),
          // THE PROMOTION: entity ids that grounded the labels — traceable, not invented.
          groundedEntities: storyEntityIds[i].length ? storyEntityIds[i] : [],
        },
      },
    );

    // Honest open-questions for narrative requirements this story covers.
    // v1 had no equivalent; here we surface the gap rather than silently dropping it.
    for (const narGap of storyNarrativeGaps[i]) {
      c.oq(
        "story",
        `Requirement "${stripPeriod(narGap)}" covering "${cap(stripPeriod(g.text))}" matched no controlled EARS grammar — the deterministic layer could not derive a label bucket from it. Confirm its label and testable obligation with the accountable PO. (Narrative gap; see the semantic-layer frontier report.)`,
      );
    }
  }

  // ── Dependency graph (identical to v1) ────────────────────────────────────
  const edges: string[] = [];
  for (let i = 0; i < goals.length; i++) {
    for (const d of dependsOn[i]) edges.push(`${storyIds[i]} → ${storyIds[d]}`);
  }
  c.el(
    "dependency_graph",
    edges.length ? edges.join("\n") : "No cross-story dependencies derived from the intent.",
    storyIds.length ? storyIds : ["intent.title"],
    { title: "Dependencies" },
  );

  // Calibration note (same as v1) + note about what the model grounded.
  c.oq(
    "story",
    "Estimates are deterministic t-shirt heuristics (AC count + dependencies) — calibrate with the team's own sizing convention.",
  );

  const groundedCount = goals.filter((_, i) => storyEntityIds[i].length > 0).length;
  if (groundedCount < goals.length) {
    c.oq(
      "story",
      `${goals.length - groundedCount} of ${goals.length} stor${goals.length - groundedCount === 1 ? "y" : "ies"} had no canonical entity grounding its labels — the semantic model did not resolve entities from those goal atoms. Labels fell back to empty / "general". Consider enriching the intent with actor, system, or action vocabulary the NEBULA lexicon can recognize.`,
    );
  }

  return c.done();
}
