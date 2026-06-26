// THE AGILITY ↔ 6D LOOP — the bidirectional adapter.
//
// Two products, one governed system:
//   • Agility = PRODUCT  — what to build, prioritized (intake→score→tier→allocate).
//   • 6D      = ARCHITECTURE — the buildable spec (Define…Deliver, gated + chained).
//
// The loop:  Agility decides → 6D specs → 6D's decomposed size + open issues feed
// BACK to Agility to re-prioritize against the REAL size. Decide → specify →
// measure → re-decide, with a receipt riding the whole circle.
//
// This module is the seam. Two pure, deterministic functions:
//   • initiativeToIntent(initiative)          → RawIntent      (forward: decide → spec)
//   • artifactsToInitiativeUpdate(run, init)  → InitiativeUpdate (back: spec → re-decide)
//
// LOAD-BEARING — the provenance flow-through: an Initiative's `evidence` map
// (`{ field: source }`) becomes the 6D intent's `sourceMaterial`, which VELLUM
// then binds and hashes. The receipts must flow Agility → 6D UNBROKEN: a 6D
// artifact element can be traced back to a real Agility evidence source.
//
// No LLM, no clock, no Math.random in this path. Same initiative ⇒ same intent
// ⇒ (via the 6D engine) same artifacts ⇒ same update.
// 🐦‍⬛ + 🔑

import type { RawIntent } from "@/lib/six-d/engine";
import type { CosmicRun } from "@/lib/six-d/cosmic";
import type { ArtifactElement, PhaseArtifact } from "@/lib/six-d/types";
import type { Initiative } from "@/lib/agility";

// Secondary goals — ticket-shaped slices, not pipeline boilerplate.
const VALUE_TYPE_STORY: Record<string, string> = {
  "Direct Customer Revenue": "Validate revenue impact and margin guardrails",
  "Direct Customer Service": "Validate customer service outcomes and SLAs",
  "Internal Enabler": "Deliver the internal capability with operational handoff",
  "Risk-Compliance": "Meet regulatory and audit obligations",
  "Strategic-Optionality": "Preserve strategic option value without over-building",
};

function reachGoal(value: number, unit: string): string {
  const n = value >= 1000 ? value.toLocaleString("en-US") : String(value);
  return `Scale to ${n} ${unit}`;
}

// ═════════════════════════ FORWARD — decide → specify ═══════════════════════
//
// initiativeToIntent: an Agility Initiative becomes a 6D RawIntent. RawIntent is
// exactly the FeatureIntent input shape ({title, context, goals[], constraints[],
// sourceMaterial[]}); the 6D engine normalizes it (id/trim) on the way in.

export function initiativeToIntent(initiative: Initiative): RawIntent {
  const i = initiative;

  // title ← initiative.title
  const title = i.title;

  // context ← description only (problem statement — no metadata soup)
  const context = i.description.trim();

  // goals ← outcome + value slice + reach slice (distinct, ticket-shaped)
  const goals: string[] = [
    i.outcome,
    VALUE_TYPE_STORY[i.valueType] ?? "Validate delivery outcomes",
    reachGoal(i.reach.value, i.reach.unit),
  ];

  // constraints ← portfolio metadata + mandate/channel/deps/talent/budget
  const constraints: string[] = [
    `Outcome: ${i.outcome}`,
    `Area: ${i.area} · Sponsor: ${i.sponsor}`,
  ];
  if (i.mandate && i.mandateCitation) {
    constraints.push(`Regulatory mandate — ${i.mandateCitation}`);
  }
  if (i.businessImpact) {
    constraints.push(`Channel: ${i.businessImpact}`);
  }
  if (i.dependsOn && i.dependsOn.length) {
    constraints.push(`Depends on ${i.dependsOn.join(", ")}`);
  }
  if (i.talentProfile) {
    constraints.push(`Talent: ${i.talentProfile}`);
  }
  if (i.budgetCyclePosition) {
    constraints.push(`Budget cycle: ${i.budgetCyclePosition}`);
  }

  // sourceMaterial ← THE PROVENANCE FLOW-THROUGH (load-bearing).
  // Each Agility evidence entry `{ field: source }` becomes a 6D source atom
  // "field: source". VELLUM resolves and hashes these; an artifact element that
  // cites one of them traces — unbroken — back to where Agility says the number
  // came from.
  const evidence = i.evidence ?? {};
  const sourceMaterial: string[] = Object.entries(evidence).map(
    ([field, src]) => `${field}: ${src}`,
  );

  return { title, context, goals, constraints, sourceMaterial };
}

