# LOOPER → Jira Emit Adapter

Verification-first epic/story emission from sealed 6D COSMIC specs.

## Pipeline

```
COSMIC run (stored) → extract → verify → emit (file | http) → ledger + jira_emits
```

## Extract

Source: `CosmicRun.manifest` Distribute phase.

| Element | Maps to |
|---------|---------|
| `epic` | Jira epic (title, description) |
| `story` | Jira story (title, body, estimate, labels, dependsOn) |
| Define `acceptance_criterion` via `story.fields.acRefs` | Story acceptance criteria |

Provenance: `specReceipt` (LUNA chain head) + `cosmicRunHash`.

## Verify (refuse if any)

1. `specReceipt` missing or not a 64-char hex hash
2. No epic or no stories in Distribute
3. Any story with zero acceptance criteria
4. Any blocking open question in the manifest
5. AURORA `REFUSE` on Distribute elements or artifact
6. Any blocking AURORA outstanding need (`openIssuesFrom`)

Pass → deterministic `emitHash = sha256(stableStringify(payload))`.

## Emit adapters

| Adapter | When | Output |
|---------|------|--------|
| `file` (default) | Always after verify | `data/jira-emits/{initiativeId}-{hashPrefix}.json` |
| `http` | `JIRA_BASE_URL` + `JIRA_EMAIL` + `JIRA_API_TOKEN` set | Jira REST API v3 epic + stories |

## Persistence

- SQLite `jira_emits` table (one row per emit attempt that passed verify)
- Ledger event `jira.emit` with `emitHash`, adapter, artifact

## API

- `GET /api/jira/emit/preview?initiativeId=HL-001`
- `POST /api/jira/emit` body `{ initiativeId, adapter?: "file" | "http" }`

## Env (HTTP only)

```
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=you@company.com
JIRA_API_TOKEN=...
JIRA_PROJECT_KEY=HL   # optional, default HL
```