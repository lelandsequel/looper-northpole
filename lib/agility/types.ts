// Agility — shared TypeScript shapes for the VENDORED engine.
//
// The engine runtime lives in plain `.mjs` (copied verbatim from
// ~/projects/hl-prioritization-os — see ./README.md). These interfaces mirror
// the JSDoc typedef in ./types.mjs 1:1 so the loop adapter binds to a real,
// strict contract instead of `any`. Pure types — zero runtime, safe to import
// from anywhere (adapter, page, tests).
// 🐦‍⬛ + 🔑

/** Reach — customers / loans / engineers affected per year. */
export interface Reach {
  value: number;
  unit: string;
  source?: string;
}

export type Funding = "FUNDED" | "BENCHED" | "HELD_DUPLICATE";

/**
 * The merged Initiative (Bailey Appendix A × Agility). Mirrors ./types.mjs.
 * This is the INPUT side of the loop adapter (`initiativeToIntent`).
 */
export interface Initiative {
  id: string;
  title: string;
  description: string;
  area: string;
  sponsor: string;
  outcome: string;
  valueType: string;
  mandate?: boolean;
  mandateCitation?: string;
  businessImpact?: string;
  reach: Reach;

  // NPV inputs (all optional, default 0 in the engine).
  revenueImpact?: number;
  cogs?: number;
  costSaveAnnual?: number;
  savingsEffectiveDate?: string;
  costAvoid?: number;
  pAvoid?: number;
  riskReduction?: number;
  pRisk?: number;
  customerImpact?: number;
  ongoingTCO?: number;
  budgetCyclePosition?: string;

  // RICE / confidence inputs.
  deliveryConfidence: number;
  valueConfidence: number;
  effortTeamWeeks: number;
  talentProfile?: string;
  dependsOn?: string[];
  evidence?: Record<string, string>;
  state?: string;

  // Engine-attached fields, present after prioritize(). Underscore-prefixed.
  _funding?: Funding;
  _tier?: string;
  _rank?: number;
  _score?: number;
  _priorityRaw?: number;
  _teams?: number;
  _scoreReceipt?: string;
  _intakeReceipt?: string;
  _prioritizeReceipt?: string;
  _tierReceipt?: string;
  _breakdown?: unknown;
  _dedup?: unknown;
}

export interface PrioritizeStats {
  intake: number;
  rejected: number;
  funded: number;
  benched: number;
  held_duplicates: number;
  mandates: number;
  duplicate_clusters: number;
  duplicatesAvoided: number;
  fundedNpvTotal: number;
}

export interface PrioritizeResult {
  methodology_version: string;
  dials: Record<string, number>;
  capacity: number;
  capacityUsed: number;
  ledger: unknown;
  head: string | null;
  verify: unknown;
  ranked: Initiative[];
  tiers: Record<string, Initiative[]>;
  funded: Initiative[];
  benched: Initiative[];
  held: Initiative[];
  mandates: Initiative[];
  clusters: unknown[];
  flagged: string[];
  rejected: Array<{ id?: string; title?: string; reason?: string } & Record<string, unknown>>;
  portfolio: { fundedNpvTotal: number } & Record<string, unknown>;
  stats: PrioritizeStats;
}

export interface PrioritizeOpts {
  capacity?: number;
  dedupThreshold?: number;
  dials?: Record<string, number>;
  methodologyVersion?: string;
  horizonStart?: Date | string;
}
