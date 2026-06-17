# LOOPER + NORTH POLE (upgraded)

Agility front-door (LOOPER) and 6D COSMIC build workshop (NORTH POLE). Real engines, ledger receipts, no mocks.

## Sibling dependencies

This upgraded build wires **LUNA** and **STRATA** from the Chamber monorepo layout:

```
projects/
  luna/
  strata-v1/
  looper-northpole/   ← you are here
```

Install from `looper-northpole`:

```bash
npm install
npm run dev
```

Unlock gate: set `CODEGATE_DIGEST` in `.env` (see `.env.example` if present) or use `/unlock`.

## Scripts

- `npm run dev` — local dev server
- `npm run test` — unit tests
- `npm run prioritize` — Agility prioritize CLI