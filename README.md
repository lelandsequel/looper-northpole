# LOOPER + NORTHPOLE

Agility front-door (**LOOPER**) and 6D COSMIC build workshop (**NORTHPOLE**). Real engines, SQLite ledger receipts, no mocks.

| Surface | Route | What it does |
|---------|-------|--------------|
| **LOOPER** | `/looper` | Structured JSON intake → CADMUS gate → dedup → score → allocate → ranked NOW queue |
| **NORTHPOLE** | `/north-pole` | Funded initiatives → 6D COSMIC spec → Pan gate build → STRATA audit → feedback to Agility |

## Quick start

```bash
git clone https://github.com/lelandsequel/looper-northpole.git
cd looper-northpole
npm run setup    # install + seed + test
npm run dev      # http://localhost:3000
```

LUNA Witness + STRATA audit logic are **vendored in-repo** (`lib/luna/chamber/`, `lib/strata/`) — no sibling repos required.

## Unlock gate

Demo courtesy lock (not real security). Visit any route → redirected to `/unlock`.

- **Default code:** `333333`
- Override via `.env`: `GATE_CODE=333333` (see `.env.example`)

After unlock, cookie `looper_unlock` grants access to `/looper` and `/north-pole`.

## End-to-end flow

```
1. npm run seed          → 12 initiatives in SQLite (data/looper-northpole.db)
2. /looper               → ranked queue, FUNDED/BENCHED pills, ledger head
3. Paste JSON intake     → CADMUS refuses bad shape; good JSON re-prioritizes queue
4. /north-pole           → funded items from LOOPER ledger
5. "Run 6D + Build"      → COSMIC spec → BUILD_PENDING witness → Pan gate (2-round demo)
                         → STRATA audit → deliveryConfidence feedback → re-prioritize
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server |
| `npm run seed` | Seed initiative queue (`data/` is gitignored) |
| `npm run setup` | Install + seed + test (first-time bootstrap) |
| `npm test` | 39 unit + E2E tests (tsx) |
| `npm run build` | Production Next.js build |
| `npm run prioritize` | CLI: print ranked queue from seeded data |

## Architecture

- **CADMUS** (`lib/cadmus/`) — refuses unstructured intake; only valid initiative JSON passes
- **Agility** (`lib/agility/`) — dedup, RICE+NPV score, tier, portfolio allocate
- **6D COSMIC** (`lib/six-d/cosmic/`) — initiative → spec via LUNA-sealed run
- **Build leg** (`lib/build-leg/`) — Pan gate REFUSE→RESOLVE→RECOMPUTE loop
- **STRATA** (`lib/strata/`) — certified query audit on production fixture
- **LUNA Witness** (`lib/luna/chamber/`) — BUILD_PENDING witness atoms (vendored from Chamber LUNA v2)
- **Ledger** (`lib/store/`) — SQLite WAL; tamper-evident event chain

## CI

GitHub Actions on push/PR to `main`: `npm ci` → seed → test → build.

## Health

`GET /api/health` — no unlock required.

## License

UNLICENSED — private Chamber build.