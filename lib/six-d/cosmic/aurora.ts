// 🌅 AURORA — the verdict gate (NO_OBJECTION / HOLD / REFUSE) + REFUSE→RESOLVE→RECOMPUTE.
//
// AURORA replaces 6D v1's toy `openQuestions[]` (a flagged gap, no verdict, no floor)
// with a real gate that issues a VERDICT per element and per artifact, and runs the
// refusal loop when something can't ship as fact.
//
// PORTED — not imported — from the canonical chamber AURORA implementations:
//   • Verdict vocabulary + gate shape: ~/projects/heimdall-airborne-cc/engine/heimdall.mjs
//     (`VERDICTS`, `evaluate`, the COSMIC-grounding check). That file is Node `.mjs`
//     with `new Date()` in its ledger and a 4th verdict (ABSTAIN) tied to KEYSTONE
//     proportionality, which 6D Tier 1 doesn't model — so the relevant core (the three
//     verdicts this task names + the "unsupported claim ⇒ REFUSE" rule) is ported and
//     adapted to 6D artifacts.
//   • Gate doctrine (decision matrix, reason strings): ~/projects/bacchusroe/services/
//     cosmic/aurora/main.py (SURFACE/MONITOR/EXCLUDE → mapped to the 6D verdict names
//     this task specifies: NO_OBJECTION/HOLD/REFUSE).
//
// Gate rules (deterministic — same inputs ⇒ same verdicts ⇒ same ledger):
//   1. element is VELLUM-UNBOUND                      → REFUSE  (can't ship as fact)
//   2. element is the subject of a BLOCKING gap       → REFUSE  (intent under-specified)
//   3. element is the subject of a NON-blocking gap   → HOLD    (true, needs confirmation)
//   4. otherwise                                      → NO_OBJECTION
//   • An artifact's verdict is the worst of its elements' verdicts, floored by its own
//     open questions (a blocking OQ on the phase ⇒ at least REFUSE; non-blocking ⇒ HOLD).
//
// REFUSE → RESOLVE → RECOMPUTE:
//   Each REFUSE/HOLD carries a `resolve` describing exactly what's required. A caller
//   supplies a Resolution (the missing fact / confirmation, with a source binding);
//   recompute() re-runs the gate treating resolved subjects as satisfied. No estimate,
//   no fabrication — an unresolved REFUSE stays REFUSED.
//
// 🐦‍⬛ + 🔑

import type { OpenQuestion, PhaseArtifact, PhaseId, RunManifest } from "../types";
import {
  bindProvenance,
  provenanceById,
  type ElementProvenance,
} from "./vellum";

export const VERDICTS = Object.freeze({
  NO_OBJECTION: "NO_OBJECTION", // grounded + bound — the gate raises no objection
  HOLD: "HOLD", // true/derivable, but needs an owner's confirmation before it ships
  REFUSE: "REFUSE", // cannot ship as fact — unbound, or the intent doesn't specify it
} as const);

export type Verdict = (typeof VERDICTS)[keyof typeof VERDICTS];

/** Severity order so we can take the worst verdict deterministically. */
const SEVERITY: Record<Verdict, number> = {
  NO_OBJECTION: 0,
  HOLD: 1,
  REFUSE: 2,
};
const worst = (a: Verdict, b: Verdict): Verdict => (SEVERITY[a] >= SEVERITY[b] ? a : b);

/** What a refusal/hold needs in order to clear. */
export type ResolveNeed = {
  /** Stable key a Resolution targets: `oq:<id>` for a gap, `unbound:<elementId>` for VELLUM. */
  key: string;
  kind: "open_question" | "unbound";
  about: string; // the element/field the need concerns
  required: string; // exactly what must be supplied (source it, never estimate)
  blocking: boolean;
};

export type ElementVerdict = {
  elementId: string;
  phase: PhaseId;
  verdict: Verdict;
  reason: string;
  /** Present on HOLD/REFUSE — what to resolve. */
  resolve?: ResolveNeed;
};

export type ArtifactVerdict = {
  phase: PhaseId;
  n: number;
  verdict: Verdict; // worst element verdict, floored by phase open questions
  reason: string;
  elements: ElementVerdict[];
  /** Phase-level needs derived from open questions not tied to a specific element. */
  resolves: ResolveNeed[];
};

