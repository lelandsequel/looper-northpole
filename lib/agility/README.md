# lib/agility — VENDORED Agility engine

These files are **copied verbatim** from the HL Prioritization OS repo:

    ~/projects/hl-prioritization-os/lib/*.mjs   → lib/agility/*.mjs
    ~/projects/hl-prioritization-os/seed/initiatives.mjs → lib/agility/seed/initiatives.mjs

The pipeline, in one call (`prioritize()` in `engine.mjs`):

    intake (structured + evidence) → dedup (third-calculator gate)
    → score (RICE × 3-yr NPV) → mandate carve-out → tier (6 tiers)
    → allocate (capacity) → ledger (receipts) → portfolio

Deterministic: same inputs + same dials ⇒ byte-identical ranking, every time.
The only runtime dependency is `node:crypto` (in `ledger.mjs`) — server-side only.

## What changed during vendoring

- **`seed/initiatives.mjs`** — its single import was repointed
  `../lib/types.mjs` → `../types.mjs` (the only edit to any vendored file).
- Nothing else. The 15 `lib/*.mjs` files are unmodified; their intra-directory
  `./x.mjs` imports resolve unchanged.

## Typed surface (added here, not vendored)

- **`types.ts`** — TypeScript interfaces mirroring the JSDoc typedef in
  `types.mjs` (`Initiative`, `Reach`, `PrioritizeResult`, …). Pure types.
- **`index.ts`** — typed barrel: imports the untyped `.mjs` and re-exports
  `prioritize` + `INITIATIVES` with strict types. **Import the engine from here.**

`tsconfig.json#include` does not cover `**/*.mjs`, so the vendored runtime is not
type-checked by the project; the typed barrel is the contract consumers bind to.

🐦‍⬛ + 🔑
