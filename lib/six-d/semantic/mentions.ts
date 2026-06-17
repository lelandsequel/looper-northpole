// 6D Semantic Layer — the prose front-end (mention detection).
//
// THIS FILE IS THE FRONTIER. Everything else in this module is real, deterministic
// machinery (entity reconciliation via NEBULA, schema typing via ASTRAL). But all
// of that machinery needs *mentions* to operate on, and getting mentions out of
// free prose deterministically is the genuinely hard, unsolved part. We do NOT
// pretend to solve it. We do the strongest deterministic thing — a curated,
// inspectable lexicon plus conservative grammatical cues — and we count, honestly,
// what we could not confidently classify (see `unclassifiedHints`). That residual
// is where an LLM (or a human) would be required; naming it precisely is the point.
//
// Technique lineage (from the STEP-0 survey):
//   • spaCy-style noun-chunk / head-noun detection, done with a closed lexicon
//     instead of a trained tagger, so the run path stays keyless + deterministic.
//   • EARS controlled-grammar cues for action detection.
//
// Pure: no clock, no randomness, no network, no model.

import type { IntentRef } from "../types";
import { fold, headNoun, isAbsorbableQualifier, lemmaKey } from "./morphology";
import type { EntityRole, Mention } from "./nebula";

// ── Curated lexicons (the inspectable determinism seam) ──────────────────────
// These are the role anchors. Conservative on purpose. The set is *visible* so a
// reviewer can see exactly what the parser does and does not know — unlike a
// neural tagger whose decision boundary is opaque. Extending these is a
// human-in-the-loop act, which is the honest shape of the determinism tradeoff.

const ACTOR_NOUNS = new Set([
  "agent", "user", "customer", "operator", "admin", "administrator", "analyst",
  "engineer", "member", "reviewer", "owner", "approver", "auditor", "manager",
  "developer", "client", "staff", "employee", "supervisor", "requester",
]);

// System/mechanism nouns — things the feature integrates with or writes to.
const SYSTEM_NOUNS = new Set([
  "provider", "idp", "sso", "system", "service", "database", "api", "gateway",
  "console", "dashboard", "ledger", "log", "trail", "record", "store", "queue",
  "endpoint", "directory", "registry", "vault", "broker", "pipeline", "webhook",
]);

// Multi-word system phrases worth capturing as a unit (head still drives merge).
const SYSTEM_PHRASES: RegExp[] = [
  /\b((?:enterprise\s+)?identity\s+provider)\b/gi,
  /\b(audit\s+(?:trail|log))\b/gi,
  /\b(message\s+queue)\b/gi,
];

// Action verbs that denote a controlled behavior the spec governs. Lemma-ish.
const ACTION_VERBS = new Set([
  "authenticate", "reauthenticate", "authorize", "verify", "validate", "approve",
  "reject", "block", "commit", "reverse", "record", "log", "capture", "audit",
  "encrypt", "export", "import", "challenge", "deny", "revoke", "grant", "notify",
]);

// EARS triggers that introduce an action clause (survey: Mavin et al. RE'09).
const EARS_TRIGGER = /\b(when|upon|while|if|where)\b/i;

// ── Mention detection ─────────────────────────────────────────────────────────

const isWordChar = (c: string): boolean => /[a-z0-9]/i.test(c);

/** Find every whole-word occurrence of a lexicon term (singular or plural). */
function findLexiconMentions(
  text: string,
  ref: string,
  lexicon: Set<string>,
  role: EntityRole,
): Mention[] {
  const out: Mention[] = [];
  const lc = text.toLowerCase();
  for (const term of lexicon) {
    // word-boundary, optional trailing plural -s, captured at its offset
    const re = new RegExp(`(^|[^a-z0-9])(${term}s?)(?=$|[^a-z0-9])`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(lc)) !== null) {
      const at = m.index + m[1].length;
      // Pull the surrounding noun phrase (1 qualifier word to the left if present)
      // so "servicing agents" is captured as a phrase, not bare "agents". The
      // returned offset reflects the actual surface start (keeps at/surface aligned).
      const exp = expandLeftQualifier(text, at, m[2].length);
      out.push({ surface: exp.surface, sourceRef: ref, at: exp.at, role });
    }
  }
  return out;
}

