#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { INITIATIVES } from "../lib/agility/seed/initiatives.mjs";

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "looper-northpole.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS initiatives (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS ledger_events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    prev TEXT,
    sha TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
db.prepare("DELETE FROM initiatives").run();
db.prepare("DELETE FROM ledger_events").run();
const insert = db.prepare("INSERT INTO initiatives (id, payload) VALUES (?, ?)");
for (const it of INITIATIVES.filter((i) => i.id !== "HL-013")) insert.run(it.id, JSON.stringify(it));
console.log(`seeded ${INITIATIVES.length - 1} initiatives`);
db.close();