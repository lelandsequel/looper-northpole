# 6D Workbench → COSMIC-native — design memo

*Pan, for Captain. Branch: `pan-6d-cosmic`. Grounded against the live engines + the Scott/VANTAGE reports, 2026-06-12.*

## The honest starting point: v1 is a beautiful fake of your own engines

The 6D Workbench v1 (live at jourdanlabs.com/6d) is a fully deterministic, keyless, six-phase SDLC artifact engine. It works, it's tested, it ships. But to stand alone for the hackathon it **reimplemented toy versions of four engines you already built and benchmarked:**

| 6D v1 does (toy) | The real engine | What the toy loses |
|---|---|---|
| `sha256(manifest)` per-run receipt (`engine.ts`) | **LUNA** — hash-chained append-only ledger | one hash per run, not a tamper-evident *chain* of all runs; no `verify()` walk |
| `sourceRefs: string[]` per element (`types.ts`) | **VELLUM** — source + artifact-hash provenance envelope; unsourced = UNBOUND | refs are bare ids, not *bound to source*; nothing is structurally "unproven" |
| `openQuestions[]` + refusal text (`phases.ts`) | **AURORA** — verdict gate (NO_OBJECTION/HOLD/REFUSE) running REFUSE→RESOLVE→RECOMPUTE | a flagged gap, not a *verdict*; no resolve-loop, no gate floor |
| keyword buckets + actor regex (`helpers.ts`) | **ASTRAL** (semantic/schema) + **NEBULA** action-suite (entity reconciliation) | "understanding" = substring match; can't tell "the agent" and "servicing agents" are one entity |

Good news, not bad: v1 proved the shape works. The upgrade is to swap the toys for the engines you've already built.

## Precision: there are THREE things called NEBULA — don't wire the wrong one

1. **NEBULA — VANTAGE semantic-taint mode** (`bacchus-audit/vantage`): intraprocedural CODE taint tracking. *This* is "NEBULA = semantic" from the Scott prep (found SSTI/SSRF on Juice Shop that pattern mode misses, 10 net-new). For CODE → relevant only to auditing the *generated* dev artifacts (Tier 3), **not** to parsing intent.
2. **NEBULA — the action suite** (`~/projects/nebula`): COALESCE/ACCRETE/TRANSIT/BEACON/WAKE — messy records → clean, deduped, canonically-named, provenance-stamped entities. Deterministic. → relevant to the *intent semantic layer* (canonicalize the actors/systems the intent names).
3. **NEBULA — COSMIC core-8**: uncertainty/Bayesian. In core-8, **ASTRAL** is the semantic/schema engine. → ASTRAL is the intent-schema candidate.

Captain's "NEBULA = semantic" is correct for #1. For the *intent layer* of 6D, the semantic engines are **ASTRAL + NEBULA-the-action-suite.**

## The upgrade: run the canonical COSMIC pipeline on SDLC artifacts

COSMIC's pipeline shape (engine-roles doctrine):
`produce → VELLUM (bind source) → AURORA (gate) →[refused]→ RESOLVE → RECOMPUTE → LUNA (chain)`

The 6D Workbench should *be* that pipeline, pointed at spec artifacts:

```
Feature Intent
 → [SEMANTIC LAYER]  ASTRAL schema  +  NEBULA entity reconciliation
      (what does this intent MEAN — entities, requirements, constraints — deterministically)
 → 6D phase transforms (Define…Deliver)            [existing, kept]
 → [VELLUM]  bind every element to a source atom; unbound = UNBOUND (cannot ship as fact)
 → [AURORA]  gate each artifact: NO_OBJECTION / HOLD / REFUSE — refused runs REFUSE→RESOLVE→RECOMPUTE
 → [LUNA]    hash-chain the run into the append-only ledger; verify() walks the chain
```

## Why this is the whole strategy, not just a refactor

This *is* the Scott round-2 pitch, running, on real artifacts:

> **"You define truth (the semantic layer); we refuse everything the semantic layer can't back."**

The semantic layer (ASTRAL/NEBULA) defines what the intent means. The 6D engine then **refuses to emit any artifact element it can't bind back to that semantic model** (VELLUM UNBOUND → AURORA REFUSE → open question). That's "AtScale defines truth, COSMIC enforces it" — demonstrated, on SDLC, clickable.

And it's the governed answer to **enterprise 6D SDLC frameworks** that run on gen-AI suites (which drift). The COSMIC-native Workbench runs the same six phases **deterministically, semantically grounded, refusal-gated, hash-chained** — the governance layer those frameworks typically lack.

## Prioritized improvements

**Tier 1 — the pipeline reshape (high value · contained · demo-defining):**
- **LUNA ledger** — replace the per-run SHA with a real hash-chained append-only ledger. Demo: "every run chained; alter any past run, the chain breaks and names where." The #6.1 thesis at full strength.
- **AURORA gate** — each artifact gets a real verdict (NO_OBJECTION/HOLD/REFUSE) + the REFUSE→RESOLVE→RECOMPUTE loop, replacing the toy open-questions.
- **VELLUM provenance** — sourceRefs become source+hash bindings; no binding = UNBOUND, cannot ship as fact.
- *Effort: moderate. LUNA (`~/projects/luna`) and AURORA (`bifrost-browser/AURORAKit`, `bacchusroe/.../aurora`) exist as code to adapt. **VELLUM has no standalone repo** — it's a provenance *pattern* to implement from doctrine (source+hash binding + UNBOUND), not an import.*

