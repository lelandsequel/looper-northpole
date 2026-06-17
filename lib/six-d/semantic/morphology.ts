// 6D Semantic Layer — deterministic morphology + key normalization.
//
// The mention-normalization floor. Before two surface strings can be judged the
// same entity, they must be reduced to a stable comparison key. This is a pure,
// table-driven port of the *technique* used by two real systems:
//
//   • NEBULA/COALESCE `nameKey` (~/projects/nebula/engines/coalesce.mjs) —
//     lowercase, strip filler, collapse whitespace into a blocking key. PORTED &
//     ADAPTED: NEBULA strips *corporate* suffixes (Inc/LLC/Corp) because it
//     reconciles companies; we strip *grammatical* filler (articles, plural -s,
//     and role-qualifier adjectives) because we reconcile actors/systems named in
//     prose.
//   • Stanford's deterministic, entity-centric, precision-ranked coreference
//     sieve (Raghunathan/Lee et al., 2013) — "head matching" + "exact/relaxed
//     string match" as ranked passes. We borrow the *head-noun* idea: the last
//     content noun of a phrase ("servicing agents" → head "agent") is the
//     highest-precision merge key, exactly as the sieve uses head matching.
//
// Everything here is pure: no clock, no randomness, no network, no model.
// Same string in → same key out, forever.

/** Lowercase, drop punctuation, collapse whitespace. The universal pre-step. */
export const fold = (s: string): string =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// ── Singularization ──────────────────────────────────────────────────────────
// A small, deterministic, *closed* irregular table plus conservative regular
// rules. We deliberately keep this minimal and inspectable rather than pulling a
// stemmer: an over-eager stemmer ("servicing" → "servic") destroys the exact
// surface we need to bind provenance to. This is the honest floor, not magic.

const IRREGULAR_PLURALS: Record<string, string> = {
  people: "person",
  children: "child",
  men: "man",
  women: "woman",
  data: "datum", // domain-debatable, but stable; intent text rarely relies on it
  criteria: "criterion",
  analyses: "analysis",
  indices: "index",
  identities: "identity",
};

/** Reduce a single lowercase word to a singular form. Deterministic. */
export const singularize = (word: string): string => {
  const w = word.toLowerCase();
  if (IRREGULAR_PLURALS[w]) return IRREGULAR_PLURALS[w];
  // Keep short words and obvious non-plurals intact ("ss" words, "us" words).
  if (w.length <= 3) return w;
  if (/(ss|us|is)$/.test(w)) return w; // "access", "status", "analysis" handled above
  if (/ies$/.test(w)) return w.slice(0, -3) + "y"; // "policies" → "policy"
  if (/(ches|shes|xes|zes|ses)$/.test(w)) return w.slice(0, -2); // "boxes" → "box"
  if (/s$/.test(w) && !/(ous| news)$/.test(w)) return w.slice(0, -1); // "agents" → "agent"
  return w;
};

// ── Role/qualifier filler ────────────────────────────────────────────────────
// Qualifier adjectives that commonly decorate an actor/system noun in spec prose
// without changing *which* entity is meant. "servicing agent", "the agent",
// "support agents" all denote the same role-entity. This list is intentionally
// conservative and visible — it is the seam where determinism ends and judgment
// would begin (see model.ts frontier notes).

// Determiners/articles: stripped from the comparison key, but NOT folded into a
// captured surface variant (an "agent" variant reads cleaner than "the agent").
const ARTICLES = new Set([
  "the", "a", "an", "this", "that", "these", "those", "any", "all", "each", "every",
]);

// Descriptive qualifiers (adjectives/participles): stripped from the key AND
// absorbable into a captured surface phrase ("servicing agents" is a real variant
// worth keeping). The two sets together are the qualifier-filler set.
const DESCRIPTIVE_QUALIFIERS = new Set([
  "servicing", "support", "supporting", "service", "enterprise", "internal",
  "external", "existing", "new", "covered", "affected", "given", "stated",
  "high", "low", "risk", "high-risk", "low-risk", "primary", "secondary", "end",
]);

const QUALIFIER_FILLER = new Set([...ARTICLES, ...DESCRIPTIVE_QUALIFIERS]);

/**
 * Whether a single word may be absorbed LEFTWARD into an entity's surface phrase
 * during mention detection. True for descriptive qualifiers and any -ing/-ed
 * participle ("servicing", "automated"); false for bare articles (kept out of the
 * surface). Case-insensitive — a sentence-initial "Servicing" still qualifies.
 */
export const isAbsorbableQualifier = (word: string): boolean => {
  const w = word.toLowerCase();
  if (ARTICLES.has(w)) return false;
  if (DESCRIPTIVE_QUALIFIERS.has(w)) return true;
  return /(?:ing|ed)$/.test(w) && w.length >= 5; // participle adjective, conservatively
};

/**
 * The high-precision comparison key for a phrase: fold → singularize each token
 * → drop qualifier filler → join. "Servicing Agents" and "the agent" both fold
 * to the key "agent". This is the blocking key COALESCE/the-sieve compares on.
 */
export const lemmaKey = (phrase: string): string => {
  const toks = fold(phrase)
    .split(" ")
    .filter(Boolean)
    .map(singularize)
    .filter((t) => !QUALIFIER_FILLER.has(t));
  return toks.join(" ").trim();
};

/**
 * The head noun of a phrase: the last surviving content token of lemmaKey. The
 * sieve's head-match precision pass. "enterprise identity provider" → "provider".
 * Empty string if the phrase is all filler (e.g. "the existing").
 */
export const headNoun = (phrase: string): string => {
  const key = lemmaKey(phrase);
  if (!key) return "";
  const toks = key.split(" ");
  return toks[toks.length - 1];
};

/**
 * Title-case a folded key back into a presentable canonical display name.
 * Mirror of NEBULA/BEACON `canonName` titleCase, minus the corporate-suffix
 * fixups (irrelevant for actors/systems). Deterministic.
 */
export const titleCaseKey = (key: string): string =>
  key
    .split(" ")
    .filter(Boolean)
    .map((t) => (t.length ? t[0].toUpperCase() + t.slice(1) : t))
    .join(" ")
    .trim();
