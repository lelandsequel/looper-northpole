// 6D Workbench — COSMIC markdown export.
//
// Renders a run's COSMIC layer (the AURORA verdict board, the VELLUM provenance
// summary, and the LUNA chain entry) as deterministic markdown — the v1 bundle,
// upgraded with the gate floor made visible. Pure string assembly.
//
// 🐦‍⬛ + 🔑

import type { VerifyResult } from "./luna";
import type { CosmicRun } from "./engine";
import type { ArtifactVerdict } from "./aurora";

const VERDICT_MARK: Record<string, string> = {
  NO_OBJECTION: "✅ NO_OBJECTION",
  HOLD: "⏸️ HOLD",
  REFUSE: "⛔ REFUSE",
};

const shortHash = (h: string): string => `${h.slice(0, 10)}…${h.slice(-6)}`;

const phaseBlock = (av: ArtifactVerdict): string[] => {
  const L: string[] = [];
  L.push(`### ${av.n} · ${av.phase} — ${VERDICT_MARK[av.verdict] ?? av.verdict}`);
  L.push("");
  L.push(`> ${av.reason}`);
  L.push("");
  const flagged = av.elements.filter((e) => e.verdict !== "NO_OBJECTION");
  if (flagged.length) {
    L.push("**Flagged elements**");
    for (const ev of flagged) {
      L.push(`- ${VERDICT_MARK[ev.verdict] ?? ev.verdict} \`${ev.elementId}\` — ${ev.reason}`);
    }
    L.push("");
  }
  if (av.resolves.length) {
    L.push("**Open needs (RESOLVE to clear)**");
    for (const n of av.resolves) {
      L.push(`- ${n.blocking ? "**[BLOCKING]** " : ""}${n.required} _(${n.key})_`);
    }
    L.push("");
  }
  return L;
};

export function cosmicMarkdown(run: CosmicRun, verify?: VerifyResult): string {
  const m = run.manifest;
  const unbound = run.provenance.filter((p) => p.status === "UNBOUND");
  const L: string[] = [];

  L.push(`# 6D Workbench · COSMIC — ${m.intent.title}`);
  L.push("");
  L.push(`> Pipeline: produce → **VELLUM** (bind) → **AURORA** (gate) → **LUNA** (chain).`);
  L.push(`> **v1 receipt (SHA-256):** \`${m.receipt}\``);
  L.push(`> **COSMIC run hash:** \`${run.runHash}\``);
  L.push(
    `> **Gate:** ${run.gate.summary.NO_OBJECTION} NO_OBJECTION · ${run.gate.summary.HOLD} HOLD · ${run.gate.summary.REFUSE} REFUSE.`,
  );
  if (verify) {
    L.push(
      verify.ok
        ? `> **LUNA chain:** ✅ intact — ${verify.count} entr${verify.count === 1 ? "y" : "ies"}, head \`${verify.head ? shortHash(verify.head) : "—"}\`.`
        : `> **LUNA chain:** ⛔ broken at entry ${verify.at} — ${verify.reason}.`,
    );
  }
  L.push("");

  L.push(`## AURORA — verdict gate`);
  L.push("");
  for (const av of run.gate.artifacts) L.push(...phaseBlock(av));

  L.push(`## VELLUM — provenance`);
  L.push("");
  if (unbound.length === 0) {
    L.push(
      `Every one of the ${run.provenance.length} elements binds to a source. Nothing is UNBOUND — nothing ships as fact without provenance.`,
    );
  } else {
    L.push(`**${unbound.length} UNBOUND element(s)** — cannot ship as fact:`);
    for (const p of unbound) L.push(`- ⛔ \`${p.elementId}\` — ${p.reason}`);
  }
  L.push("");

  L.push("---");
  L.push(
    `*Deterministic · keyless · zero egress. The semantic source set defines truth; AURORA refuses every element VELLUM cannot bind back to it; LUNA chains the run so any later edit snaps the chain and names where.*`,
  );
  return L.join("\n");
}
