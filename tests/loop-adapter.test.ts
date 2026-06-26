// THE AGILITY ↔ 6D LOOP — adapter tests.
//
// Proves the bidirectional seam between Agility (the product: what to build,
// prioritized) and 6D COSMIC (the architecture: the buildable spec):
//   1. FORWARD   — initiativeToIntent maps every contract field correctly.
//   2. PROVENANCE — an Initiative's `evidence` flows through to 6D sourceMaterial,
//                   becomes a VELLUM-bindable source atom, AND a real 6D artifact
//                   element traces back to it (the receipts flow Agility→6D unbroken).
//   3. REVERSE   — artifactsToInitiativeUpdate re-estimates from the decomposed
//                   slices, and the re-estimate demonstrably DIFFERS from the rough one.
//   4. DETERMINISM — both directions are byte-stable across independent runs.
//   5. CLOSED LOOP — feeding the re-estimate back to Agility re-prioritizes the queue.
//
// Style mirrors tests/six-d-cosmic.test.ts. Engines (Agility .mjs, 6D v1, COSMIC)
// are untouched — this suite only exercises lib/loop/adapter.ts against them.
// 🐦‍⬛ + 🔑

import { test } from "node:test";
import assert from "node:assert/strict";

import { prioritize, INITIATIVES, type Initiative } from "../lib/agility";
import { runSixDCosmic, buildCosmicRun } from "../lib/six-d/cosmic";
import {
  initiativeToIntent,
  artifactsToInitiativeUpdate,
  reEstimateTeamWeeks,
  derivedDependencies,
  openIssuesFrom,
  ESTIMATE_WEEKS,
} from "../lib/loop/adapter";

// A representative funded initiative from the seed: the Correspondent Pricing
// Engine — carries a mandate-free, multi-evidence, large-rough-estimate (22w)
// profile, which makes the re-estimate divergence vivid.
function funded(): Initiative[] {
  return prioritize(INITIATIVES, { capacity: 12 }).funded;
}
const byId = (xs: Initiative[], id: string): Initiative =>
  xs.find((x) => x.id === id)!;

// ── 1 · FORWARD — initiativeToIntent contract ────────────────────────────────

test("forward: initiativeToIntent maps title/context/goals/constraints per contract", () => {
  const i = byId(INITIATIVES, "HL-003"); // the regulatory mandate item
  const intent = initiativeToIntent(i);

  // title ← initiative.title
  assert.equal(intent.title, i.title);

  // context ← description only (metadata lives in constraints)
  assert.equal(intent.context, i.description.trim());
  assert.ok(intent.constraints.some((c) => c.includes(`Outcome: ${i.outcome}`)));
  assert.ok(intent.constraints.some((c) => c.includes(i.area)));

  // goals ← outcome + value focus + reach (no triple restatement)
  assert.equal(intent.goals.length, 3);
  assert.equal(intent.goals[0], i.outcome);
  assert.match(intent.goals[1], /regulatory and audit/i);
  assert.match(intent.goals[2], /scale to/i);

  // constraints ← metadata, then mandate (HL-003 has one), channel/talent/budget.
  assert.equal(
    intent.constraints.find((c) => c.startsWith("Regulatory mandate")),
    `Regulatory mandate — ${i.mandateCitation}`,
  );
  assert.ok(intent.constraints.includes(`Channel: ${i.businessImpact}`));
  assert.ok(intent.constraints.includes(`Talent: ${i.talentProfile}`));
  assert.ok(intent.constraints.some((c) => c.startsWith("Budget cycle:")));
});

test("forward: the 5 value types each map to a short focus goal", () => {
  const cases: Array<[string, RegExp]> = [
    ["HL-001", /revenue impact/i],
    ["HL-004", /customer service outcomes/i],
    ["HL-005", /internal capability/i],
    ["HL-003", /regulatory and audit/i],
    ["HL-008", /strategic option/i],
  ];
  for (const [id, re] of cases) {
    const intent = initiativeToIntent(byId(INITIATIVES, id));
    assert.match(intent.goals[1], re, `${id} value-type story goal`);
  }
});

test("forward: a non-mandate initiative omits the mandate constraint; deps appear when present", () => {
  const noMandate = initiativeToIntent(byId(INITIATIVES, "HL-001"));
  assert.ok(
    !noMandate.constraints.some((c) => c.startsWith("Regulatory mandate")),
    "no mandate ⇒ no mandate constraint",
  );

  // Synthesize a dependsOn to prove the constraint fires.
  const withDep: Initiative = { ...byId(INITIATIVES, "HL-001"), dependsOn: ["HL-002", "HL-003"] };
  const intent = initiativeToIntent(withDep);
  assert.ok(intent.constraints.includes("Depends on HL-002, HL-003"));
});

// ── 2 · PROVENANCE FLOW-THROUGH (load-bearing) ───────────────────────────────