export type GateReport = {
  schema: "6d.aurora.v1";
  artifacts: ArtifactVerdict[];
  /** Flat list of everything still needing resolution (REFUSE/HOLD). */
  outstanding: ResolveNeed[];
  /** Convenience rollup. */
  summary: { NO_OBJECTION: number; HOLD: number; REFUSE: number };
};

/**
 * A supplied resolution. `key` matches a ResolveNeed.key. To honor "never estimate",
 * a resolution that clears an UNBOUND element MUST carry a real source binding
 * (`sourceRef` that resolves in the manifest); otherwise it is rejected and the
 * REFUSE stands.
 */
export type Resolution = {
  key: string;
  /** The fact/answer being supplied (recorded for the ledger; not invented by AURORA). */
  answer: string;
  /** For UNBOUND resolutions: an existing source id to bind to. Required for `unbound`. */
  sourceRef?: string;
};

// ── Open-question → need mapping ──────────────────────────────────────────────

const oqNeed = (q: OpenQuestion): ResolveNeed => ({
  key: `oq:${q.id}`,
  kind: "open_question",
  about: q.about,
  required: q.question,
  blocking: q.blocking,
});

const unboundNeed = (p: ElementProvenance): ResolveNeed => ({
  key: `unbound:${p.elementId}`,
  kind: "unbound",
  about: p.elementId,
  required: `Bind ${p.elementId} to a real source (${p.reason ?? "no resolvable source"}). Source it — do not estimate.`,
  blocking: true,
});

// ── The gate ──────────────────────────────────────────────────────────────────

/**
 * Gate a single phase given its element provenance and the set of resolved keys.
 * Pure & deterministic.
 */
function gatePhase(
  art: PhaseArtifact,
  provById: Map<string, ElementProvenance>,
  resolvedKeys: Set<string>,
): ArtifactVerdict {
  // Index open questions by the element/field they are "about" so an OQ that names
  // an element id lands on that element; the rest become phase-level needs.
  const elementIds = new Set(art.elements.map((e) => e.id));
  const oqByElement = new Map<string, OpenQuestion>();
  const phaseLevel: OpenQuestion[] = [];
  for (const q of art.openQuestions) {
    if (elementIds.has(q.about)) oqByElement.set(q.about, q);
    else phaseLevel.push(q);
  }

  const elements: ElementVerdict[] = art.elements.map((e) => {
    const prov = provById.get(e.id);
    const unbound = prov?.status === "UNBOUND";
    const unboundKey = `unbound:${e.id}`;
    if (unbound && !resolvedKeys.has(unboundKey)) {
      const need = unboundNeed(prov!);
      return {
        elementId: e.id,
        phase: art.phase,
        verdict: VERDICTS.REFUSE,
        reason: `UNBOUND — ${prov!.reason}. Cannot ship as fact.`,
        resolve: need,
      };
    }
    const oq = oqByElement.get(e.id);
    if (oq && !resolvedKeys.has(`oq:${oq.id}`)) {
      const need = oqNeed(oq);
      return {
        elementId: e.id,
        phase: art.phase,
        verdict: oq.blocking ? VERDICTS.REFUSE : VERDICTS.HOLD,
        reason: oq.blocking
          ? `Blocking gap — ${oq.question}`
          : `Needs confirmation — ${oq.question}`,
        resolve: need,
      };
    }
    return {
      elementId: e.id,
      phase: art.phase,
      verdict: VERDICTS.NO_OBJECTION,
      reason: "Bound to source and fully specified; the gate raises no objection.",
    };
  });

  // Phase-level needs from open questions not tied to a specific element.
  const resolves: ResolveNeed[] = phaseLevel
    .filter((q) => !resolvedKeys.has(`oq:${q.id}`))
    .map(oqNeed);

  // Artifact verdict = worst element verdict, floored by unresolved phase OQs.
  let verdict: Verdict = elements.reduce<Verdict>(
    (acc, ev) => worst(acc, ev.verdict),
    VERDICTS.NO_OBJECTION,
  );
  for (const need of resolves) {
    verdict = worst(verdict, need.blocking ? VERDICTS.REFUSE : VERDICTS.HOLD);
  }

  const reason =
    verdict === VERDICTS.REFUSE
      ? "At least one element cannot ship as fact (unbound or a blocking gap)."
      : verdict === VERDICTS.HOLD
        ? "All elements are bound, but some need an accountable owner's confirmation."
        : "Every element is bound to source and fully specified.";

  return { phase: art.phase, n: art.n, verdict, reason, elements, resolves };
}

