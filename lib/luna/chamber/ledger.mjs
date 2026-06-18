// 🌙 LUNA — append-only, hash-chained receipt ledger.
// The chain IS the product. Each event's parent_sha == the prior event's sha, so
// history can't be altered without snapping the chain. This is what lets LUNA say
// "here's the proof" and mean it. The bird carries forward in every link. 🐦‍⬛
import { createHash } from "node:crypto";
import fs from "node:fs";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

// Stable, order-independent hash of a payload (canonical JSON).
export function hashPayload(payload) {
  const canon = (v) => {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === "object") {
      return Object.keys(v).sort().reduce((o, k) => ((o[k] = canon(v[k])), o), {});
    }
    return v;
  };
  return sha256(JSON.stringify(canon(payload)));
}

export class Ledger {
  // path optional — pass null/undefined for an in-memory ledger (tests/demo).
  constructor(path = null) {
    this.path = path;
    this.events = [];
    if (path && fs.existsSync(path)) {
      this.events = fs.readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    }
  }

  get head() {
    return this.events.length ? this.events[this.events.length - 1] : null;
  }

  // Append one event, rebased onto the current head — returns the sealed event.
  append(kind, payload) {
    const parent_sha = this.head ? this.head.sha : null;
    const seq = this.events.length + 1;
    const ts = new Date().toISOString();
    const payload_sha = hashPayload(payload);
    const sha = sha256(`${parent_sha ?? "GENESIS"}|${seq}|${kind}|${payload_sha}`);
    const event = { seq, ts, kind, payload, payload_sha, parent_sha, sha };
    this.events.push(event);
    if (this.path) fs.appendFileSync(this.path, JSON.stringify(event) + "\n");
    return event;
  }

  find(sha) {
    return this.events.find((e) => e.sha === sha || e.payload_sha === sha);
  }

  // Walk the whole chain: every link + every event's own hash must hold.
  verify() {
    let parent = null;
    for (const e of this.events) {
      if (e.parent_sha !== parent) return { ok: false, at: e.seq, reason: "chain broken (parent_sha mismatch)" };
      const expect = sha256(`${e.parent_sha ?? "GENESIS"}|${e.seq}|${e.kind}|${hashPayload(e.payload)}`);
      if (expect !== e.sha) return { ok: false, at: e.seq, reason: "tamper (sha mismatch — payload altered)" };
      parent = e.sha;
    }
    return { ok: true, count: this.events.length, head: this.head?.sha ?? null };
  }
}
