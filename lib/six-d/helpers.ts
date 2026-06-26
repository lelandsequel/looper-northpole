// 6D Workbench — deterministic parsing + canonicalization helpers.
//
// Everything here is a pure function. No randomness, no clock, no network.
// Text helpers (cap/period/tidy) follow the conventions of lib/cadmus.ts —
// the CADMUS Engine — which this workbench extends.

export const cap = (s: string): string => {
  const t = s.trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
};

export const period = (s: string): string => {
  const t = s.trim();
  return t && !/[.!?:]$/.test(t) ? t + "." : t;
};

export const tidy = (s: string): string => period(cap(s));

export const stripPeriod = (s: string): string => s.trim().replace(/[.!?]+$/, "");

export const lower1 = (s: string): string => {
  const t = s.trim();
  return t ? t[0].toLowerCase() + t.slice(1) : "";
};

/** Strip adapter/goal boilerplate so stories read like tickets, not pipeline echoes. */
const GOAL_PREFIX_RES: RegExp[] = [
  /^deliver the stated outcome:\s*/i,
  /^capture the revenue impact:\s*/i,
  /^improve the service outcome:\s*/i,
  /^deliver the internal capability:\s*/i,
  /^reduce the risk \/ meet the mandate:\s*/i,
  /^unlock the strategic option:\s*/i,
  /^deliver:\s*/i,
  /^reach\s+/i,
  /^serve\s+/i,
  /^(revenue|customer service|delivery|risk|strategic optionality) focus\.?\s*/i,
];

export const goalNeedPhrase = (text: string): string => {
  const original = stripPeriod(String(text ?? "").trim());
  let t = original;
  for (const re of GOAL_PREFIX_RES) {
    t = t.replace(re, "");
  }
  t = t.trim();
  if (t) return lower1(t);
  if (/focus$/i.test(original)) {
    return lower1(original.replace(/\bfocus$/i, "capabilities"));
  }
  return lower1(original) || "the stated capability";
};

const GOAL_HAS_VERB =
  /\b(build|launch|enable|deliver|implement|create|sign|onboard|validate|scale|meet|confirm|preserve)\b/i;

/** Ticket-style story title — imperative when the goal is a bare noun phrase. */
export const storyTitleFromGoal = (text: string): string => {
  const need = goalNeedPhrase(text);
  if (GOAL_HAS_VERB.test(need)) return tidy(stripPeriod(cap(need)));
  return tidy(stripPeriod(cap(`Launch ${need}`)));
};

/** "a" vs "an" for user-story actors. */
export const indefiniteArticle = (word: string): string => {
  const w = word.trim().toLowerCase();
  if (!w) return "a";
  if (/^(hour|honest)/.test(w)) return "an";
  return /^[aeiou]/.test(w) ? "an" : "a";
};

export const asActorPhrase = (actor: string): string => {
  const a = actor.trim().toLowerCase() || "user";
  return `As ${indefiniteArticle(a)} ${a}`;
};

/** "I want …" clause with correct infinitive when the need starts with a verb. */
export const userWantClause = (text: string): string => {
  const need = goalNeedPhrase(text);
  if (/^(validate|scale|meet|deliver|confirm|preserve)\b/i.test(need)) {
    return `I want to ${need}`;
  }
  if (GOAL_HAS_VERB.test(need)) return `I want to ${need}`;
  return `I want to launch ${need}`;
};

/** Acceptance text for adapter-shaped goals (deterministic, no invention). */
export const acceptanceForGoal = (goalText: string, goalIndex: number, contextText: string): string => {
  const raw = String(goalText ?? "").trim();
  if (/^scale to /i.test(raw)) {
    const target = raw.replace(/^scale to /i, "");
    return tidy(`The solution supports ${target} within documented reach assumptions.`);
  }
  if (/validate revenue/i.test(raw)) {
    return "Revenue impact and margin guardrails are validated against sourced evidence before release.";
  }
  if (/validate customer service/i.test(raw)) {
    return "Customer service outcomes and SLAs are validated against pilot metrics before release.";
  }
  if (/internal capability/i.test(raw)) {
    return "The internal capability is delivered with an operational handoff documented for support.";
  }
  if (/regulatory and audit/i.test(raw)) {
    return "Regulatory and audit obligations are met with traceable controls before release.";
  }
  if (/strategic option/i.test(raw)) {
    return "Strategic option value is preserved without over-building beyond the stated scope.";
  }
  if (goalIndex === 0 && contextText) {
    const desc = sentences(contextText).filter((s) => s.length > 20 && !isNormative(s));
    if (desc.length) return tidy(desc[0]);
  }
  return tidy(stripPeriod(goalNeedPhrase(raw)));
};

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "feature";

