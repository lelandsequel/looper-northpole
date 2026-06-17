import fs from "node:fs";
import Database from "better-sqlite3";

import { DATA_DIR, DB_PATH } from "./paths";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  migrate(db);
  return db;
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS initiatives (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ledger_events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      prev TEXT,
      sha TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cosmic_runs (
      id TEXT PRIMARY KEY,
      initiative_id TEXT NOT NULL,
      run_hash TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS build_runs (
      id TEXT PRIMARY KEY,
      initiative_id TEXT NOT NULL,
      status TEXT NOT NULL,
      payload TEXT NOT NULL,
      ledger_head TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS build_tasks (
      id TEXT PRIMARY KEY,
      initiative_id TEXT NOT NULL,
      agent TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payload TEXT NOT NULL,
      witness_sha TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      claimed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS strata_audits (
      id TEXT PRIMARY KEY,
      query_hash TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}