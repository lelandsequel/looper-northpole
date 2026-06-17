// 🌙 LUNA — append-only, hash-chained receipt ledger (COSMIC port).
//
// The chain IS the product. Each entry's parentHash == the prior entry's hash, so
// history can't be altered without snapping the chain. verify() walks every link
// and names the entry that broke. This replaces the 6D v1 single-run sha
// (engine.ts `receipt`) with a real tamper-evident chain of ALL runs.
//
// PORTED — not imported — from ~/projects/luna/ledger.mjs (the canonical chamber
// Ledger). What changed, and why, vs the original:
//   • node:crypto `createHash` → `sha256Hex` from ../helpers (WebCrypto; browser-safe).
//     Because of that, append/verify are ASYNC (subtle.digest is async).
//   • `new Date().toISOString()` timestamp → REMOVED from the chained material.
//     The original stamps `ts` into each event; a clock would break the 6D run-path
//     determinism contract (same intent → same chain hash). LUNA's chain integrity
//     never depended on the timestamp (it was carried alongside, not hashed), so the
//     chain semantics are preserved exactly — the seal is over parent|seq|kind|payloadHash.
//   • node:fs persistence → an injectable `LedgerStore` (default in-memory). Keeps the
//     ledger runnable in the browser and in `tsx --test` with zero I/O in the run path,
//     while still supporting an append-only persisted store when a host provides one.
//
// The structural guarantees the original makes — order-independent payload hash,
// parent-links every entry, verify() returns the first broken seq — are kept 1:1.
// 🐦‍⬛ + 🔑

import { sha256Hex, stableStringify } from "../helpers";

/** One sealed link in the chain. */
export type LedgerEntry = {
  seq: number; // 1-based position
  kind: string; // event kind, e.g. "6d.run"
  payloadHash: string; // sha256 of the canonical payload (order-independent)
  parentHash: string | null; // prior entry's `hash`, or null at genesis
  hash: string; // sha256(parentHash|seq|kind|payloadHash)
  /** The payload itself, carried alongside (NOT part of `hash` — only its digest is). */
  payload: unknown;
};

export type VerifyOk = { ok: true; count: number; head: string | null };
export type VerifyBroken = { ok: false; at: number; reason: string };
export type VerifyResult = VerifyOk | VerifyBroken;

/**
 * Order-independent hash of a payload (canonical JSON), via the shared
 * stableStringify + sha256Hex so it agrees byte-for-byte with the rest of 6D.
 * Mirrors LUNA's `hashPayload` (sorted keys, arrays keep order).
 */
export const hashPayload = (payload: unknown): Promise<string> =>
  sha256Hex(stableStringify(payload));

/** The material that is actually sealed into a link's `hash`. */
const sealMaterial = (
  parentHash: string | null,
  seq: number,
  kind: string,
  payloadHash: string,
): string => `${parentHash ?? "GENESIS"}|${seq}|${kind}|${payloadHash}`;

/**
 * Pluggable persistence. The default is in-memory (deterministic, no I/O).
 * A host may supply an append-only store (e.g. a JSONL file) without changing
 * the run path; reads happen at construction, the single write at append().
 */
export interface LedgerStore {
  load(): LedgerEntry[];
  append(entry: LedgerEntry): void;
}

export class MemoryLedgerStore implements LedgerStore {
  private entries: LedgerEntry[] = [];
  constructor(seed: LedgerEntry[] = []) {
    this.entries = [...seed];
  }
  load(): LedgerEntry[] {
    return [...this.entries];
  }
  append(entry: LedgerEntry): void {
    this.entries.push(entry);
  }
}

/**
 * Append-only, hash-chained ledger. Construct fresh (in-memory) or over a store
 * that already holds prior entries; either way `verify()` walks the full chain.
 */
export class Ledger {
  private entries: LedgerEntry[];
  constructor(private store: LedgerStore = new MemoryLedgerStore()) {
    this.entries = store.load();
  }

  get head(): LedgerEntry | null {
    return this.entries.length ? this.entries[this.entries.length - 1] : null;
  }

  get all(): LedgerEntry[] {
    return [...this.entries];
  }

  get length(): number {
    return this.entries.length;
  }

  /** Append one entry, rebased onto the current head. Returns the sealed entry. */
  async append(kind: string, payload: unknown): Promise<LedgerEntry> {
    const parentHash = this.head ? this.head.hash : null;
    const seq = this.entries.length + 1;
    const payloadHash = await hashPayload(payload);
    const hash = await sha256Hex(sealMaterial(parentHash, seq, kind, payloadHash));
    const entry: LedgerEntry = { seq, kind, payloadHash, parentHash, hash, payload };
    this.entries.push(entry);
    this.store.append(entry);
    return entry;
  }

  /** Find by entry hash or payload hash (LUNA `find` parity). */
  find(hash: string): LedgerEntry | undefined {
    return this.entries.find((e) => e.hash === hash || e.payloadHash === hash);
  }

  /**
   * Walk the whole chain: every parent-link AND every entry's own seal must hold.
   * Returns the first seq that broke, distinguishing a snapped link (parent
   * mismatch) from an altered payload (seal mismatch) — exactly like LUNA.verify().
   */
  async verify(): Promise<VerifyResult> {
    let parent: string | null = null;
    for (const e of this.entries) {
      if (e.parentHash !== parent) {
        return { ok: false, at: e.seq, reason: "chain broken (parentHash mismatch)" };
      }
      // Recompute the payload digest from the carried payload — catches tampering
      // with payload contents even if payloadHash/hash were left consistent.
      const freshPayloadHash = await hashPayload(e.payload);
      if (freshPayloadHash !== e.payloadHash) {
        return { ok: false, at: e.seq, reason: "tamper (payload altered — payloadHash mismatch)" };
      }
      const expect = await sha256Hex(sealMaterial(e.parentHash, e.seq, e.kind, e.payloadHash));
      if (expect !== e.hash) {
        return { ok: false, at: e.seq, reason: "tamper (seal mismatch — entry hash altered)" };
      }
      parent = e.hash;
    }
    return { ok: true, count: this.entries.length, head: this.head?.hash ?? null };
  }
}
