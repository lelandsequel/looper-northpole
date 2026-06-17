// 6D → COSMIC · Tier 3 — generated-artifact audit · shared types.
//
// Tier 3's job: after a 6D run, take the *code-shaped* artifacts the engine
// emitted (dev prompts, interface contracts, test scaffolding) and audit them
// with VANTAGE — the code-taint / risk auditor at `bacchus-audit/vantage` — so
// unsafe patterns are caught *before* the artifacts are handed to an engineer.
//
// The load-bearing honesty (see ./FINDING.md and the design memo's Tier 3
// caveat): the current 6D artifacts are mostly PROMPTS + skeleton scaffolding,
// not runnable code. VANTAGE audits CODE. So this module first *classifies*
// each artifact's auditability and refuses to manufacture a clean pass out of
// material VANTAGE structurally cannot evaluate. REFUSE → RESOLVE: it names
// exactly what would make a real audit worthwhile (a phase that emits real
// runnable code), instead of shipping a hollow always-green gate.

import type { ArtifactElement, RunManifest } from "../types";

/** The artifact kinds Tier 3 considers "code-shaped" and worth routing at all. */
export const CODE_SHAPED_KINDS = ["dev_prompt", "contract", "scaffold"] as const;
export type CodeShapedKind = (typeof CODE_SHAPED_KINDS)[number];

/**
 * Why a given artifact is or is not meaningfully auditable by VANTAGE.
 * This is the heart of the refusal: we do not pretend prose or a type-stub is
 * "code VANTAGE approved." We classify it honestly.
 */
export type Auditability =
  // Prose (a CADMUS dev prompt). VANTAGE extracts zero functions from English.
  | "prose_prompt"
  // Type declarations / interface stub only — no executable bodies to taint-check.
  | "type_stub_only"
  // Test skeleton whose bodies are placeholders/comments — nothing to stress-test.
  | "skeleton_only"
  // A grammar VANTAGE's scanner does not recognise (e.g. Gherkin `.feature`).
  | "unsupported_grammar"
  // Genuinely contains runnable code with executable bodies — worth auditing.
  | "runnable_code";

/** One code-shaped artifact, classified, ready to (not) route to VANTAGE. */
export interface ClassifiedArtifact {
  elementId: string; // e.g. "develop.dev_prompt.1"
  kind: CodeShapedKind;
  language?: string; // from element.fields.language, when present
  auditability: Auditability;
  /** True only for `runnable_code`. */
  auditable: boolean;
  /** Cheap structural signals — the evidence behind the classification. */
  signals: {
    bytes: number;
    extractedFunctions: number; // executable function bodies detected
    hasAwait: boolean;
    hasThen: boolean;
    hasJsonParse: boolean;
    hasForceUnwrap: boolean;
    branchingKeywords: number; // if/for/while/switch/&&/||/?
  };
  /** Plain-English reason — what an engineer reads in the gate output. */
  reason: string;
  /** The temp filename this artifact would be materialised as for VANTAGE. */
  materializedAs: string;
}

/** A finding surfaced from a VANTAGE report, normalised to Tier 3's shape. */
export interface GeneratedArtifactFinding {
  elementId: string; // which 6D artifact it came from
  file: string; // materialised path VANTAGE reported
  line?: number;
  severity: "HIGH" | "MED" | "LOW";
  type: string; // e.g. "async-race", "error-boundary"
  description: string;
  testCase?: string;
}

/**
 * The Tier 3 verdict. Deterministic for a given manifest + VANTAGE runner.
 *
 * - NOT_WORTHWHILE — no artifact contains runnable code; routing to VANTAGE
 *   would always find nothing. This is the honest refusal, not a failure.
 * - NO_OBJECTION — runnable code was audited and VANTAGE raised nothing HIGH.
 * - HOLD — runnable code was audited and VANTAGE raised MED findings.
 * - REFUSE — runnable code was audited and VANTAGE raised HIGH findings;
 *   the artifacts must not be handed off until resolved.
 */
export type Tier3Verdict = "NOT_WORTHWHILE" | "NO_OBJECTION" | "HOLD" | "REFUSE";

export interface GeneratedArtifactAudit {
  schema: "6d.cosmic.tier3.audit.v1";
  /** Bound to the run it audited — Tier 3 never floats free of a manifest. */
  runReceipt: string;
  verdict: Tier3Verdict;
  /** True when VANTAGE actually ran (i.e. some artifact was runnable). */
  vantageInvoked: boolean;
  classified: ClassifiedArtifact[];
  findings: GeneratedArtifactFinding[];
  /** The REFUSE→RESOLVE message: exactly what would make Tier 3 valuable. */
  resolution: string;
  /** Human-readable one-liner summarising the verdict. */
  summary: string;
}

// ── VANTAGE runner contract (kept injectable so this module is deterministic) ─
//
// VANTAGE is a *separate runtime* (CommonJS / ts-node, Electron+Express deps,
// reads files from disk and shells out to git). It cannot live in the browser
// bundle. The honest integration is therefore SUBPROCESS to its CLI:
//   `vantage run <dir> --output <report.json>`  → parse the JSON report.
// We model only the slice of its report we consume, and inject the runner so
// callers (and tests) can supply the real subprocess one or a fake.

/** The slice of a VANTAGE report Tier 3 reads. Matches `vantage/src/types.ts`. */
export interface VantageReportSlice {
  pulsar: {
    adversarialFindings: Array<{
      file: string;
      line?: number;
      type: string;
      severity: "HIGH" | "MED" | "LOW";
      description: string;
      testCase?: string;
    }>;
  };
  aurora: {
    score: number;
    verdict: "APPROVED" | "REJECTED";
    topIssues: Array<{
      file: string;
      line?: number;
      severity: "HIGH" | "MED" | "LOW";
      description: string;
    }>;
  };
}

/** Runs VANTAGE against a directory of materialised artifacts. */
export type VantageRunner = (dir: string) => Promise<VantageReportSlice>;

export type { ArtifactElement, RunManifest };
