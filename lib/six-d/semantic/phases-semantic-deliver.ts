// 6D Semantic Layer — Deliver phase (semantic promotion).
//
// Promoted from v1 deliverPhase (phases.ts). Same element KINDS
// (release_notes, runbook_input, monitoring_question) and same honest
// open-questions (rollback owner, deploy window). The promotion:
//
//   v1 path (structural):
//     • runbook_inputs sourced by scanning raw constraint text with
//       `mandatedMechanism` and `numbersWithUnits` (keyword patterns).
//     • monitoring_questions sourced by `bucketsFor` bucket matches
//       ("auth", "audit", budget numbers) on raw text.
//
//   semantic path (this file):
//     • ONE runbook_input PER reconciled SYSTEM entity from the model —
//       "verify <System> is configured + reachable", citing its entity id.
//     • ONE monitoring_question PER budgeted requirement from the model —
//       "how is <budget> observed in prod (p95)?", typed by ASTRAL.
//     Both cite reconciled entity ids and/or sourceRefs — provenance is
//     first-class, not incidental.
//
// Keeps the deterministic structure (SC collector, stable ids) and surfaces
// gaps as honest open-questions rather than invented content.
//
// Pure: no clock, no randomness, no network.

import type { ArtifactElement, OpenQuestion, PhaseArtifact, PhaseCtx } from "../types";
import { PHASE_META } from "../types";
import { budgetedRequirements, systemsFrom } from "./adapter";
import type { CanonicalEntity } from "./nebula";
import type { IntentSemanticModel } from "./model";

// ── Minimal collector (mirrors phases.ts `C` and phases-semantic.ts `SC`) ────

class SC {
  els: ArtifactElement[] = [];
  oqs: OpenQuestion[] = [];
  private counts = new Map<string, number>();
  constructor(private phase: "deliver") {}

  el(
    kind: string,
    body: string,
    sourceRefs: string[],
    extra?: { title?: string; fields?: Record<string, string | string[]> },
  ): ArtifactElement {
    const n = (this.counts.get(kind) ?? 0) + 1;
    this.counts.set(kind, n);
    const e: ArtifactElement = {
      id: `${this.phase}.${kind}.${n}`,
      kind,
      body,
      sourceRefs,
    };
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

const refsOf = (e: CanonicalEntity): string[] =>
  e.sourceRefs.length ? e.sourceRefs : ["intent.title"];

const phaseEls = (ctx: PhaseCtx, phase: "distribute", kind?: string): ArtifactElement[] => {
  const art = ctx.upstream.find((a) => a.phase === phase);
  if (!art) return [];
  return kind ? art.elements.filter((e) => e.kind === kind) : art.elements;
};

// ═══════════════════════ 6 · DELIVER (semantic) ══════════════════════════════
//
// vs v1 deliverPhase:
//   runbook_inputs — v1 scans constraint text with `mandatedMechanism` (regex)
//     and `numbersWithUnits` (regex) per raw atom. HERE each reconciled SYSTEM
//     entity (deduped, provenance-stamped) becomes one runbook_input, citing
//     the entity id; budget runbook_inputs come from typed requirements, not
//     a raw-text scan.
//   monitoring_questions — v1 scans buckets ("auth", "audit") and raw numbers.
//     HERE each BUDGETED requirement from the semantic model (ASTRAL-typed,
//     {value,unit} isolated) produces one monitoring_question citing the typed
//     budget and the source atom. Net: questions are grounded in the model, not
//     in keyword guesses.
//   release_notes and both open-questions are kept verbatim from v1.

export function deliverPhaseSemantic(
  ctx: PhaseCtx,
  model: IntentSemanticModel,
): PhaseArtifact {
  const c = new SC("deliver");
  const { intent } = ctx;

  const stories = phaseEls(ctx, "distribute", "story");
  const systems = systemsFrom(model);
  const budgeted = budgetedRequirements(model);

  // ── Release notes — same as v1: from the stories, verbatim ─────────────────
  c.el(
    "release_notes",
    [
      `${intent.title} — pilot release`,
      "",
      ...stories.map((s) => `- ${s.title ?? s.id}`),
    ].join("\n"),
    ["intent.title", ...stories.map((s) => s.id)],
    { title: "Release notes (draft)" },
  );

  // ── Runbook inputs — PROMOTED: one per reconciled SYSTEM entity ─────────────
  // v1 iterated over raw constraint atoms and called mandatedMechanism(text)
  // (a regex) to find mechanisms. The semantic model has already reconciled
  // variant mentions into canonical System entities with stable ids and
  // provenance. We generate one explicit pre-flight check per system, citing
  // the entity id so the runbook entry is traceable to its source atom(s).
  for (const sys of systems) {
    c.el(
      "runbook_input",
      `Verify ${sys.display} is configured and reachable in the target environment before enabling.`,
      refsOf(sys),
      { fields: { entityId: sys.id, variants: sys.variants } },
    );
  }

  // Budget validation runbook entries — PROMOTED: from typed budgets, not
  // a raw `numbersWithUnits` scan. Each budgeted requirement carries a
  // canonical {value, unit, raw} budget the ASTRAL classifier isolated.
  for (const req of budgeted) {
    const budget = req.typing.canonical.budget as { raw: string };
    c.el(
      "runbook_input",
      `Validate the stated budget (${budget.raw}) in pre-prod before rollout. (ASTRAL modality: ${req.typing.modality}; EARS: ${req.typing.ears}.)`,
      [req.sourceRef],
      { fields: { budget: budget.raw, modality: req.typing.modality, ears: req.typing.ears } },
    );
  }

  // If neither systems nor budgets could be resolved, surface the gap honestly.
  if (!systems.length && !budgeted.length) {
    c.oq(
      "runbook_input",
      "No integration system or measurable budget was reconciled from the intent — runbook pre-flight steps cannot be derived; enumerate them with the accountable SRE before deploy.",
    );
  }

  // Rollback owner — honest open-question kept verbatim from v1 (not
  // derivable from the intent regardless of semantic depth).
  c.oq(
    "runbook_input",
    "Rollback owner and procedure are not derivable from the intent — assign both before deploy.",
  );

  // ── Monitoring questions — PROMOTED: one per budgeted requirement ───────────
  // v1 emitted these by matching bucket tags ("auth", "audit") and scanning raw
  // constraint text for numbers. The semantic model types each requirement with
  // an ASTRAL budget, so the question is grounded in the actual typed value and
  // names the source atom, making it traceable without reading raw text.
  for (const req of budgeted) {
    const budget = req.typing.canonical.budget as { raw: string };
    c.el(
      "monitoring_question",
      `How is the stated budget (${budget.raw}) observed in production (p95)? (Requirement "${req.text}" — EARS: ${req.typing.ears}.)`,
      [req.sourceRef],
      { fields: { budget: budget.raw, reqId: req.id, ears: req.typing.ears } },
    );
  }

  // If there are systems but no budgeted requirements, surface a gap: we can
  // name the systems that need monitoring but lack typed thresholds to ground
  // the questions in.
  if (systems.length && !budgeted.length) {
    c.oq(
      "monitoring_question",
      `${systems.length} integration system(s) reconciled (${systems.map((s) => s.display).join(", ")}) but no measurable budget was found — define observable thresholds with the accountable SRE.`,
    );
  }

  // Deployment window — honest open-question kept verbatim from v1.
  c.oq("deliver", "Deployment window and accountable SRE owner unconfirmed.");

  return c.done();
}
