// 6D Semantic Layer — the IntentSemanticModel assembler.
//
// Pulls the three deterministic stages together into ONE richer model that the
// 6D phases can consume instead of raw keyword buckets:
//
//   intent atoms
//     → mentions.scanIntent     (prose front-end: mentions + the honest residual)
//     → nebula.reconcile        (canonical, provenance-stamped entities + review)
//     → astral.classifyClause   (EARS/modality/budget typing per requirement)
//     → IntentSemanticModel     (+ a frontier report that names the LLM-only gap)
//
// vs the keyword version (helpers.ts): `actorsIn` returns a flat list of singular
// strings with no notion that "the agent" and "servicing agents" are ONE entity,
// no provenance, no id, no requirement typing, and no measure of what it missed.
// The semantic model carries all of that — and, crucially, reports where it stops.
//
// Pure: no clock, no randomness, no network, no model. Same intent → same model.

import { stableStringify } from "../helpers";
import type { FeatureIntent, IntentRef } from "../types";
import { classifyClause, type RequirementTyping } from "./astral";
import { scanIntent } from "./mentions";
import { reconcile, type CanonicalEntity, type ReviewItem } from "./nebula";

/** One requirement: a source clause + its ASTRAL typing + entity links. */
export type TypedRequirement = {
  id: string; // "req.1" — stable by construction order
  sourceRef: string; // intent atom it came from
  text: string; // the clause, verbatim
  typing: RequirementTyping; // modality / EARS class / polarity / budget …
  /** Ids of canonical entities this requirement names (resolved post-reconcile). */
  entityRefs: string[];
};

/**
 * The frontier report — the load-bearing honesty. Quantifies exactly how much of
 * the intent the deterministic layer actually resolved, and what it could not,
 * so the determinism↔LLM tradeoff is a number on the page, not a vibe.
 */
export type FrontierReport = {
  /** Requirements whose EARS class is "narrative" — matched no controlled
   * grammar; meaning is present in prose the deterministic parser cannot type. */
  narrativeRequirements: number;
  /** Distinct residual content tokens across all clauses (ASTRAL unresolved). */
  unresolvedTokens: string[];
  /** Noun-like mentions that looked like entities but matched no lexicon. */
  unclassifiedHints: Array<{ token: string; sourceRef: string; reason: string }>;
  /** Entity clusters the sieve refused to auto-merge (need a human call). */
  reviewQueue: ReviewItem[];
  /** A plain-language statement of precisely where an LLM would be required. */
  llmRequiredFor: string[];
};

export type IntentSemanticModel = {
  schema: "6d.semantic.v1";
  intentId: string;
  entities: CanonicalEntity[];
  requirements: TypedRequirement[];
  frontier: FrontierReport;
  /** Deterministic content fingerprint (sync FNV via stableStringify). */
  fingerprint: string;
};

// ── Requirement extraction ────────────────────────────────────────────────────
// Each goal and each constraint is one requirement clause. Context sentences that
// are normative (carry must/should/when/if) also become requirements; plain
// narrative context does not (it has no testable obligation — and pretending it
// does would be inventing one). This mirrors the v1 phases' honesty discipline.

const NORMATIVE = /\b(must|should|shall|require[sd]?|when|while|if|where|no|not|never|without)\b/i;

function extractRequirementClauses(intent: FeatureIntent, index: IntentRef[]): Array<{ ref: string; text: string }> {
  const out: Array<{ ref: string; text: string }> = [];
  for (const a of index) {
    if (a.kind === "goal" || a.kind === "constraint") {
      out.push({ ref: a.id, text: a.text });
    } else if (a.kind === "context" && NORMATIVE.test(a.text)) {
      out.push({ ref: a.id, text: a.text });
    }
  }
  return out;
}

// ── Assembler ────────────────────────────────────────────────────────────────

export function buildSemanticModel(intent: FeatureIntent, index: IntentRef[]): IntentSemanticModel {
  // 1) Prose front-end → mentions + honest residual.
  const scan = scanIntent(index);

  // 2) NEBULA → canonical entities + review queue.
  const { entities, review } = reconcile(scan.mentions);

  // Map each intent atom ref → the entity ids that were mentioned in it, so a
  // requirement can resolve which entities it names. (An entity's sourceRefs are
  // the atoms it appeared in.)
  const entitiesByRef = new Map<string, string[]>();
  for (const e of entities) {
    for (const ref of e.sourceRefs) {
      (entitiesByRef.get(ref) ?? entitiesByRef.set(ref, []).get(ref)!).push(e.id);
    }
  }

  // 3) ASTRAL → typed requirements.
  const clauses = extractRequirementClauses(intent, index);
  const requirements: TypedRequirement[] = clauses.map((cl, i) => {
    const typing = classifyClause(cl.text);
    const entityRefs = [...new Set(entitiesByRef.get(cl.ref) ?? [])].sort();
    return { id: `req.${i + 1}`, sourceRef: cl.ref, text: cl.text, typing, entityRefs };
  });

  // 4) Frontier report — quantify the gap.
  const narrativeRequirements = requirements.filter((r) => r.typing.ears === "narrative").length;
  const unresolvedTokens = [...new Set(requirements.flatMap((r) => r.typing.unresolved))].sort();

  const llmRequiredFor: string[] = [];
  if (scan.unclassifiedHints.length) {
    llmRequiredFor.push(
      `Typing ${scan.unclassifiedHints.length} out-of-lexicon noun mention(s) (e.g. "${scan.unclassifiedHints[0].token}") as actor/system/action — the deterministic parser only knows a curated lexicon; classifying a novel domain noun needs world knowledge.`,
    );
  }
  if (narrativeRequirements) {
    llmRequiredFor.push(
      `Extracting structured obligations from ${narrativeRequirements} free-narrative clause(s) that match no EARS template — deterministic grammar can type "shall/when/if" prose, not arbitrary sentences.`,
    );
  }
  if (review.length) {
    llmRequiredFor.push(
      `Adjudicating ${review.length} ambiguous entity merge(s) the sieve refused (partial-overlap, no shared head noun) — deciding e.g. whether two differently-named systems are the same one requires meaning the parser can't access.`,
    );
  }
  if (unresolvedTokens.length) {
    llmRequiredFor.push(
      `Interpreting ${unresolvedTokens.length} residual content token(s) the schema did not bind (e.g. "${unresolvedTokens[0]}") — they carry meaning the controlled grammar leaves on the floor.`,
    );
  }
  if (!llmRequiredFor.length) {
    llmRequiredFor.push("Nothing in THIS intent — it fell entirely inside the deterministic grammar + lexicon. (This is the best case, not the general case.)");
  }

  const frontier: FrontierReport = {
    narrativeRequirements,
    unresolvedTokens,
    unclassifiedHints: scan.unclassifiedHints,
    reviewQueue: review,
    llmRequiredFor,
  };

  const sansFingerprint = {
    schema: "6d.semantic.v1" as const,
    intentId: intent.id,
    entities,
    requirements,
    frontier,
  };
  const fingerprint = fnv1a(stableStringify(sansFingerprint));

  return { ...sansFingerprint, fingerprint };
}

// Pure synchronous fingerprint (same FNV-1a as nebula WAKE, kept local to avoid
// a cross-file private export). Deterministic.
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
