// 6D Semantic Layer — DETECT phase (semantic promotion).
//
// This is a model-driven promotion of v1 `detectPhase` (lib/six-d/phases.ts).
// It keeps every element KIND, the AC → scenario coverage map, the honest
// blocking open-question when an AC is uncovered, and the Playwright/Gherkin
// scaffolds — those are load-bearing methodology discipline, not negotiable.
//
// THE PROMOTION: where v1 keyword-checks story `labels` / `bucketsFor` to
// decide whether to emit a negative or edge scenario, this version drives those
// decisions from the typed requirements in `IntentSemanticModel`:
//
//   • A BUDGETED requirement  → a boundary test at its stated budget value.
//   • A MANDATORY / "must" requirement → a negative test that the obligation
//     holds under the failure condition (obligation-under-failure).
//   • A NARRATIVE requirement → honest open-question instead of a guessed
//     negative (we don't bullshit).
//
// Happy-path and coverage-map logic are kept deterministic from the upstream
// PhaseCtx (distributePhase/definePhase output), exactly as in v1.
// The scenarios cite the reconciled canonical entities they exercise, so every
// generated scenario is grounded in provenance — not invented.
//
// Pure: no clock, no randomness, no network.

import { stripPeriod } from "../helpers";
import type { ArtifactElement, OpenQuestion, PhaseArtifact, PhaseCtx } from "../types";
import { PHASE_META } from "../types";
import { actorsFrom, actionsFrom, budgetedRequirements, narrativeRequirements, requirementsByModality } from "./adapter";
import type { IntentSemanticModel } from "./model";

// ── Collector — mirrors phases.ts `C`, kept local (same stable-id discipline) ─

class SC {
  els: ArtifactElement[] = [];
  oqs: OpenQuestion[] = [];
  private counts = new Map<string, number>();