test("provenance: evidence becomes sourceMaterial as `${field}: ${source}`", () => {
  const i = byId(INITIATIVES, "HL-001");
  const intent = initiativeToIntent(i);
  const expected = Object.entries(i.evidence ?? {}).map(([f, s]) => `${f}: ${s}`);
  assert.deepEqual(intent.sourceMaterial, expected);
  assert.ok(expected.length > 0, "the seed item carries evidence");
  // Spot-check a concrete entry survives verbatim.
  assert.ok(intent.sourceMaterial.includes("reach: Partnerships TAM model 2026-Q1"));
});

test("provenance: an evidence source becomes a VELLUM source atom AND a real 6D element traces back to it (Agility→6D unbroken)", async () => {
  const i = byId(INITIATIVES, "HL-001");
  const intent = initiativeToIntent(i);
  const run = await buildCosmicRun(intent);

  // Each evidence entry is now a `source` intent atom in the 6D manifest.
  const sourceAtoms = run.manifest.intentIndex.filter((a) => a.kind === "source");
  assert.equal(sourceAtoms.length, Object.keys(i.evidence ?? {}).length);
  assert.ok(sourceAtoms.some((a) => /Partnerships TAM model/.test(a.text)));

  // THE PROOF: at least one artifact element cites one of those source atoms,
  // and VELLUM binds that element (status BOUND) with a hashed source binding.
  const sourceIds = new Set(sourceAtoms.map((a) => a.id));
  let tracedElement: { id: string; ref: string } | null = null;
  for (const art of run.manifest.artifacts) {
    for (const e of art.elements) {
      const ref = e.sourceRefs.find((r) => sourceIds.has(r));
      if (ref) {
        tracedElement = { id: e.id, ref };
        break;
      }
    }
    if (tracedElement) break;
  }
  assert.ok(
    tracedElement,
    "expected a 6D artifact element whose sourceRef points back to an Agility evidence source",
  );

  // And VELLUM bound that very element to a real, hashed source.
  const prov = run.provenance.find((p) => p.elementId === tracedElement!.id)!;
  assert.equal(prov.status, "BOUND", "the traced element must be VELLUM-BOUND");
  assert.ok(
    prov.bindings.some(
      (b) => b.ref === tracedElement!.ref && b.resolved && /^[0-9a-f]{64}$/.test(b.sourceHash ?? ""),
    ),
    "the binding to the evidence source must carry a sha256 source hash",
  );
});

// ── 3 · REVERSE — artifactsToInitiativeUpdate ────────────────────────────────

test("reverse: re-estimate sums the decomposed slices (S/M/L → 1/2/4 wk)", async () => {
  const i = byId(funded(), "HL-002");
  const { run, entry } = await runSixDCosmic(initiativeToIntent(i));

  // Recompute the expected sum directly from the Distribute story estimates.
  const dist = run.manifest.artifacts.find((a) => a.phase === "distribute")!;
  const expected = dist.elements
    .filter((e) => e.kind === "story")
    .reduce((sum, e) => {
      const est = e.fields?.estimate;
      return sum + (typeof est === "string" && est in ESTIMATE_WEEKS ? ESTIMATE_WEEKS[est] : 0);
    }, 0);

  assert.equal(reEstimateTeamWeeks(run), expected);
  assert.ok(expected > 0, "the spec produced sized slices");

  const upd = artifactsToInitiativeUpdate(run, i, entry.hash);
  assert.equal(upd.reEstimatedEffortTeamWeeks, expected);
  assert.equal(upd.roughEffortTeamWeeks, i.effortTeamWeeks);
});

test("reverse: the re-estimate DIFFERS from the rough estimate (the loop's point)", async () => {
  // Every funded seed item's rough estimate differs from its decomposed size.
  for (const i of funded()) {
    const { run, entry } = await runSixDCosmic(initiativeToIntent(i));
    const upd = artifactsToInitiativeUpdate(run, i, entry.hash);
    assert.equal(upd.reEstimateDiffers, true, `${i.id} re-estimate should differ from rough`);
    assert.notEqual(
      upd.reEstimatedEffortTeamWeeks,
      upd.roughEffortTeamWeeks,
      `${i.id}: decomposed ${upd.reEstimatedEffortTeamWeeks}w vs rough ${upd.roughEffortTeamWeeks}w`,
    );
  }
});

test("reverse: openIssues flatten AURORA REFUSE/HOLD with their resolution requirement", async () => {
  const i = byId(funded(), "HL-002");
  const { run, entry } = await runSixDCosmic(initiativeToIntent(i));
  const issues = openIssuesFrom(run);
  const upd = artifactsToInitiativeUpdate(run, i, entry.hash);

  assert.ok(issues.length > 0, "the spec surfaced real open issues");
  assert.equal(upd.openIssueCount, issues.length);
  for (const iss of issues) {
    assert.ok(iss.verdict === "REFUSE" || iss.verdict === "HOLD");
    assert.match(iss.key, /^(oq|unbound):/, "every issue carries an AURORA need key");
    assert.ok(iss.required.length > 0, "every issue states what to resolve");
  }
  // No issue keys are duplicated.
  assert.equal(new Set(issues.map((x) => x.key)).size, issues.length);
});

