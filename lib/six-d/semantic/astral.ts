// 6D Semantic Layer — ASTRAL schema-mapping (PORTED), pointed at requirements.
//
// HONEST PRECISION FIRST: the live ASTRAL engine
// (~/projects/COSMIC/suite/COSMIC-ENGINE-SUITE/engines/ASTRAL) is NOT a generic
// "semantic engine." It is a domain-specific infrastructure/right-of-way asset
// scorer (corridors, pipelines, rail, a Transfer-Readiness-Index, a segment state
// machine). The 6D-COSMIC memo calls ASTRAL "the core-8 semantic/schema engine";
// the *code* says ASTRAL's reusable, domain-agnostic kernel is its **schema
// mapper** (src/mappers.ts + src/normalization.ts): map arbitrary source fields
// onto a canonical schema, with per-mapping confidence, and track what could not
// be mapped. THAT pattern is what generalizes to requirement typing, so THAT is
// what is ported here. (Reported up-front because we don't bullshit our own docs.)
//
// PORTED, not imported, from ASTRAL src/mappers.ts + src/normalization.ts.
// Why it can't be imported as-is: ASTRAL's `normalize()` calls
// `new Date().toISOString()` (a clock — forbidden on our deterministic path) and
// depends on `@cosmic/chronos` (`stampOutput`), an external workspace package not
// present here. So the reusable kernel is ported and the clock is removed.
// What was ported 1:1:
//   • `mapRecord` → `classifyClause`: walk fields against a schema map, record a
//     {sourceField, canonicalField, transform, confidence} report, collect the
//     leftovers as `unmapped`/`unresolved`.
//   • `setNestedField` → kept verbatim (dotted-path canonical fields).
//   • the confidence-per-mapping idea → kept; confidences are fixed constants
//     (deterministic), never sampled.
//
// Pure: no clock, no randomness, no network. Same clause in → same typing out.

// ── Canonical requirement schema ─────────────────────────────────────────────
// The "target schema" ASTRAL maps onto. For 6D the canonical record is a typed
// REQUIREMENT, not a land parcel: a modality (must/should), an EARS-style clause
// class, a polarity, and any measurable budget.

export type Modality = "mandatory" | "recommended" | "optional" | "unspecified";

/**
 * EARS clause classes (Easy Approach to Requirements Syntax, Mavin et al.,
 * IEEE RE'09) — the controlled-grammar pattern that makes prose deterministically
 * parseable. We classify each clause into the EARS family it matches.
 */
export type EarsClass =
  | "ubiquitous" // "The system shall X" — always-on property
  | "event" // "When <trigger>, the system shall X"
  | "state" // "While <state>, the system shall X"
  | "unwanted" // "If <condition>, then the system shall X" — error/guard
  | "optional" // "Where <feature>, the system shall X"
  | "constraint" // a bound/exclusion, not a behavior
  | "narrative"; // free prose that matches no EARS template (the residual gap)

export type Polarity = "affirm" | "exclude";

export type FieldMapping = {
  sourceField: string;
  canonicalField: string;
  transform: string;
  confidence: number; // fixed constant; deterministic, never sampled
};

export type RequirementTyping = {
  modality: Modality;
  ears: EarsClass;
  polarity: Polarity;
  /** Dotted canonical fields ASTRAL-style mapping populated. */
  canonical: Record<string, unknown>;
  /** The {source→canonical, confidence} report — ASTRAL's mapping_report. */
  mappingReport: FieldMapping[];
  /** Tokens/fragments that matched no schema rule — ASTRAL's unresolved_fields. */
  unresolved: string[];
};

// ── setNestedField — PORTED VERBATIM from ASTRAL src/mappers.ts ───────────────
export function setNestedField(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  if (parts.length === 1) {
    obj[parts[0]] = value;
  } else {
    const [first, ...rest] = parts;
    if (!obj[first] || typeof obj[first] !== "object") obj[first] = {};
    setNestedField(obj[first] as Record<string, unknown>, rest.join("."), value);
  }
}

// ── The schema map: clause-feature → canonical requirement field ─────────────
// ASTRAL's BUILT_IN_SCHEMAS, re-pointed. Each rule is {regex over the clause,
// canonical dotted field, transform name, fixed confidence}. Higher confidence =
// a more unambiguous surface marker. Order is the deterministic evaluation order.

type SchemaRule = {
  field: string; // probe name, for the report
  re: RegExp;
  canonical: string; // dotted canonical path
  transform: string;
  confidence: number;
  value?: (m: RegExpMatchArray, clause: string) => unknown;
};

