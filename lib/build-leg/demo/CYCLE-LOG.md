# Live build cycle — a real agent self-corrects under the gate

*Captured 2026-06-13. This is not a fixture. A real builder agent was given a
deliberately **incomplete** spec, the validator caught the gap it genuinely
missed, the agent read the refusal and fixed its own code, and the gate passed
the fix. REFUSE → RESOLVE → RECOMPUTE, run by an actual agent.* 🐦‍⬛ + 🔑

## The setup (honest)

To exercise the resolve loop, the round-1 builder was handed a spec that **omitted
the rate-sheet staleness rule** (it was told only about eligibility, the margin
floor, and the audit record). The story it was *graded* against — `STALE_DATA_STORY`
— still carries all five acceptance criteria, including `ac.1` "refuse to quote on
stale data." So the build was always going to be measured against a requirement it
wasn't told about. That is the point: **specs have gaps; the validator is what
catches them.**

## Round 1 — the agent builds, the validator REFUSES

The agent implemented exactly what it was told. It even flagged the gap *itself* in
its delivery note:

> "the spec is silent on what to do when `rateSheet` is stale or unavailable… no
> rate-sheet liveness gate was added; the validator's probes will surface that story
> if it belongs in scope."

It does belong in scope. The gate ran the acceptance criteria as probes:

```
VERDICT: REFUSE   (4/5 criteria pass)
✖ ac.1  Refuse to quote when the rate sheet is stale — never price on stale data.
     → PRICED on stale data → {"ok":true,"priceBps":335,...}
✔ ac.2  Refuse when the eligibility service is unavailable.
✔ ac.3  Return a priced quote when feeds are live and the borrower is eligible.
✔ ac.4  Never quote below the margin floor.
✔ ac.5  Every quote carries an audit record.
receipt: ffc61c0ac1c52cb32aa38cfa…

REFUSE → RESOLVE (handed back to the builder):
  • [ac.1] Refuse to quote when the rate sheet is stale — never price on stale data.
```

The validator caught a **real omission** — not a planted bug — and named exactly
what to fix.

## Round 2 — the agent reads the refusal and fixes itself

Handed only the verdict and the resolve need, the agent added a rate-sheet liveness
guard *before* pricing and left everything it already had correct untouched:

```ts
// Requirement 0: refuse when the rate sheet is unavailable or stale.
if (!rateSheet.status.available || !rateSheet.status.fresh) {
  return { ok: false, refused: true,
    reason: !rateSheet.status.available ? "rate sheet unavailable" : "rate sheet stale" };
}
```

Re-gated:

```
VERDICT: NO_OBJECTION   (5/5 criteria pass)
✔ ac.1  ✔ ac.2  ✔ ac.3  ✔ ac.4  ✔ ac.5
receipt: 72623dc87839ff8aa762150d…
```

It shipped on round 2. (Its receipt — `72623dc8…` — is byte-identical to the
*independently* built correct build's receipt: two different agents, the same correct
behavior, the same deterministic seal. The gate doesn't care who built it, only
whether the work is right.)

## Why this matters

The builder is a commodity and it is fallible — it shipped something that priced on
stale data. **The validator is the product.** It caught the miss autonomously, said
precisely why, and the resolve loop closed it without a human reading a line of code.
*"AI that can't lie about whether the work is right"* — demonstrated, on a real agent,
at the code layer.
