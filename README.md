# LOOPER + NORTHPOLE

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![CI](https://github.com/lelandsequel/looper-northpole/actions/workflows/ci.yml/badge.svg)](https://github.com/lelandsequel/looper-northpole/actions/workflows/ci.yml)

**LOOPER** — structured intake → CADMUS gate → dedup → score → allocate → ranked queue.  
**NORTHPOLE** — funded initiatives → 6D COSMIC spec → build gate → STRATA audit → feedback loop.

Deterministic prioritization. Hash-chained receipts. No telemetry. No LLM in the rank path.

| Surface | Route | What it does |
|---------|-------|--------------|
| **LOOPER** | `/looper` | JSON intake → refuse bad shape → RICE+NPV rank → FUNDED/BENCHED queue |
| **NORTHPOLE** | `/north-pole` | Funded items → 6D spec → build gate demo → re-prioritize |

## Clone and verify (anti-timebomb packet)

```bash
git clone https://github.com/lelandsequel/looper-northpole.git
cd looper-northpole
npm run setup          # install + seed + 39 tests
npm run dev            # http://localhost:3000
```

What you're proving:

1. **Read every line** — no obfuscated binaries, no mystery deps beyond `package-lock.json`.
2. **Tests green** — includes E2E: intake → prioritize → 6D → build gate → ledger `verify()`.
3. **Synthetic data only** — seed portfolio is illustrative (`lib/agility/seed/initiatives.mjs`).
4. **No phone-home** — see [SECURITY.md](SECURITY.md).

## End-to-end flow

```
1. npm run seed          → 12 initiatives in SQLite (data/ — gitignored)
2. /looper               → ranked queue, FUNDED/BENCHED pills, ledger head
3. Paste JSON intake     → CADMUS refuses bad shape; good JSON re-prioritizes
4. /north-pole           → funded items from LOOPER ledger
5. "Run 6D + Build"      → COSMIC spec → build gate (demo) → STRATA fixture audit
                         → deliveryConfidence feedback → re-prioritize
```

## Honest scope — what's real vs. what's next

### LOOPER (meeting-ready today)

| Capability | Status |
|------------|--------|
| Structured intake + refusal | ✅ CADMUS gate |
| Dedup ("third calculator") | ✅ Jaccard cluster hold |
| RICE + 3yr NPV scoring | ✅ Deterministic receipts |
| NOW / funded / benched queue | ✅ Capacity allocate |
| Epic/story emission to Jira | 🔜 adapter layer (verification-first) |

LOOPER is what you described in the room: **one door in, scored rank out, every decision receipted.**

### NORTHPOLE (spine yes, muscle partial)

| Capability | Status |
|------------|--------|
| Initiative → 6D COSMIC spec | ✅ LUNA-sealed, AURORA gate |
| REFUSE → RESOLVE → RECOMPUTE build loop | ✅ Architecture + tests |
| Executable acceptance probes | ✅ Demo: `priceQuote` contract |
| **Real agent writes production code** | ❌ **Not wired** — `Builder` seam is injected |
| Multi-file repo builds | ❌ Demo is single-function fixture |
| Deploy to Gaia / FITS | ❌ Private adapter territory |

**The full-asshole play is half-built.** NORTHPOLE has the **gate** nobody else has (validator refuses, hands typed resolve needs, loops until green or exhausts). The **builder** slot is a demo: round 1 ships `lib/build-leg/demo/broken/priceQuote.ts`, round 2 ships the fixed version. That proves the loop — it does not prove an LLM/agent can build your Texas HELOC.

### Codegen agent plug-in (shipped)

NORTHPOLE accepts any HTTP agent at the `Builder` seam:

```bash
# Local proof without an LLM — stub agent mirrors the contract:
export BUILD_AGENT_URL=http://localhost:3000/api/build/agent-stub

curl -X POST http://localhost:3000/api/build \
  -H 'content-type: application/json' \
  -d '{"initiativeId":"HL-001","builder":"agent","maxRounds":3}'
```

| Endpoint | Purpose |
|----------|---------|
| `GET /api/build/contract` | Agent request/response schema (no unlock) |
| `POST /api/build/agent-stub` | Reference agent for integration tests |
| `POST /api/build` | Full NORTHPOLE run (`builder`: `demo` \| `agent`) |

Agent contract: POST JSON `BuildBrief` → `{ ok, modules: { "priceQuote.ts": "..." } }`.
On REFUSE, NORTHPOLE re-posts with `resolve[]` from failed blocking criteria.

Still to generalize beyond the HL-002 `priceQuote` demo:

1. COSMIC-sourced work orders (`storyFromSpec` → probes)
2. Multi-file repo builds + `npm test` probes
3. LOOPER epic/story emit with verification layer

## Unlock gate (demo only)

Visit any route → `/unlock`. Default code `333333` (override via `GATE_CODE` in `.env`).

## Architecture

- **CADMUS** (`lib/cadmus/`) — refuses unstructured intake
- **Agility** (`lib/agility/`) — dedup, RICE+NPV, tier, portfolio allocate
- **6D COSMIC** (`lib/six-d/cosmic/`) — initiative → spec, LUNA chain
- **Build leg** (`lib/build-leg/`) — REFUSE→RESOLVE→RECOMPUTE (demo builder today)
- **STRATA** (`lib/strata/`) — certified query audit on fixture
- **LUNA Witness** (`lib/luna/chamber/`) — vendored BUILD_PENDING atoms
- **Ledger** (`lib/store/`) — SQLite WAL, tamper-evident chain

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run setup` | Install + seed + test (first clone) |
| `npm run dev` | Local dev server |
| `npm run test` | 39 unit + E2E tests |
| `npm run prioritize` | CLI ranked queue from seed |

## CI

GitHub Actions: `npm ci` → seed → test → build on every push/PR to `main`.

## Health

`GET /api/health` — no unlock required.

## License

Apache-2.0 — see [LICENSE](LICENSE). Vendored components: [NOTICE](NOTICE).