// ═════════════════════════ REVERSE — specify → re-decide ════════════════════
//
// artifactsToInitiativeUpdate: the 6D run's DECOMPOSED size + open issues become
// the feedback Agility re-prioritizes against. This closes the loop.

/** A 6D "story slice" t-shirt estimate, mapped to team-weeks. */
export const ESTIMATE_WEEKS: Record<string, number> = { S: 1, M: 2, L: 4 };

/** One suggested dependency derived from the 6D Distribute dependency graph. */
export interface DerivedDependency {
  /** The dependent story id (6D Distribute), e.g. "distribute.story.2". */
  from: string;
  /** The story it depends on, e.g. "distribute.story.1". */
  on: string;
  /** Human edge, as the dependency_graph element renders it. */
  edge: string;
}

/** One open issue feeding back — an AURORA REFUSE/HOLD or a blocking gap. */
export interface OpenIssue {
  /** AURORA need key — `oq:<id>` or `unbound:<elementId>`. */
  key: string;
  phase: string;
  /** "REFUSE" | "HOLD" — the worst verdict that produced this issue. */
  verdict: "REFUSE" | "HOLD";
  blocking: boolean;
  /** Exactly what must be resolved (sourced, never estimated). */
  required: string;
}

export interface InitiativeUpdate {
  /** The Agility initiative this update feeds back into. */
  initiativeId: string;
  /**
   * The REAL decomposed size: sum of the Distribute slices' estimates
   * (S/M/L → 1/2/4 wk). This is what 6D measured, vs the rough
   * `effortTeamWeeks` Agility started with.
   */
  reEstimatedEffortTeamWeeks: number;
  /** The rough estimate we started with, for the side-by-side. */
  roughEffortTeamWeeks: number;
  /** Did the decomposed size differ from the rough one? (the whole point). */
  reEstimateDiffers: boolean;
  /**
   * Dependencies the spec surfaced — derived from the Distribute dependency
   * graph. These are 6D *story-level* dependencies inside this one initiative
   * (intra-feature build order), offered as `dependsOn`-style additions to
   * consider. They are NOT Agility initiative ids (the spec decomposes one
   * initiative; cross-initiative deps come from Agility's own `dependsOn`).
   */
  dependencies: DerivedDependency[];
  /** AURORA REFUSE/HOLD + blocking open questions, flattened. */
  openIssues: OpenIssue[];
  openIssueCount: number;
  /** The run's LUNA receipt — the chain head sealing this spec. */
  specReceipt: string;
  /** "ready" if no blocking refusals, else "needs-resolution". */
  verdict: "ready" | "needs-resolution";
}

/** Pull the Distribute phase out of a run's manifest. */
function distributePhase(run: CosmicRun): PhaseArtifact | undefined {
  return run.manifest.artifacts.find((a) => a.phase === "distribute");
}

/** Distribute "story" elements carry `fields.estimate` (S/M/L) and `fields.dependsOn`. */
function distributeStories(run: CosmicRun): ArtifactElement[] {
  return (distributePhase(run)?.elements ?? []).filter((e) => e.kind === "story");
}

/**
 * Re-estimate from the decomposed slices: each Distribute story's t-shirt
 * estimate (S/M/L) → 1/2/4 team-weeks, summed. Unknown/absent estimates
 * contribute 0 (we don't invent a size). Deterministic.
 */