/** Grab one preceding qualifier word (descriptive adjective/participle) if
 *  adjacent. Articles are NOT absorbed; descriptive qualifiers are, even when
 *  sentence-initial ("Servicing agents"). Returns the (possibly widened) surface
 *  AND its start offset, kept aligned. Deterministic + conservative. */
function expandLeftQualifier(text: string, at: number, len: number): { surface: string; at: number } {
  let start = at;
  const i = at - 1;
  if (i >= 0 && /[ \t]/.test(text[i])) {
    let j = i - 1;
    while (j >= 0 && (isWordChar(text[j]) || text[j] === "-")) j--;
    const word = text.slice(j + 1, i);
    if (word && /^[A-Za-z][A-Za-z-]*$/.test(word) && word.length <= 14 && isAbsorbableQualifier(word)) {
      start = j + 1;
    }
  }
  return { surface: text.slice(start, at + len), at: start };
}

function findPhraseMentions(text: string, ref: string, role: EntityRole): Mention[] {
  const out: Mention[] = [];
  for (const re of SYSTEM_PHRASES) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      out.push({ surface: m[1], sourceRef: ref, at: m.index, role });
    }
  }
  return out;
}

function findActionMentions(text: string, ref: string): Mention[] {
  const out: Mention[] = [];
  const lc = text.toLowerCase();
  for (const verb of ACTION_VERBS) {
    // match verb stem with common inflections: -, -s, -d, -ed, -ing
    const re = new RegExp(`(^|[^a-z0-9])(${verb}(?:s|d|ed|ing)?)(?=$|[^a-z0-9])`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(lc)) !== null) {
      const at = m.index + m[1].length;
      out.push({ surface: verb, sourceRef: ref, at, role: "action" });
    }
  }
  return out;
}

export type MentionScan = {
  mentions: Mention[];
  /**
   * The honest residual: noun-like tokens that look like they could name an
   * actor/system/action but matched no lexicon. These are NOT turned into
   * entities (that would be guessing). They are surfaced so the gap is visible
   * and measurable — this count is the determinism↔LLM frontier, quantified.
   */
  unclassifiedHints: Array<{ token: string; sourceRef: string; reason: string }>;
};

// Heuristic: a capitalized non-sentence-initial word, or an "-er/-or/-ant" agentive
// noun, that we did NOT catch is a *candidate* entity we can't confidently type.
const AGENTIVE_SUFFIX = /(?:er|or|ant|ent|ist)s?$/i;

// Words that carry an agentive-looking suffix but are NOT agent nouns
// (prepositions, conjunctions, common adjectives/adverbs). Excluded so the
// frontier reports real unknown entities, not grammar noise.
const NON_AGENTIVE_ER = new Set([
  "under", "after", "over", "order", "other", "either", "neither", "rather",
  "whether", "never", "ever", "however", "moreover", "further", "later",
  "earlier", "sooner", "longer", "larger", "smaller", "lower", "higher",
  "faster", "slower", "better", "greater", "current", "different", "present",
  "recent", "urgent", "silent", "consistent", "important", "relevant", "constant",
  "permanent", "apparent", "front",
]);