test("reverse: verdict is 'ready' with no blocking refusal, 'needs-resolution' with one", async () => {
  const i = byId(funded(), "HL-002");
  const { run, entry } = await runSixDCosmic(initiativeToIntent(i));

  // The seed intents produce only non-blocking HOLDs → ready.
  const ready = artifactsToInitiativeUpdate(run, i, entry.hash);
  assert.equal(ready.verdict, "ready");
  assert.equal(ready.openIssues.some((x) => x.blocking), false);

  // Inject a blocking REFUSE by fabricating an unbound element (honest negative
  // control — same technique the cosmic suite uses). The gate must refuse it and
  // the update must flip to needs-resolution.
  const tampered = await buildCosmicRun(initiativeToIntent(i));
  tampered.manifest.artifacts[0].elements.push({
    id: "define.fabricated.1",
    kind: "fabricated",
    body: "An invented requirement with no source.",
    sourceRefs: ["intent.does.not.exist"],
  });
  const { runAuroraGate } = await import("../lib/six-d/cosmic");
  tampered.gate = await runAuroraGate(tampered.manifest);
  const blocked = artifactsToInitiativeUpdate(tampered, i);
  assert.equal(blocked.verdict, "needs-resolution");
  assert.ok(
    blocked.openIssues.some((x) => x.blocking && x.key === "unbound:define.fabricated.1"),
    "the blocking issue traces to the unbound element",
  );
});

test("reverse: dependencies derive from the Distribute dependency graph", async () => {
  const i = byId(funded(), "HL-002");
  const { run } = await runSixDCosmic(initiativeToIntent(i));
  const deps = derivedDependencies(run);

  // Recompute expectation directly from the story dependsOn fields.
  const dist = run.manifest.artifacts.find((a) => a.phase === "distribute")!;
  let expectedEdges = 0;
  for (const e of dist.elements.filter((s) => s.kind === "story")) {
    const d = e.fields?.dependsOn;
    if (Array.isArray(d)) expectedEdges += d.length;
  }
  assert.equal(deps.length, expectedEdges);
  for (const d of deps) {
    assert.equal(d.edge, `${d.from} → ${d.on}`);
    assert.match(d.from, /^distribute\.story\.\d+$/);
    assert.match(d.on, /^distribute\.story\.\d+$/);
  }
});

// ── 4 · DETERMINISM ──────────────────────────────────────────────────────────

test("determinism: initiativeToIntent is byte-stable for the same initiative", () => {
  const i = byId(INITIATIVES, "HL-002");
  assert.deepStrictEqual(initiativeToIntent(i), initiativeToIntent(i));
});

test("determinism: the full forward→spec→reverse round is byte-stable across independent runs", async () => {
  const i = byId(funded(), "HL-002");
  const a = await runSixDCosmic(initiativeToIntent(i));
  const b = await runSixDCosmic(initiativeToIntent(i));
  const ua = artifactsToInitiativeUpdate(a.run, i, a.entry.hash);
  const ub = artifactsToInitiativeUpdate(b.run, i, b.entry.hash);
  assert.deepStrictEqual(ua, ub);
  assert.equal(ua.specReceipt, ub.specReceipt);
  assert.match(ua.specReceipt, /^[0-9a-f]{64}$/);
});

test("determinism: specReceipt is the run's LUNA chain head", async () => {
  const i = byId(funded(), "HL-002");
  const { run, entry } = await runSixDCosmic(initiativeToIntent(i));
  const upd = artifactsToInitiativeUpdate(run, i, entry.hash);
  assert.equal(upd.specReceipt, entry.hash, "specReceipt is the sealed ledger entry hash");
  // Without an entry hash, it falls back to the run hash (never empty).
  const fallback = artifactsToInitiativeUpdate(run, i);
  assert.equal(fallback.specReceipt, run.runHash);
});

// ── 5 · CLOSED LOOP — feed the re-estimate back, re-prioritize ───────────────

test("closed loop: feeding the re-estimate back to Agility re-prioritizes the queue", async () => {
  const pass1 = prioritize(INITIATIVES, { capacity: 12 });
  const target = byId(pass1.funded, "HL-002"); // rough 22w

  const { run, entry } = await runSixDCosmic(initiativeToIntent(target));
  const upd = artifactsToInitiativeUpdate(run, target, entry.hash);
  assert.ok(
    upd.reEstimatedEffortTeamWeeks < target.effortTeamWeeks,
    "the decomposed size is smaller than the rough 22w",
  );

  // Re-decide: apply the real size, re-run the pipeline.
  const updated: Initiative[] = INITIATIVES.map((x) =>
    x.id === target.id ? { ...x, effortTeamWeeks: upd.reEstimatedEffortTeamWeeks } : x,
  );
  const pass2 = prioritize(updated, { capacity: 12 });

  // Freeing capacity pulls previously-benched work onto the funded queue.
  const f1 = new Set(pass1.funded.map((x) => x.id));
  const f2 = new Set(pass2.funded.map((x) => x.id));
  const newlyFunded = [...f2].filter((id) => !f1.has(id));
  assert.ok(newlyFunded.length > 0, "re-prioritizing on the real size funds more work");

  // And the decision is recorded: the Agility ledger head moves.
  assert.notEqual(pass1.head, pass2.head, "the re-decision changes the chain head");
});