export function reEstimateTeamWeeks(run: CosmicRun): number {
  let total = 0;
  for (const story of distributeStories(run)) {
    const est = story.fields?.estimate;
    if (typeof est === "string" && est in ESTIMATE_WEEKS) {
      total += ESTIMATE_WEEKS[est];
    }
  }
  return total;
}

/**
 * Derive suggested dependencies from the Distribute dependency graph. Each
 * story's `fields.dependsOn` lists the story ids it depends on; we surface those
 * edges. Deterministic, in construction order.
 */
export function derivedDependencies(run: CosmicRun): DerivedDependency[] {
  const out: DerivedDependency[] = [];
  for (const story of distributeStories(run)) {
    const deps = story.fields?.dependsOn;
    if (Array.isArray(deps)) {
      for (const on of deps) {
        out.push({ from: story.id, on, edge: `${story.id} → ${on}` });
      }
    }
  }
  return out;
}

/**
 * Flatten AURORA's outstanding needs into open issues. Every REFUSE/HOLD the gate
 * raised — element-level (unbound or a blocking gap) and phase-level (open
 * questions) — becomes one issue with its resolution requirement. The verdict
 * carried is REFUSE for blocking needs, HOLD for non-blocking. Deterministic
 * (gate order → element order). De-duped by key.
 */
export function openIssuesFrom(run: CosmicRun): OpenIssue[] {
  const seen = new Set<string>();
  const issues: OpenIssue[] = [];
  for (const av of run.gate.artifacts) {
    // Element-level verdicts that carry a resolve need.
    for (const ev of av.elements) {
      if (ev.resolve && (ev.verdict === "REFUSE" || ev.verdict === "HOLD")) {
        if (seen.has(ev.resolve.key)) continue;
        seen.add(ev.resolve.key);
        issues.push({
          key: ev.resolve.key,
          phase: av.phase,
          verdict: ev.verdict,
          blocking: ev.resolve.blocking,
          required: ev.resolve.required,
        });
      }
    }
    // Phase-level needs (open questions not tied to a specific element).
    for (const need of av.resolves) {
      if (seen.has(need.key)) continue;
      seen.add(need.key);
      issues.push({
        key: need.key,
        phase: av.phase,
        verdict: need.blocking ? "REFUSE" : "HOLD",
        blocking: need.blocking,
        required: need.required,
      });
    }
  }
  return issues;
}

/**
 * The reverse leg: turn a sealed CosmicRun back into an Agility-facing update.
 * `entryHash` is the LUNA chain head for the run (from runSixDCosmic's `entry`);
 * if omitted, we fall back to the run's own deterministic runHash so the receipt
 * is never empty.
 */
export function artifactsToInitiativeUpdate(
  cosmicRun: CosmicRun,
  initiative: Initiative,
  entryHash?: string,
): InitiativeUpdate {
  const reEstimatedEffortTeamWeeks = reEstimateTeamWeeks(cosmicRun);
  const roughEffortTeamWeeks = initiative.effortTeamWeeks;
  const dependencies = derivedDependencies(cosmicRun);
  const openIssues = openIssuesFrom(cosmicRun);

  // verdict: ready iff no blocking refusal stands.
  const anyBlocking = openIssues.some((iss) => iss.blocking);
  const verdict: InitiativeUpdate["verdict"] = anyBlocking
    ? "needs-resolution"
    : "ready";

  return {
    initiativeId: initiative.id,
    reEstimatedEffortTeamWeeks,
    roughEffortTeamWeeks,
    reEstimateDiffers: reEstimatedEffortTeamWeeks !== roughEffortTeamWeeks,
    dependencies,
    openIssues,
    openIssueCount: openIssues.length,
    specReceipt: entryHash ?? cosmicRun.runHash,
    verdict,
  };
}
