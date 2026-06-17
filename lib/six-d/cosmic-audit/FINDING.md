# 6D → COSMIC · Tier 3 — generated-artifact audit · honest finding

*Pan, for Captain. Branch: `pan-6d-tier3`. Grounded against the REAL VANTAGE
(`~/projects/bacchus-audit/vantage`) and the REAL 6D engine, run empirically.*

🐦‍⬛ + 🔑

## TL;DR

Wiring VANTAGE to audit 6D's **current** generated artifacts produces no
meaningful findings — **by construction, not by accident.** The artifacts are
prompts (prose), interface type-stubs, and comment-only test skeletons. VANTAGE
audits **code**. So Tier 3, built as a gate over today's artifacts, would be an
**always-green audit that audits nothing** — exactly the hollow feature the
build spec forbids.

So this module does **not** fake a clean pass. It **classifies** each artifact's
auditability and, when nothing is runnable, returns the verdict
**`NOT_WORTHWHILE`** with a precise REFUSE→RESOLVE resolution. The moment a 6D
phase emits real runnable code, the *same module* routes it to VANTAGE and
surfaces real findings (proven below with a planted unsafe pattern, against the
live engine).

This is REFUSE→RESOLVE: refuse to ship a hollow gate; name exactly what would
make it real.

## What VANTAGE actually is (and what the brief's description got wrong)

The build spec described `vantage analyze <path> --semantic` emitting SSTI/SSRF
**taint findings** (file/line/class). The **real** VANTAGE in this repo is a
different engine:

- It is **complexity / risk / adversarial-pattern** analysis, not semantic taint
  tracking. There is **no `--semantic` flag** and **no SSTI/SSRF detection.**
- Pipeline: `METEOR` (scan/parse) → `NOVA` (dep graph) → `ECLIPSE` (0–1 risk
  score per file) → `PULSAR` (adversarial pattern findings) → `AURORA` (verdict).
- CLI: `vantage run <dir> [--engine X] [--output report.json]`. It consumes a
  **directory on disk** and emits a JSON report. Findings live in
  `report.pulsar.adversarialFindings[]` as `{file, line, type, severity,
  description, testCase}`.
- **PULSAR** (the only engine that flags unsafe patterns) detects, by regex:
  unhandled `async/await` (HIGH `async-race`), `.then()` without `.catch()`
  (MED), `JSON.parse()` without try/catch (MED), Swift force-unwrap (HIGH),
  deep property access (LOW), array-index / division edge cases (LOW).

I adapted to the **real** interface, not the brief's.

## Why today's 6D artifacts find nothing — measured, not assumed

I materialised the real `EXAMPLE_INTENT` run's code-shaped artifacts to disk and
ran the **real** VANTAGE over them:

```
▸ METEOR   8 files scanned, 0 functions found, 0 TODO/FIXME
▸ ECLIPSE  0 high-risk files, 0 medium-risk files
▸ PULSAR   0 findings across 0 files
▸ AURORA   97.5% → APPROVED
```

A **vacuous green.** Two compounding reasons, both structural:

1. **No risk-bearing code for PULSAR to bite on.** The artifacts are:
   - `dev_prompt` (×3) — CADMUS prose ("You are a senior software engineer…").
     METEOR extracts **0 functions** from English.
   - `contract` (×1) — TypeScript **type declarations** only (`type
     ChallengeRequest = {…}`). No executable bodies, no `await`, no `JSON.parse`.
   - `scaffold` (Playwright) — `test(…, async ({page}) => { /* comment */ })`.
     Function shells with **comment-only bodies**: no `await`, nothing to
     stress-test.
   - `scaffold` (Gherkin) — `.feature` grammar is **not in VANTAGE's supported
     extensions**; METEOR skips it before any engine runs.

2. **PULSAR is gated behind ECLIPSE's risk filter.** PULSAR only inspects files
   ECLIPSE scores ≥ 0.4. A prompt/stub/skeleton scores ≈ 0.1, so it **never
   reaches PULSAR** even if a stray pattern existed. I confirmed empirically that
   even a real 26-line unsafe file (unhandled `await fetch` + unguarded
   `JSON.parse`, 20 branches) scored **below 0.4** as a single isolated file and
   produced **0 PULSAR findings**. PULSAR only fired once I gave it a large
   multi-function module (6 functions, ~217 LOC) — then it correctly raised
   **6 HIGH** `async-race` + `error-boundary` findings.

## What would make Tier 3 worthwhile (the RESOLVE)

Tier 3 becomes a real gate the moment a 6D phase emits **real runnable code**.
Concretely, any one of:

1. **A Develop sub-phase that fills the Playwright skeleton bodies** with real
   `await page.goto(…)`, `await page.click(…)`, assertions — i.e. executable
   test code, not `// arrange / act / assert` comments.
2. **A reference-implementation emitter** for the interface `contract` — a real
   function body that satisfies the contract, which an engineer would adapt.
3. **Any phase that emits executable source** with async/IO/parsing.

And because PULSAR is risk-gated, the emitted code must be **substantial enough
to clear ECLIPSE** (multi-function / coupled), *or* this module should call
VANTAGE's PULSAR-equivalent detectors directly to bypass the risk gate. The
current wiring uses the full pipeline (honest to how VANTAGE ships); the gate
documents this caveat rather than hiding it.

## What this module ships anyway (so the loop is closed, not abandoned)

Not just a memo — a real, deterministic, tested gate that is **correct in both
directions**:

- `auditGeneratedArtifacts(manifest, { runner? })` → `GeneratedArtifactAudit`.
- On today's artifacts → **`NOT_WORTHWHILE`**, VANTAGE **not invoked**, with the
  per-artifact reasons and the RESOLVE message. No fabricated pass.
- On an artifact carrying **real runnable unsafe code** → materialises it, runs
  VANTAGE, folds findings into **`NO_OBJECTION` / `HOLD` / `REFUSE`**, attributing
  each finding back to the generating 6D element id.
- Verified against the **live** VANTAGE (opt-in test): a planted unsafe artifact
  yields a real HIGH finding → `REFUSE`.

## Integration shape (decided honestly)

VANTAGE is a **separate runtime** — CommonJS/ts-node, Electron+Express deps,
walks the filesystem, shells out to `git`. It **cannot live in the browser
bundle** and does not import cleanly in-process here. The honest integration is
therefore **subprocess to its CLI**:

```
vantage run <materialised-dir> --output <report.json>   →  parse JSON
```

`vantage-runner.ts` is that boundary (run server-side only, e.g. behind a future
`/api/6d/tier3` route). The runner is **injected** into the auditor so the module
is deterministic and testable without the external runtime; the default
subprocess runner is lazy-loaded only when there is actually runnable code to
audit.

## Files

- `lib/six-d/cosmic-audit/types.ts` — verdict, auditability, finding, runner contract.
- `lib/six-d/cosmic-audit/classify.ts` — deterministic auditability classifier.
- `lib/six-d/cosmic-audit/index.ts` — the gate (`auditGeneratedArtifacts`).
- `lib/six-d/cosmic-audit/materialize.ts` — write runnable artifacts to a temp dir.
- `lib/six-d/cosmic-audit/vantage-runner.ts` — real subprocess CLI integration.
- `tests/six-d-cosmic-audit.test.ts` — both directions + opt-in real-VANTAGE.

v1 (`/6d`) is untouched. This module only imports the engine's types + a manifest.

The chamber holds.