  constructor(private phase: "detect") {}

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

// ── Shared lookup helpers ─────────────────────────────────────────────────────

const phaseEls = (ctx: PhaseCtx, phase: "define" | "distribute", kind?: string): ArtifactElement[] => {
  const art = ctx.upstream.find((a) => a.phase === phase);
  if (!art) return [];
  return kind ? art.elements.filter((e) => e.kind === kind) : art.elements;
};

/** Format a comma-separated entity citation for a scenario body. */
const entityCitation = (ids: string[]): string =>
  ids.length ? ` [exercises: ${ids.join(", ")}]` : "";

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * detectPhaseSemantic — model-driven promotion of v1 detectPhase.
 *
 * Signature: same as v1 detectPhase but takes the IntentSemanticModel as a
 * second argument (the Tier-2 pattern from phases-semantic.ts). Element kinds
 * are identical to v1: test_scenario, coverage_map, scaffold.
 */
export function detectPhaseSemantic(
  ctx: PhaseCtx,
  model: IntentSemanticModel,
): PhaseArtifact {
  const c = new SC("detect");
  const { intent } = ctx;

  // ── Pull upstream artifacts ─────────────────────────────────────────────────
  const defineAcs = phaseEls(ctx, "define", "acceptance_criterion");
  const stories = phaseEls(ctx, "distribute", "story");

  // ── Model-side lookups ──────────────────────────────────────────────────────
  const actors = actorsFrom(model);
  const actions = actionsFrom(model);
  const budgeted = budgetedRequirements(model);
  const mandatory = requirementsByModality(model, "mandatory");
  const narrative = narrativeRequirements(model);

  // Collect entity ids for each requirement ref so scenarios can cite them.
  const entitiesForRef = (sourceRef: string): string[] =>
    model.entities
      .filter((e) => e.sourceRefs.includes(sourceRef))
      .map((e) => e.id);

  // Build a reverse map: budget requirement sourceRef → budget raw string.
  // Used to decide whether an AC's source constraint has a typed budget.
  const budgetByRef = new Map<string, string>(
    budgeted.map((r) => [r.sourceRef, (r.typing.canonical.budget as { raw: string }).raw]),
  );

  // Build set of mandatory requirement sourceRefs — these drive negative tests.
  const mandatoryRefs = new Set<string>(mandatory.map((r) => r.sourceRef));

  // Build set of narrative requirement sourceRefs — these drive honest OQs.
  const narrativeRefs = new Set<string>(narrative.map((r) => r.sourceRef));

  // Global flags.
  const coverage = new Map<string, string[]>(); // ac.id → scenario ids
  let genericNarrativeOqRaised = false;

  // ── Per-story, per-AC scenario generation ──────────────────────────────────
  for (const story of stories) {
    const acIds = (story.fields?.acRefs as string[]) ?? [];
    const acs = defineAcs.filter((ac) => acIds.includes(ac.id));

    for (const ac of acs) {
      // The AC's own source ref(s) — used to look up requirement typing.
      const acSourceRefs = ac.sourceRefs.filter((r) => r.startsWith("intent."));
      const acEntityIds = [
        ...new Set(acSourceRefs.flatMap(entitiesForRef)),
        ...actors.map((a) => a.id),
        ...actions.map((a) => a.id),
      ];
      const citation = entityCitation([...new Set(acEntityIds)]);

      // 1) HAPPY PATH — same as v1, always emitted.
      const happy = c.el(
        "test_scenario",
        `Verify: ${ac.body}${citation}`,
        [ac.id, story.id],
        { fields: { type: "happy", ac: ac.id, story: story.id } },
      );
      coverage.set(ac.id, [...(coverage.get(ac.id) ?? []), happy.id]);

      // 2) NEGATIVE PATH — model-driven (the promotion).
      //
      //    v1 checked: `labels.includes("auth") || labels.includes("risk")`
      //    We check: does any source ref for this AC carry a MANDATORY requirement?
      //    If so → obligaton-under-failure scenario, citing the requirement's
      //    entity refs for provenance. This is semantically richer: the model
      //    tells us WHAT the obligation is, not just that an "auth" label exists.
      //
      //    If the AC traces to a narrative requirement → honest open-question
      //    rather than guessing the failure mode (we don't bullshit).
      //
      //    Otherwise → generic negative, same as v1 (safe, still keeps coverage).

      const acHasMandatory = acSourceRefs.some((r) => mandatoryRefs.has(r));
      const acHasNarrative = acSourceRefs.some((r) => narrativeRefs.has(r));

      if (acHasMandatory) {
        // Find the mandatory requirement(s) to cite their entities.
        const mandReqs = mandatory.filter((r) => acSourceRefs.includes(r.sourceRef));
        const mandEntityIds = mandReqs.flatMap((r) => entitiesForRef(r.sourceRef));
        const mandCitation = entityCitation([...new Set([...acEntityIds, ...mandEntityIds])]);

        const neg = c.el(
          "test_scenario",
          `Obligation-under-failure — the mandatory requirement behind "${stripPeriod(ac.body).slice(0, 60)}…" must hold even when the primary path fails: induce the failure condition and verify the obligation is not silently bypassed.${mandCitation}`,
          [ac.id, story.id, ...mandReqs.map((r) => r.sourceRef)],
          { fields: { type: "negative", ac: ac.id, story: story.id } },
        );
        coverage.set(ac.id, [...(coverage.get(ac.id) ?? []), neg.id]);
      } else if (acHasNarrative) {
        // Narrative requirement: we do NOT invent a failure mode.
        const neg = c.el(
          "test_scenario",
          `Negative path for "${stripPeriod(ac.body).slice(0, 80)}…": the requirement is narrative (no controlled-grammar class) — expected failure behavior is unspecified; confirm with QA before writing a negative test.`,
          [ac.id, story.id],
          { fields: { type: "negative", ac: ac.id, story: story.id } },
        );
        coverage.set(ac.id, [...(coverage.get(ac.id) ?? []), neg.id]);
        if (!genericNarrativeOqRaised) {
          genericNarrativeOqRaised = true;
          c.oq(
            "test_scenario",
            "One or more ACs trace to narrative (untyped) requirements — expected failure behavior is not specified by the deterministic layer. Confirm refusal / rollback semantics with QA and the accountable PO before closing coverage.",
          );
        }
      } else {
        // No mandatory, no narrative — safe generic negative (v1-equivalent path).
        const neg = c.el(
          "test_scenario",
          `Negative path for "${stripPeriod(ac.body).slice(0, 80)}…": induce the failure mode and verify the system refuses without partial effects — expected behavior not specified in the intent (see open question).${citation}`,
          [ac.id, story.id],
          { fields: { type: "negative", ac: ac.id, story: story.id } },
        );
        coverage.set(ac.id, [...(coverage.get(ac.id) ?? []), neg.id]);
        if (!genericNarrativeOqRaised) {
          genericNarrativeOqRaised = true;
          c.oq(
            "test_scenario",
            "Expected behavior for generic failure paths is not specified — confirm refusal / rollback semantics with QA and the accountable PO.",
          );
        }
      }

      // 3) BUDGET / BOUNDARY — model-driven (the promotion).
      //
      //    v1 checked `ac.fields?.budget` (which itself came from a numeric-budget
      //    AC emitted in definePhase). We add a second path: if any budgeted
      //    requirement maps to this AC's source ref, emit a boundary test using
      //    the TYPED budget from the model (not just whatever surfaced on the
      //    ac.fields.budget string). This is additive — we keep both paths.

      const acBudget = ac.fields?.budget as string | undefined;
      if (acBudget) {
        // v1-identical path: the AC itself carries a budget field.
        const edge = c.el(
          "test_scenario",
          `Boundary test at ${acBudget}: verify behavior at, and just beyond, the stated budget.${citation}`,
          [ac.id, story.id],
          { fields: { type: "edge", ac: ac.id, story: story.id } },
        );
        coverage.set(ac.id, [...(coverage.get(ac.id) ?? []), edge.id]);
      } else {
        // Model-driven path: a budgeted requirement with this sourceRef may not
        // have produced an AC.fields.budget (e.g. the AC came from a goal, while
        // the budget sits in a constraint with the same ref). Surface it here.
        for (const ref of acSourceRefs) {
          const budgetRaw = budgetByRef.get(ref);
          if (budgetRaw) {
            const budgetEntityIds = entitiesForRef(ref);
            const budgetCitation = entityCitation([...new Set([...acEntityIds, ...budgetEntityIds])]);
            const edge = c.el(
              "test_scenario",
              `Boundary test (from typed requirement at ${ref}) at ${budgetRaw}: verify behavior at, and just beyond, the stated budget.${budgetCitation}`,
              [ac.id, story.id, ref],
              { fields: { type: "edge", ac: ac.id, story: story.id } },
            );
            coverage.set(ac.id, [...(coverage.get(ac.id) ?? []), edge.id]);
          }
        }
      }
    }
  }

  // ── Coverage map — honest blocking flag when an AC is uncovered ─────────────
  // KEPT IDENTICAL to v1 discipline: every AC must be covered; gap = blocking OQ.
  const lines: string[] = [];
  for (const ac of defineAcs) {
    const sc = coverage.get(ac.id) ?? [];
    lines.push(`${ac.id} → ${sc.length ? sc.join(", ") : "UNCOVERED"}`);
    if (!sc.length) {
      c.oq(
        "coverage",
        `Acceptance criterion ${ac.id} has no test scenario — close the gap before sign-off.`,
        true, // BLOCKING — same as v1
      );
    }
  }
  c.el(
    "coverage_map",
    lines.length ? lines.join("\n") : "No acceptance criteria to cover.",
    defineAcs.map((a) => a.id),
    { title: "AC → scenario coverage" },
  );

  // ── Scaffolds — Playwright + Gherkin, verbatim from scenarios ───────────────
  // KEPT IDENTICAL to v1: assembled from the scenario bodies, no invention.
  const scenarios = c.els.filter((e) => e.kind === "test_scenario");

  const pw: string[] = [`test.describe(${JSON.stringify(intent.title)}, () => {`];
  for (const s of scenarios) {
    const name = stripPeriod(s.body).replace(/\s+/g, " ").slice(0, 80);
    pw.push(`  test(${JSON.stringify(name)}, async ({ page }) => {`);
    pw.push("    // arrange / act / assert per the scenario — see its sourceRefs");
    pw.push("  });");
  }
  pw.push("});");
  c.el("scaffold", pw.join("\n"), scenarios.map((s) => s.id), {
    title: "Playwright skeleton",
    fields: { language: "ts", framework: "playwright" },
  });

  const gherkin: string[] = [`Feature: ${intent.title}`];
  for (const ac of defineAcs) {
    const f = ac.fields ?? {};
    gherkin.push("");
    gherkin.push(`  Scenario: ${stripPeriod(String(f.then ?? ac.id)).slice(0, 80)}`);
    gherkin.push(`    Given ${f.given ?? "the documented setup"}`);
    gherkin.push(`    When ${f.when ?? "the flow executes"}`);
    gherkin.push(`    Then ${f.then ?? "the criterion holds"}`);
  }
  c.el("scaffold", gherkin.join("\n"), defineAcs.map((a) => a.id), {
    title: "Gherkin feature (Cucumber)",
    fields: { language: "gherkin", framework: "cucumber" },
  });

  return c.done();
}
