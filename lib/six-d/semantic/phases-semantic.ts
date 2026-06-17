// 6D Semantic Layer — DEMONSTRATION: two phases consuming the semantic model.
//
// These are NOT wired into the live runSixD (v1 phases.ts is untouched). They
// exist to prove the IntentSemanticModel drops into the existing phase shape
// (PhaseCtx → PhaseArtifact) and produces STRICTLY RICHER artifacts than the
// keyword path — entities with provenance where v1 had bare strings, systems as
// first-class design dependencies where v1 had none, and requirement typing
// driving the elements.
//
// To keep v1 bit-for-bit identical, these take the model as an extra argument
// rather than changing PhaseCtx. A real Tier-2 promotion would thread the model
// through PhaseCtx; this shows the consuming code that promotion would use.
//
// Pure: no clock, no randomness, no network.

import { cap, lower1, stripPeriod, tidy } from "../helpers";
import type { ArtifactElement, OpenQuestion, PhaseArtifact, PhaseCtx, PhaseId } from "../types";
import { PHASE_META } from "../types";
import {
  actorsFrom,
  budgetedRequirements,
  narrativeRequirements,
  systemsFrom,
} from "./adapter";
import type { CanonicalEntity } from "./nebula";
import type { IntentSemanticModel } from "./model";

// Minimal collector mirroring phases.ts `C`, kept local to avoid importing a
// private class. Same stable-id-by-construction-order behavior.
class SC {
  els: ArtifactElement[] = [];
  oqs: OpenQuestion[] = [];
  private counts = new Map<string, number>();
  constructor(private phase: PhaseId) {}
  el(kind: string, body: string, sourceRefs: string[], extra?: { title?: string; fields?: Record<string, string | string[]> }): ArtifactElement {
    const n = (this.counts.get(kind) ?? 0) + 1;
    this.counts.set(kind, n);
    const e: ArtifactElement = { id: `${this.phase}.${kind}.${n}`, kind, body, sourceRefs };
    if (extra?.title) e.title = extra.title;
    if (extra?.fields) e.fields = extra.fields;
    this.els.push(e);
    return e;
  }
  oq(about: string, question: string, blocking = false): OpenQuestion {
    const q: OpenQuestion = { id: `${this.phase}.oq.${this.oqs.length + 1}`, phase: this.phase, about, question, blocking };
    this.oqs.push(q);
    return q;
  }
  done(): PhaseArtifact {
    const meta = PHASE_META.find((m) => m.phase === this.phase)!;
    return { ...meta, elements: this.els, openQuestions: this.oqs };
  }
}

const refsOf = (e: CanonicalEntity): string[] => (e.sourceRefs.length ? e.sourceRefs : ["intent.title"]);

// ═══════════ DEFINE (semantic) ═══════════
// vs v1 definePhase: v1 picks `actors[0]` — a bare lowercase string — for the user
// story. Here each story is grounded in a CANONICAL actor entity: it cites the
// entity's provenance refs, names the variants it reconciled, and carries the
// entity id so downstream phases share one identity. Requirement typing decides
// which goals become measurable acceptance criteria.

export function definePhaseSemantic(ctx: PhaseCtx, model: IntentSemanticModel): PhaseArtifact {
  const c = new SC("define");
  const { intent } = ctx;
  const actors = actorsFrom(model);
  const primary = actors[0];

  // Actor roster — a real upgrade: each actor is a reconciled entity, not a noun.
  for (const a of actors) {
    c.el(
      "actor",
      `${a.display} — reconciled from ${a.variants.length} surface mention(s): ${a.variants.map((v) => `"${v}"`).join(", ")}.`,
      refsOf(a),
      { title: a.display, fields: { entityId: a.id, variants: a.variants } },
    );
  }
  if (!actors.length) c.oq("actor", "No actor could be reconciled from the intent — name who uses this feature.", true);

  // User stories grounded in the canonical actor.
  const goals = ctx.index.filter((x) => x.kind === "goal");
  const actorName = primary ? lower1(primary.display) : "user";
  for (const g of goals) {
    c.el(
      "story",
      `As ${article(actorName)} ${actorName}, I need: ${lower1(stripPeriod(g.text))} — so that "${intent.title}" delivers its intended outcome.`,
      [g.id, "intent.title", ...(primary ? refsOf(primary) : [])],
      { title: cap(stripPeriod(g.text)), fields: primary ? { actorEntity: primary.id } : {} },
    );
  }

  // Measurable acceptance criteria come from BUDGETED requirements (typed), not a
  // substring scan: the model already isolated the {value,unit} budgets.
  for (const r of budgetedRequirements(model)) {
    const b = r.typing.canonical.budget as { raw: string };
    c.el(
      "acceptance_criterion",
      `Given the feature is active, when the affected flow completes, then it satisfies the stated budget (${b.raw}): ${tidy(r.text)}`,
      [r.sourceRef],
      { fields: { budget: b.raw, modality: r.typing.modality, ears: r.typing.ears } },
    );
  }

  // Honest gap: narrative requirements the model could NOT type are surfaced as
  // open questions rather than silently dropped or guessed.
  for (const r of narrativeRequirements(model)) {
    c.oq(
      "requirement",
      `Requirement "${stripPeriod(r.text)}" matched no controlled-grammar (EARS) template — confirm its testable obligation with the accountable PO. (Deterministic typing left it as narrative; see the semantic-layer frontier report.)`,
    );
  }

  return c.done();
}

// ═══════════ DESIGN (semantic) ═══════════
// vs v1 designPhase: v1's direction line interpolates `actors.join(", ")` strings
// and has NO concept of the systems the feature integrates with. Here the systems
// are canonical entities, each becoming an explicit design dependency ADR with
// provenance — the thing v1 structurally could not produce.

export function designPhaseSemantic(ctx: PhaseCtx, model: IntentSemanticModel): PhaseArtifact {
  const c = new SC("design");
  const { intent } = ctx;
  const actors = actorsFrom(model);
  const systems = systemsFrom(model);

  c.el(
    "design_direction",
    `Serve ${actors.length ? actors.map((a) => a.display).join(", ") : "the (unnamed) user"} for "${intent.title}". ` +
      (systems.length
        ? `Integrates with: ${systems.map((s) => s.display).join(", ")} — each a named dependency below.`
        : "No external system dependency was reconciled from the intent."),
    ["intent.title", ...actors.flatMap(refsOf), ...systems.flatMap(refsOf)],
    { title: "Design direction" },
  );

  // Every reconciled system becomes a dependency ADR — net-new vs v1.
  for (const s of systems) {
    c.el(
      "adr",
      `Context: the intent names "${s.display}" (reconciled from ${s.variants.map((v) => `"${v}"`).join(", ")}). Decision: treat ${s.display} as an integration dependency. Consequences: its availability, contract, and failure modes are design constraints. Status: Proposed (pilot).`,
      refsOf(s),
      { title: `Depend on ${s.display}`, fields: { entityId: s.id, status: "Proposed (pilot)" } },
    );
  }

  if (!systems.length) {
    c.oq("adr", "No integration dependency was reconciled — confirm whether this feature stands alone or touches an external system.");
  }

  return c.done();
}

const article = (w: string): string => (/^[aeiou]/i.test(w) ? "an" : "a");