/**
 * Run the AURORA gate over a whole run manifest. Computes VELLUM provenance, then
 * gates every phase. `resolvedKeys` (optional) marks needs already satisfied — used
 * by the recompute loop.
 */
export async function runAuroraGate(
  manifest: RunManifest,
  resolvedKeys: Set<string> = new Set(),
): Promise<GateReport> {
  const prov = await bindProvenance(manifest);
  const provById = provenanceById(prov);

  const artifacts = manifest.artifacts.map((art) => gatePhase(art, provById, resolvedKeys));

  const outstanding: ResolveNeed[] = [];
  const summary = { NO_OBJECTION: 0, HOLD: 0, REFUSE: 0 };
  for (const av of artifacts) {
    for (const ev of av.elements) {
      summary[ev.verdict] += 1;
      if (ev.resolve) outstanding.push(ev.resolve);
    }
    for (const need of av.resolves) outstanding.push(need);
  }

  return { schema: "6d.aurora.v1", artifacts, outstanding, summary };
}

// ── REFUSE → RESOLVE → RECOMPUTE ──────────────────────────────────────────────

export type ResolutionOutcome = {
  resolution: Resolution;
  accepted: boolean;
  reason: string;
};

/**
 * Validate resolutions against the manifest and a gate report, returning the set of
 * need-keys that are now satisfied plus a per-resolution outcome.
 *
 * "We don't bullshit" floor:
 *   • A resolution must target an OUTSTANDING need (key must exist in the report).
 *   • An `unbound` need only clears if the resolution supplies a `sourceRef` that
 *     actually resolves in the manifest (an intent atom or a real element id) —
 *     i.e. you have to bind it to something real, not assert it.
 *   • An `open_question` need clears on a non-empty answer (the owner's decision).
 */
export function applyResolutions(
  manifest: RunManifest,
  report: GateReport,
  resolutions: Resolution[],
): { resolvedKeys: Set<string>; outcomes: ResolutionOutcome[] } {
  const needByKey = new Map<string, ResolveNeed>();
  for (const need of report.outstanding) needByKey.set(need.key, need);

  const knownIds = new Set<string>(manifest.intentIndex.map((a) => a.id));
  for (const art of manifest.artifacts) for (const e of art.elements) knownIds.add(e.id);

  const resolvedKeys = new Set<string>();
  const outcomes: ResolutionOutcome[] = [];

  for (const r of resolutions) {
    const need = needByKey.get(r.key);
    if (!need) {
      outcomes.push({ resolution: r, accepted: false, reason: "no such outstanding need" });
      continue;
    }
    if (need.kind === "unbound") {
      const ok = Boolean(r.sourceRef && knownIds.has(r.sourceRef));
      if (!ok) {
        outcomes.push({
          resolution: r,
          accepted: false,
          reason: "UNBOUND needs a sourceRef that resolves in the manifest — none supplied. Refusal stands.",
        });
        continue;
      }
    } else if (!r.answer.trim()) {
      outcomes.push({ resolution: r, accepted: false, reason: "empty answer — gap stays open" });
      continue;
    }
    resolvedKeys.add(need.key);
    outcomes.push({ resolution: r, accepted: true, reason: "resolved" });
  }

  return { resolvedKeys, outcomes };
}

/**
 * Full loop: gate → (if any REFUSE/HOLD) apply supplied resolutions → recompute.
 * Returns both the pre- and post-resolution reports plus the resolution outcomes,
 * so a caller (and the ledger) can see exactly what cleared and what still stands.
 */
export async function refuseResolveRecompute(
  manifest: RunManifest,
  resolutions: Resolution[] = [],
): Promise<{
  before: GateReport;
  outcomes: ResolutionOutcome[];
  resolvedKeys: string[];
  after: GateReport;
}> {
  const before = await runAuroraGate(manifest);
  const { resolvedKeys, outcomes } = applyResolutions(manifest, before, resolutions);
  const after = await runAuroraGate(manifest, resolvedKeys);
  return {
    before,
    outcomes,
    // Sorted for determinism in any serialized form.
    resolvedKeys: [...resolvedKeys].sort(),
    after,
  };
}
