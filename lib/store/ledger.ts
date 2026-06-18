import { createHash } from "node:crypto";

import { getDb } from "./db";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export interface StoredLedgerEvent {
  seq: number;
  kind: string;
  payload: Record<string, unknown>;
  prev: string | null;
  sha: string;
}

export function loadLedgerEvents(): StoredLedgerEvent[] {
  const rows = getDb()
    .prepare("SELECT seq, kind, payload, prev, sha FROM ledger_events ORDER BY seq ASC")
    .all() as Array<{
    seq: number;
    kind: string;
    payload: string;
    prev: string | null;
    sha: string;
  }>;
  return rows.map((r) => ({
    seq: r.seq,
    kind: r.kind,
    payload: JSON.parse(r.payload) as Record<string, unknown>,
    prev: r.prev,
    sha: r.sha,
  }));
}

export function appendLedgerEvent(kind: string, payload: Record<string, unknown>): StoredLedgerEvent {
  const events = loadLedgerEvents();
  const prev = events.length ? events[events.length - 1].sha : null;
  const seq = events.length;
  const body = JSON.stringify({ seq, kind, payload, prev });
  const hash = sha(body);
  getDb()
    .prepare("INSERT INTO ledger_events (kind, payload, prev, sha) VALUES (?, ?, ?, ?)")
    .run(kind, JSON.stringify(payload), prev, hash);
  return { seq, kind, payload, prev, sha: hash };
}

export function verifyLedger(): { ok: boolean; count: number; head: string | null; brokeAt?: number; reason?: string } {
  const events = loadLedgerEvents();
  let prev: string | null = null;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    // Hashes use append-time index (0-based), not SQLite AUTOINCREMENT id.
    const body = JSON.stringify({ seq: i, kind: e.kind, payload: e.payload, prev });
    if (sha(body) !== e.sha) return { ok: false, brokeAt: i, reason: "hash mismatch", count: events.length, head: null };
    if (e.prev !== prev) return { ok: false, brokeAt: i, reason: "broken link", count: events.length, head: null };
    prev = e.sha;
  }
  return { ok: true, count: events.length, head: prev };
}

export function receiptsForInitiative(id: string): StoredLedgerEvent[] {
  return loadLedgerEvents().filter((e) => e.payload?.id === id);
}