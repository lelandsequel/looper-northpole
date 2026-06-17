// Agility — typed entry point for the VENDORED engine.
//
// One import surface for the loop. The engine + seed are plain `.mjs` (copied
// verbatim from ~/projects/hl-prioritization-os — see ./README.md); tsconfig's
// `include` doesn't cover `**/*.mjs`, so those imports arrive untyped. This
// barrel binds them to the strict shapes in ./types.ts and re-exports them, so
// adapter/page/tests get full types without touching the vendored runtime.
//
// The full Agility pipeline in one call:
//   intake → dedup → score (RICE × 3-yr NPV) → mandate carve-out → tier
//   → allocate → ledger → portfolio. Deterministic: same inputs + same dials ⇒
//   byte-identical ranking (node:crypto ledger is server-side only).
// 🐦‍⬛ + 🔑

import { prioritize as prioritizeRaw } from "./engine.mjs";
import { INITIATIVES as INITIATIVES_RAW } from "./seed/initiatives.mjs";

import type {
  Initiative,
  PrioritizeOpts,
  PrioritizeResult,
} from "./types";

/** The full prioritization pipeline (typed wrapper over the vendored `.mjs`). */
export const prioritize: (
  initiatives: Initiative[],
  opts?: PrioritizeOpts,
) => PrioritizeResult = prioritizeRaw as unknown as (
  initiatives: Initiative[],
  opts?: PrioritizeOpts,
) => PrioritizeResult;

/** The 13 synthetic seed initiatives (demo data). */
export const INITIATIVES: Initiative[] = INITIATIVES_RAW as unknown as Initiative[];

export type {
  Initiative,
  Reach,
  Funding,
  PrioritizeResult,
  PrioritizeStats,
  PrioritizeOpts,
} from "./types";
