# Security

## What this software does

LOOPER + NORTHPOLE is a **local-first** prioritization and build-governance demo.
The ranking core is **deterministic** (no LLM in the score path). The SQLite
ledger is **hash-chained** and verifiable via `npm test`.

## What it does NOT do

- **No telemetry** — no analytics, crash reporters, or phone-home endpoints.
- **No external API calls** in the prioritization or ledger paths.
- **No secrets in repo** — `.env` is gitignored; use `.env.example` for local config.
- **No production data** — seed initiatives are synthetic (`lib/agility/seed/`).

## Demo unlock gate

`/unlock` uses a courtesy code (`GATE_CODE`, default `333333`). This is **not**
production authentication. Replace with your IdP before any real deployment.

## Reporting vulnerabilities

Email the maintainer via the GitHub repository contact path. Do not open public
issues for undisclosed security concerns.

## Supply chain

- Run `npm ci` (lockfile-pinned).
- CI runs on every push/PR: seed → test → build.
- Review vendored code under `lib/luna/chamber/` if your org requires SBOM attestation.

## Enterprise deployment

Clone, audit, run offline. Enterprise adapters (Jira, Align, internal PaaS) belong
in a **private integration layer** — not in this public core.