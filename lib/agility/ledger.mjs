// OMNIS Agility — the decision ledger.
//
// This is the "defendable, reportable" part, made literal. Every intake, every
// duplicate flag, every score, every funding call becomes an append-only event
// hash-chained to the one before it. You cannot quietly change a past decision
// without breaking the chain — verify() catches it. So when a stakeholder asks
// "why was MY thing not prioritized?", the answer isn't a vibe; it's a receipt
// with a hash.
//
// (Same discipline as LUNA's ledger — the chain IS the record.)

import { createHash } from "node:crypto";

const sha = (s) => createHash("sha256").update(s).digest("hex");

export class Ledger {
  constructor() {
    this.events = [];
  }

  get head() {
    return this.events.length ? this.events[this.events.length - 1] : null;
  }

  /** Append an event; returns its receipt (sha). */
  append(kind, payload) {
    const prev = this.head ? this.head.sha : null;
    const seq = this.events.length;
    const body = JSON.stringify({ seq, kind, payload, prev });
    const s = sha(body);
    this.events.push({ seq, kind, payload, prev, sha: s });
    return s;
  }

  /** Walk the chain; tamper-evident. */
  verify() {
    let prev = null;
    for (let i = 0; i < this.events.length; i++) {
      const e = this.events[i];
      const body = JSON.stringify({ seq: e.seq, kind: e.kind, payload: e.payload, prev });
      if (sha(body) !== e.sha) return { ok: false, brokeAt: i, reason: "hash mismatch" };
      if (e.prev !== prev) return { ok: false, brokeAt: i, reason: "broken link" };
      prev = e.sha;
    }
    return { ok: true, count: this.events.length, head: this.head ? this.head.sha : null };
  }

  /** All events for one initiative id, with short receipts. */
  receiptsFor(id) {
    return this.events
      .filter((e) => e.payload && e.payload.id === id)
      .map((e) => ({ kind: e.kind, sha: e.sha, short: e.sha.slice(0, 12), payload: e.payload }));
  }
}

export { sha };