/** Scan one intent atom for mentions + unclassified hints. */
export function scanAtom(atom: IntentRef): MentionScan {
  const text = atom.text;
  const ref = atom.id === "intent.title" ? "intent.title" : atom.id;

  const mentions: Mention[] = [
    ...findPhraseMentions(text, ref, "system"),
    ...findLexiconMentions(text, ref, ACTOR_NOUNS, "actor"),
    ...findLexiconMentions(text, ref, SYSTEM_NOUNS, "system"),
    ...findActionMentions(text, ref),
  ];

  // Dedupe overlapping captures (e.g. "audit trail" phrase + bare "trail"): keep
  // the longest surface that covers an offset, per role. Deterministic.
  const deduped = dedupeOverlaps(mentions);

  // Residual hint detection. A token is "known" if it reduces to a captured
  // mention's key OR its head noun OR is itself a lexicon term — so "provider"
  // (head of "enterprise identity provider") is NOT spuriously flagged.
  const known = new Set<string>();
  for (const m of deduped) {
    const k = lemmaKey(m.surface);
    if (k) known.add(k);
    const h = headNoun(m.surface);
    if (h) known.add(h);
  }
  for (const term of ACTOR_NOUNS) known.add(term);
  for (const term of SYSTEM_NOUNS) known.add(term);

  const hints: MentionScan["unclassifiedHints"] = [];
  const words = text.split(/\s+/);
  const seen = new Set<string>();
  words.forEach((raw, idx) => {
    const w = raw.replace(/[^A-Za-z0-9-]/g, "");
    if (!w || w.length < 4) return;
    const key = lemmaKey(w);
    if (!key || known.has(key) || seen.has(key)) return;
    const lc = w.toLowerCase();
    // Agentive ONLY if the -er/-or/-ant noun isn't a known function/preposition
    // word ("under", "after", "order", "over"). Those carry the suffix but name
    // no actor — flagging them would be a false positive, the keyword failure mode.
    const looksAgentive =
      AGENTIVE_SUFFIX.test(lc) && !ACTION_VERBS.has(key) && !NON_AGENTIVE_ER.has(lc) && key.length >= 5;
    const looksProperNoun = idx > 0 && /^[A-Z][a-z]+/.test(w) && !/^[A-Z]+$/.test(w);
    if (looksAgentive || looksProperNoun) {
      seen.add(key);
      hints.push({
        token: w,
        sourceRef: ref,
        reason: looksProperNoun
          ? "capitalized mid-sentence noun not in any role lexicon — could be a named entity; deterministic parser cannot type it"
          : "agentive-suffix noun (-er/-or/-ant) not in the actor/system lexicon — likely names an entity the parser does not know",
      });
    }
  });

  return { mentions: deduped, unclassifiedHints: hints };
}

/** Across all atoms. Mentions keep their per-atom offsets + refs. */
export function scanIntent(index: IntentRef[]): MentionScan {
  const mentions: Mention[] = [];
  const unclassifiedHints: MentionScan["unclassifiedHints"] = [];
  for (const atom of index) {
    const s = scanAtom(atom);
    mentions.push(...s.mentions);
    unclassifiedHints.push(...s.unclassifiedHints);
  }
  return { mentions, unclassifiedHints };
}

/** Keep the longest mention covering each offset region, per role. */
function dedupeOverlaps(mentions: Mention[]): Mention[] {
  // Sort by ref, then offset, then longer-first so the longer surface is kept.
  const sorted = [...mentions].sort(
    (a, b) =>
      a.sourceRef.localeCompare(b.sourceRef) ||
      a.at - b.at ||
      b.surface.length - a.surface.length ||
      a.role.localeCompare(b.role),
  );
  const out: Mention[] = [];
  for (const m of sorted) {
    const end = m.at + m.surface.length;
    const covered = out.some(
      (k) =>
        k.sourceRef === m.sourceRef &&
        k.role === m.role &&
        k.at <= m.at &&
        k.at + k.surface.length >= end,
    );
    if (!covered) out.push(m);
  }
  // Restore a stable canonical order.
  return out.sort(
    (a, b) => a.sourceRef.localeCompare(b.sourceRef) || a.at - b.at || a.role.localeCompare(b.role),
  );
}

// Re-export for convenience.
export { fold, headNoun, lemmaKey };