**Tier 2 — the semantic layer (highest value · the frontier):**
- Replace keyword-bucket/regex intent parsing with **ASTRAL** (semantic/schema typing) + **NEBULA action-suite** (canonicalize entities — one "agent," not three regex hits).
- *Effort: large + genuinely hard. **Deterministic prose→meaning is unsolved** by any current engine — they give real machinery (schema, entity reconciliation, provenance) but the prose front-end is where determinism is hardest. This is the part that, cracked, IS the differentiator. Scope deliberately; promise no magic.*

**Tier 3 — close the loop (adjacent):**
- **VANTAGE** (the code-taint NEBULA, #1 above) audits the *generated* dev prompts/scaffolding for unsafe patterns before they're handed off.

## Honest caveats (we don't bullshit, even in our own design)
- Engines live in **scattered repos at varying maturity**; "wire them in" = import / port / call-as-service. Real integration, not a snap.
- **Deterministic NL understanding is not solved.** Tier 2 deepens the semantic layer; it doesn't make it magic. Owning that gap is the difference between our pitch and LLM-Suite's.
- **Keep v1 (`/6d`) live and untouched.** Build the COSMIC version behind it until proven, then promote.

🐦‍⬛ + 🔑
The chamber holds.

---

## Consolidation — Tier 1 + 2 + 3 merged into one canonical engine

*Branch `pan-6d-cosmic-merged`. The three tiers were built on sibling branches (all gated green by Pan) and are now ONE coherent, green tree.*

### What landed where (all additive — v1 byte-untouched)

| Layer | Path | Tier | Public surface |
|---|---|---|---|
| v1 (frozen) | `lib/six-d/*.ts`, `app/6d/` | — | `runSixD`, the keyword helpers — **byte-identical to origin/main** |
| LUNA · AURORA · VELLUM | `lib/six-d/cosmic/` | 1 | `runSixDCosmic`, `Ledger`, `runAuroraGate`, `bindProvenance` |
| NEBULA · ASTRAL · frontier | `lib/six-d/semantic/` | 2 | `buildSemanticModel`, `reconcile`, `classifyClause` |
| VANTAGE generated-artifact gate | `lib/six-d/cosmic-audit/` | 3 | `auditGeneratedArtifacts` (honest `NOT_WORTHWHILE`) |
| **composition seam** | `lib/six-d/cosmic-native.ts` | 1+2+3 | `runSixDCosmicNative` |
| `app/6d-cosmic/` | Tier-1 page (kept as-is) | 1 | — |

The three tiers touch **disjoint** files (different sub-packages, different test files) and share only the byte-identical v1 + design doc, so the union merged with **zero content conflicts**. Tier 2 was stacked on Tier 3, so its `cosmic-audit/*` copies are byte-identical to Tier 3's — no reconciliation needed there.

### The fusion decision — COMPOSABLE, with a documented seam (not spliced into v1)

The memo's question: wire the Tier-2 `IntentSemanticModel` into the COSMIC pipeline's parse step, or keep the layers composable?

**Call: composable.** The pipeline's parse step is `runSixD` (v1), which is **byte-frozen by contract** — the determinism tests pin its receipt to exact manifest bytes. The Tier-2 authors deliberately built the semantic layer to be consumed as an *extra argument* (`semantic/phases-semantic.ts`: *"A real Tier-2 promotion would thread the model through PhaseCtx; this shows the consuming code that promotion would use"*). Splicing the model into the parse step **without** rewriting the phase transforms would only annotate the run — a decorative "fusion" that changes no output. That's the beautiful fake the memo warns against. We don't bullshit.

So the honest realization is a single composition seam — `lib/six-d/cosmic-native.ts::runSixDCosmicNative` — that runs all three tiers over one intent and returns one deterministic view (`semantic` + `cosmic` + `entry` + `audit`). It derives the semantic model and the audit from the **same v1 manifest** (`manifest.intent` + `manifest.intentIndex`), so nothing re-parses and nothing drifts. It **does not mutate** v1's manifest, receipt, or any Tier-1 hash — proven by `tests/six-d-cosmic-native.test.ts` ("non-perturbation"). The phase-level promotion (`definePhaseSemantic` / `designPhaseSemantic`) stays available behind the seam for when v1 is intentionally re-cut.

### Green together

`tsx --test` over all suites, run together:

- `six-d-engine` — **11/11** (v1 non-negotiables)
- `six-d-cosmic` — **18/18** (Tier 1)
- `six-d-semantic` — **12/12** (Tier 2)
- `six-d-cosmic-audit` — **6 pass + 1 opt-in skip** (Tier 3)
- `six-d-cosmic-native` — **5/5** (the seam: composition · non-perturbation · determinism · no-drift · chaining)

Totals: **53 tests, 52 pass, 1 skip, 0 fail.** `next build` clean.

🐦‍⬛ + 🔑
The chamber holds.
