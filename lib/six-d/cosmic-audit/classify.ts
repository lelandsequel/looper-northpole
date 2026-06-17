// 6D → COSMIC · Tier 3 — artifact classifier.
//
// Pure, deterministic. Given a code-shaped 6D artifact, decide whether VANTAGE
// could find anything meaningful in it. The signals mirror what VANTAGE really
// inspects (METEOR extracts function bodies; PULSAR pattern-matches await /
// JSON.parse / force-unwrap / branching) so the verdict is grounded in the same
// evidence the real engine would use — not a guess.

import type {
  Auditability,
  ClassifiedArtifact,
  CodeShapedKind,
} from "./types";
import { CODE_SHAPED_KINDS } from "./types";
import type { ArtifactElement, RunManifest } from "../types";

/**
 * Count executable function *bodies* the way METEOR does: a function-ish
 * declaration that opens a brace and contains at least one non-comment,
 * non-blank statement line before it closes. Type aliases (`type X = {…}`) and
 * comment-only test skeletons deliberately do NOT count — that is the whole
 * point of the classification.
 */
export function countExecutableFunctions(src: string): number {
  const lines = src.split("\n");
  const declRe =
    /(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|^\s*\w[\w$]*\s*\([^)]*\)\s*(?::[^=]+)?\s*(?:=>)?\s*\{/;
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!declRe.test(lines[i])) continue;
    if (!lines[i].includes("{") && !/=>\s*$/.test(lines[i])) continue;
    // Scan the body for a real statement before the matching close brace.
    let depth = 0;
    let started = false;
    let hasStatement = false;
    for (let j = i; j < lines.length && j < i + 200; j++) {
      const raw = lines[j];
      for (const ch of raw) {
        if (ch === "{") {
          depth++;
          started = true;
        } else if (ch === "}") {
          depth--;
        }
      }
      if (j > i || started) {
        const body = raw.trim();
        const isComment =
          body.startsWith("//") || body.startsWith("*") || body.startsWith("/*");
        const isStructural =
          body === "" || body === "{" || body === "}" || /^\}[);,]?$/.test(body);
        // A line that is a brace-opening declaration shell only is not a statement.
        const isDeclShell = j === i;
        if (!isComment && !isStructural && !isDeclShell && body.length > 0) {
          hasStatement = true;
        }
      }
      if (started && depth <= 0) break;
    }
    if (hasStatement) count++;
  }
  return count;
}

/** Cheap structural signals — the evidence record behind a classification. */
export function signalsFor(src: string): ClassifiedArtifact["signals"] {
  const noComments = src
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");
  const branchMatches = noComments.match(
    /\bif\b|\bfor\b|\bwhile\b|\bswitch\b|\bcase\b|&&|\|\||\?[^.]/g,
  );
  return {
    bytes: src.length,
    extractedFunctions: countExecutableFunctions(src),
    hasAwait: /\bawait\b/.test(noComments),
    hasThen: /\.then\s*\(/.test(noComments),
    hasJsonParse: noComments.includes("JSON.parse("),
    hasForceUnwrap: /\w+!\.\w+|\w+!\s*[,)\]\s]/.test(noComments),
    branchingKeywords: branchMatches ? branchMatches.length : 0,
  };
}

/** The Gherkin / non-code grammars VANTAGE's scanner skips entirely. */
function isUnsupportedGrammar(kind: CodeShapedKind, language?: string): boolean {
  if (language && /gherkin|cucumber|feature/i.test(language)) return true;
  return false;
}

const REASONS: Record<Auditability, string> = {
  prose_prompt:
    "A CADMUS dev prompt — natural-language instructions for an engineer/LLM. VANTAGE extracts zero functions from prose; nothing to taint-check.",
  type_stub_only:
    "Type/interface declarations only — no executable function bodies for VANTAGE's adversarial pass (async/await, JSON.parse, unwrap, branching) to bite on.",
  skeleton_only:
    "A test skeleton whose bodies are placeholder comments (no await, no real logic). PULSAR has nothing to stress-test, and ECLIPSE would never rank it high enough to reach PULSAR.",
  unsupported_grammar:
    "Gherkin/feature grammar — not a language VANTAGE's scanner recognises; it is skipped before any engine runs.",
  runnable_code:
    "Contains runnable code with executable bodies — worth routing to VANTAGE for a real adversarial audit.",
};

const EXT: Record<CodeShapedKind, (lang?: string) => string> = {
  dev_prompt: () => ".md", // prose
  contract: (lang) => (lang === "ts" ? ".ts" : ".txt"),
  scaffold: (lang) =>
    lang === "gherkin" ? ".feature" : lang === "ts" ? ".spec.ts" : ".txt",
};

/** Classify a single code-shaped element. Deterministic. */
export function classifyElement(el: ArtifactElement): ClassifiedArtifact {
  const kind = el.kind as CodeShapedKind;
  const language = el.fields?.language as string | undefined;
  const signals = signalsFor(el.body);

  // An artifact is worth routing to VANTAGE only if its adversarial pass
  // (PULSAR) could actually fire on it. PULSAR keys on *risk-bearing
  // constructs* — unhandled async/await, `.then()`, `JSON.parse`, force-unwrap
  // — NOT on the mere presence of function shells or branch keywords (those
  // only feed ECLIPSE's complexity score). So a comment-only Playwright
  // skeleton (function shells, zero await) is correctly NOT auditable: VANTAGE
  // would find nothing. This keeps the classifier honest to what the real
  // engine does, not to what "looks like code".
  const hasRiskConstruct =
    signals.hasAwait ||
    signals.hasThen ||
    signals.hasJsonParse ||
    signals.hasForceUnwrap;

  let auditability: Auditability;
  if (isUnsupportedGrammar(kind, language)) {
    auditability = "unsupported_grammar";
  } else if (signals.extractedFunctions > 0 && hasRiskConstruct) {
    // Real executable bodies AND something PULSAR can bite on → audit it.
    // (A dev prompt would only reach here if it carried a real fenced code
    // block with risk constructs — the steelman case; otherwise it's prose.)
    auditability = "runnable_code";
  } else if (kind === "dev_prompt") {
    auditability = "prose_prompt"; // prose by construction
  } else if (kind === "contract") {
    auditability = "type_stub_only"; // type declarations / no risk bodies
  } else {
    auditability = "skeleton_only"; // scaffold with placeholder bodies
  }

  return {
    elementId: el.id,
    kind,
    language,
    auditability,
    auditable: auditability === "runnable_code",
    signals,
    reason: REASONS[auditability],
    materializedAs: `${el.id.replace(/\./g, "_")}${EXT[kind](language)}`,
  };
}

/** Pull every code-shaped element out of a 6D manifest, in run order. */
export function codeShapedElements(manifest: RunManifest): ArtifactElement[] {
  const kinds = new Set<string>(CODE_SHAPED_KINDS);
  const out: ArtifactElement[] = [];
  for (const art of manifest.artifacts) {
    for (const el of art.elements) {
      if (kinds.has(el.kind)) out.push(el);
    }
  }
  return out;
}

/** Classify all code-shaped artifacts of a run. Deterministic. */
export function classifyManifest(manifest: RunManifest): ClassifiedArtifact[] {
  return codeShapedElements(manifest).map(classifyElement);
}