const REQUIREMENT_SCHEMA: SchemaRule[] = [
  // Modality markers (EARS keyword "shall"/"must" are the strongest).
  { field: "modality.shall", re: /\bshall\b/i, canonical: "modality", transform: "ears_keyword", confidence: 0.98, value: () => "mandatory" },
  { field: "modality.must", re: /\bmust\b/i, canonical: "modality", transform: "modal_keyword", confidence: 0.95, value: () => "mandatory" },
  { field: "modality.required", re: /\brequire[sd]?\b/i, canonical: "modality", transform: "modal_keyword", confidence: 0.9, value: () => "mandatory" },
  { field: "modality.should", re: /\bshould\b/i, canonical: "modality", transform: "modal_keyword", confidence: 0.85, value: () => "recommended" },
  { field: "modality.may", re: /\bmay\b|\boptionally\b/i, canonical: "modality", transform: "modal_keyword", confidence: 0.8, value: () => "optional" },
  // EARS clause triggers. NOTE: only unambiguous trigger words. We deliberately do
  // NOT treat bare "on" as an event trigger — "on low-risk work" is a preposition,
  // not "When X happens". Matching it would mis-type a goal as event-driven. This
  // is exactly the kind of false-positive a keyword approach makes and a careful
  // grammar must refuse.
  { field: "ears.event", re: /(?:^|[,.]\s*)(?:when|upon)\b\s+\w/i, canonical: "ears", transform: "ears_trigger", confidence: 0.85, value: () => "event" },
  { field: "ears.state", re: /\bwhile\b\s+\w/i, canonical: "ears", transform: "ears_trigger", confidence: 0.85, value: () => "state" },
  { field: "ears.unwanted", re: /\bif\b[^.]*\bthen\b/i, canonical: "ears", transform: "ears_trigger", confidence: 0.85, value: () => "unwanted" },
  { field: "ears.optional", re: /\bwhere\b\s+\w/i, canonical: "ears", transform: "ears_trigger", confidence: 0.8, value: () => "optional" },
  // Polarity / exclusion.
  { field: "polarity.exclude", re: /^(?:no|not|never|without|do not|don'?t)\b|\bno change(?:s)?\b/i, canonical: "polarity", transform: "negation", confidence: 0.9, value: () => "exclude" },
  // Measurable budget (numbers with units) → canonical.budget.
  {
    field: "budget.numeric",
    re: /(\d+(?:\.\d+)?)\s*(ms|s|sec|secs|seconds|m|min|mins|minutes|h|hours|%|percent)\b/i,
    canonical: "budget",
    transform: "number_with_unit",
    confidence: 0.92,
    value: (m) => ({ value: Number(m[1]), unit: m[2].toLowerCase(), raw: m[0] }),
  },
  // Mandated mechanism ("must use X").
  {
    field: "mechanism.mandated",
    re: /\bmust\s+use\s+(?:the\s+)?(.+?)(?:\s+for\s+.+)?$/i,
    canonical: "mechanism",
    transform: "mandated_mechanism",
    confidence: 0.88,
    value: (m) => m[1].trim().replace(/[.!?]+$/, ""),
  },
];

/**
 * classifyClause — ASTRAL `mapRecord`, re-pointed at a requirement clause.
 * Walks every schema rule against the clause; records a confidence-stamped
 * mapping for each hit; reports the residual (content words that matched no rule)
 * as `unresolved`. Deterministic: same clause → same typing.
 */
export function classifyClause(clause: string): RequirementTyping {
  const canonical: Record<string, unknown> = {};
  const mappingReport: FieldMapping[] = [];
  const matchedSpans: string[] = [];

  for (const rule of REQUIREMENT_SCHEMA) {
    const m = clause.match(rule.re);
    if (!m) continue;
    const val = rule.value ? rule.value(m, clause) : m[0];
    // Highest-confidence write wins per canonical field (don't let a weak modal
    // overwrite a strong EARS "shall"); deterministic because order + confidence
    // are fixed.
    const existing = mappingReport.find((r) => r.canonicalField === rule.canonical);
    if (!existing || rule.confidence > existing.confidence) {
      setNestedField(canonical, rule.canonical, val);
      if (existing) {
        // replace the report entry too, keeping the report aligned with canonical
        mappingReport.splice(mappingReport.indexOf(existing), 1);
      }
      mappingReport.push({
        sourceField: rule.field,
        canonicalField: rule.canonical,
        transform: rule.transform,
        confidence: rule.confidence,
      });
    }
    if (m[0]) matchedSpans.push(m[0].toLowerCase());
  }

  // Defaults for fields no rule populated.
  const modality = (canonical.modality as Modality) ?? "unspecified";
  const polarity = (canonical.polarity as Polarity) ?? "affirm";
  // EARS class: explicit trigger if found, else constraint if it carries a
  // bound/exclusion, else narrative (the honest residual class).
  let ears = (canonical.ears as EarsClass) ?? null;
  if (!ears) {
    if (canonical.budget !== undefined || canonical.mechanism !== undefined || polarity === "exclude") {
      ears = "constraint";
    } else if (modality === "mandatory" || modality === "recommended") {
      ears = "ubiquitous"; // "X must Y" with no trigger == an always-on property
    } else {
      ears = "narrative"; // matched no controlled-grammar template
    }
  }

  // unresolved: content tokens not covered by any matched span — ASTRAL's
  // unmapped/unresolved list. This is the visible measure of how much of the
  // clause the deterministic schema actually "understood."
  const unresolved = residualTokens(clause, matchedSpans);

  return { modality, ears, polarity, canonical, mappingReport, unresolved };
}

// Content tokens (len ≥ 4, not stopwords, not inside a matched span) left over.
const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "must", "shall",
  "should", "will", "have", "been", "they", "them", "then", "when", "while",
  "where", "which", "whose", "before", "after", "every", "each", "any", "all",
  "are", "was", "were", "has", "had", "its", "their", "your", "our",
]);

function residualTokens(clause: string, matchedSpans: string[]): string[] {
  const lc = clause.toLowerCase();
  // Blank out matched spans so their words don't count as residual.
  let masked = lc;
  for (const span of matchedSpans) {
    const idx = masked.indexOf(span);
    if (idx >= 0) masked = masked.slice(0, idx) + " ".repeat(span.length) + masked.slice(idx + span.length);
  }
  const toks = masked.replace(/[^a-z0-9\s]+/g, " ").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of toks) {
    if (t.length < 4 || STOP.has(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