/** Split prose into sentences. Deterministic; good enough for intent text. */
export const sentences = (text: string): string[] =>
  String(text ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

/** Split a textarea into clean lines (also accepts ; and bullet separators). */
export const splitLines = (s?: string): string[] =>
  String(s ?? "")
    .split(/\n|;|•|·/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Numbers with units, e.g. "under 2s", "p95 of 250ms", "99.9%". */
export type NumericMention = { value: number; unit: string; raw: string };
export const numbersWithUnits = (text: string): NumericMention[] => {
  const out: NumericMention[] = [];
  const re = /(\d+(?:\.\d+)?)\s*(ms|s|sec|secs|seconds|m|min|mins|minutes|h|hours|%|percent)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ value: Number(m[1]), unit: m[2].toLowerCase(), raw: m[0] });
  }
  return out;
};

// ── Keyword buckets ──────────────────────────────────────────────────────────
// Fixed, ordered phrase lists. Matching is lowercase substring (phrases keep
// their hyphens/spaces), so "step-up" and "screen reader" match as written.
// Order of BUCKET_ORDER is the deterministic output order everywhere.

export type Bucket =
  | "auth"
  | "audit"
  | "performance"
  | "accessibility"
  | "ui"
  | "risk"
  | "data";

export const BUCKET_ORDER: Bucket[] = [
  "risk",
  "auth",
  "audit",
  "performance",
  "accessibility",
  "ui",
  "data",
];

const BUCKET_PHRASES: Record<Bucket, string[]> = {
  risk: ["high-risk", "unauthorized", "fraud", "reversal", "irreversible"],
  auth: [
    "step-up",
    "re-auth",
    "reauth",
    "authentication",
    "identity provider",
    "idp",
    "sso",
    "login",
    "credential",
  ],
  audit: ["audit", "log", "trail", "record"],
  performance: ["latency", "speed", "fast", "performance", "p95", "slow"],
  accessibility: ["accessibility", "wcag", "aa", "a11y", "screen reader"],
  ui: ["ui", "screen", "dashboard", "console", "modal", "button", "page", "form"],
  data: ["export", "import", "data egress", "pii", "encryption"],
};

export const bucketsFor = (text: string): Bucket[] => {
  const t = ` ${String(text ?? "").toLowerCase()} `;
  const hit = (phrase: string): boolean => {
    // word-ish boundaries so "aa" doesn't match inside other words
    const re = new RegExp(`(^|[^a-z0-9])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`);
    return re.test(t);
  };
  return BUCKET_ORDER.filter((b) => BUCKET_PHRASES[b].some(hit));
};

// ── Actors ───────────────────────────────────────────────────────────────────

const ACTOR_TERMS = [
  "agent",
  "user",
  "customer",
  "operator",
  "admin",
  "analyst",
  "engineer",
  "member",
  "reviewer",
  "owner",
];

/** Actors mentioned in the text, singular, in order of first appearance. */
export const actorsIn = (text: string): string[] => {
  const t = String(text ?? "").toLowerCase();
  const found: Array<{ term: string; at: number }> = [];
  for (const term of ACTOR_TERMS) {
    const re = new RegExp(`\\b${term}s?\\b`);
    const m = re.exec(t);
    if (m) found.push({ term, at: m.index });
  }
  found.sort((a, b) => a.at - b.at || a.term.localeCompare(b.term));
  return found.map((f) => f.term);
};

/** Normative sentences ("must / should / require…") — honest AC sources. */
export const isNormative = (sentence: string): boolean =>
  /\b(must|should|shall|require[sd]?|needs? to|has to)\b/i.test(sentence);

/** Exclusion phrasings → out-of-scope sources. */
export const exclusionOf = (line: string): string | null => {
  const m =
    /^(?:no|not|never|without|do not|don'?t)\s+(?:change(?:s)?\s+to\s+)?(.+)$/i.exec(line.trim());
  if (m) return m[1].trim();
  const inner = /\bno\s+change(?:s)?\s+to\s+(.+)$/i.exec(line.trim());
  if (inner) return inner[1].trim();
  return null;
};

/** "must use X [for Y]" → X — dependency/assumption sources. */
export const mandatedMechanism = (line: string): string | null => {
  const m = /\bmust\s+use\s+(?:the\s+)?(.+?)(?:\s+for\s+.+)?$/i.exec(line.trim());
  return m ? m[1].trim() : null;
};

// ── Canonicalization + receipt ───────────────────────────────────────────────

/** Stable JSON: object keys sorted recursively; arrays keep construction order. */
export const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${parts.join(",")}}`;
};

/** SHA-256 hex via WebCrypto — available in modern browsers and Node ≥ 19. */
export const sha256Hex = async (s: string): Promise<string> => {
  const bytes = new TextEncoder().encode(s);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};
