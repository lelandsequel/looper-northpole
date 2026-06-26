# LOOPER + NORTHPOLE

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![CI](https://github.com/lelandsequel/looper-northpole/actions/workflows/ci.yml/badge.svg)](https://github.com/lelandsequel/looper-northpole/actions/workflows/ci.yml)

**LOOPER** — structured intake → CADMUS gate → dedup → score → allocate → ranked queue.  
**NORTHPOLE** — funded initiatives → 6D COSMIC spec → build gate → STRATA audit → feedback loop.

Deterministic prioritization. Hash-chained receipts. No telemetry. No LLM in the rank path.

| Surface | Route | What it does |
|---------|-------|--------------|
| **Intake gates** | `/` → `/intake/[gate]` | Multi-entry front doors → same engine (`lib/looper/gates/`) |
| **LOOPER** | `/looper` | Ranked queue, guided/JSON intake, 6D spec → epic/story docs |
| **NORTHPOLE** | `/north-pole` | Build gate demo + STRATA audit (optional; spec lives on LOOPER) |

## No npm? (Chase laptop, locked-down box)

You only need **Docker** — no Node, no npm on the host.

### Option A — pull prebuilt image (fastest)

```bash
docker pull ghcr.io/lelandsequel/looper-northpole:latest
docker run -d --name looper \
  -p 3001:3000 \
  -v looper-data:/data \
  -e GATE_CODE=333333 \
  ghcr.io/lelandsequel/looper-northpole:latest
```

Open http://localhost:3001 — unlock `333333`.

### Option B — clone + docker compose (build on machine)

```bash
git clone https://github.com/lelandsequel/looper-northpole.git
cd looper-northpole
cp .env.example .env
docker compose up --build -d    # needs Docker *build* — slower first time
```

`docker compose` still uses npm **inside** the container, not on your laptop.

### No Docker either?

You're stuck without *some* runtime. Ask IT for Docker Desktop or Podman, or run LOOPER on a machine that has Node 20+.

---

## Docker pilot (recommended when you have npm locally)

Persistent SQLite + spec docs on a volume. Guided intake form on `/looper`.

```bash
cp .env.example .env          # set GATE_CODE for your test group
npm run docker:up             # http://localhost:3001 (LOOPER_PORT=3000 if 3000 is free)
npm run docker:logs           # follow logs
```

First boot seeds the portfolio. Data survives restarts in the `looper-data` volume.

```bash
npm run docker:down           # stop
docker volume rm looper-northpole_looper-data   # wipe pilot data
```

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
| Epic/story docs from spec | ✅ `lib/looper/docs.ts` → `data/spec-docs/` |
| Epic/story emission to Jira | ✅ adapter (`lib/jira/`) — optional, not in LOOPER UI |

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
| `POST /api/looper/spec` | Funded initiative → 6D COSMIC spec → epic/story markdown docs |
| `GET /api/looper/spec?initiativeId=` | Latest stored spec run + doc paths |
| `GET /api/jira/emit/preview?initiativeId=` | Preview verified epic/story payload (refuses if not ticket-ready) |
| `POST /api/jira/emit` | Emit verified payload (`adapter`: `file` \| `http`) |

Agent contract: POST JSON `BuildBrief` → `{ ok, modules: { "priceQuote.ts": "..." } }`.
On REFUSE, NORTHPOLE re-posts with `resolve[]` from failed blocking criteria.

Still to generalize beyond the HL-002 `priceQuote` demo:

1. COSMIC-sourced work orders (`storyFromSpec` → probes)
2. Multi-file repo builds + `npm test` probes
3. ~~LOOPER epic/story emit with verification layer~~ ✅ `lib/jira/` — file + HTTP adapters

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
| `npm run test` | 54 unit + E2E tests |
| `npm run prioritize` | CLI ranked queue from seed |
| `npm run docker:up` | Build + run Docker pilot (`docker-compose.yml`) |

## CI

GitHub Actions: `npm ci` → seed → test → build on every push/PR to `main`.

## Health

`GET /api/health` — no unlock required.

## License

Apache-2.0 — see [LICENSE](LICENSE). Vendored components: [NOTICE](NOTICE).