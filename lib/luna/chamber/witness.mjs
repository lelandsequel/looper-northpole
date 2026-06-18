// 🌙 LUNA v2.0 — the Witness store. The atom everything else stands on.
//
// "LUNA v2.0 is a witness under oath." A Witness is an immutable observed fact:
// "at T, source S said P." Witnesses NEVER change — they are history. Beliefs are
// derived and mutable; Witnesses are not. This module defines that atom and the
// append-only store that seals each one into the receipt ledger (../ledger.mjs),
// so every memory carries a verifiable chain of custody ending in a signed Witness.
//
// Hard laws enforced here (Pan validates from artifacts):
//   • §0 REFUSAL — "A memory without a source is a rumor." A Witness with no
//     source/provenance is REJECTED. Never seal an unsourced witness.
//   • DUAL-CLOCK — observation_time (SEEN-at) and event_time (HAPPENED-at) are
//     two clocks and are NEVER conflated. Both arrive as explicit inputs.
//   • PASSIVE-FIRST — subject defaults to "UNKNOWN" and UNKNOWN is first-class.
//     Better to say "someone I don't recognize" than to misattribute a quote.
//   • DETERMINISM — no wall-clock reads, no randomness, no unordered Map/Set
//     iteration in any logic path. Same witness input ⇒ byte-identical record ⇒
//     identical id ⇒ identical receipt hash. A time value is always an input.
// 🐦‍⬛ + 🔑
import { createHash } from "node:crypto";
import { Ledger, hashPayload } from "./ledger.mjs";

// First-class, named constant — UNKNOWN subject is allowed and is the default.
export const UNKNOWN = "UNKNOWN";

// The ledger kind every Witness is sealed under. Stable on-chain label.
export const WITNESS_KIND = "WITNESS";

// Crockford base32 (ULID alphabet) — no I, L, O, U. Used to render the
// deterministic, sortable id. Encoding is pure: same bytes ⇒ same string.
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const sha256hex = (s) => createHash("sha256").update(s).digest("hex");

// Encode a non-negative integer into `len` Crockford base32 chars (big-endian,
// zero-padded). Deterministic, no randomness. seq drives lexical sort order so
// ids sort in append order — the ULID property we keep, minus the RNG tail.
function encodeBase32(num, len) {
  let n = BigInt(num);
  const out = new Array(len);
  const base = 32n;
  for (let i = len - 1; i >= 0; i--) {
    out[i] = CROCKFORD[Number(n % base)];
    n = n / base;
  }
  return out.join("");
}

// Encode the leading bytes of a hex string into Crockford base32 (for the id tail).
function hexToBase32(hex, len) {
  let n = BigInt("0x" + hex);
  const out = new Array(len);
  const base = 32n;
  for (let i = len - 1; i >= 0; i--) {
    out[i] = CROCKFORD[Number(n % base)];
    n = n / base;
  }
  return out.join("");
}

// The canonical content of a Witness — the fields that ARE the observation.
// This is exactly what gets hashed for the id and sealed as the ledger payload.
// Key insight: it carries NO id and NO receipt (those are derived FROM it), and
// NO wall-clock field — both clocks are explicit inputs. Order-independent hash
// (hashPayload canonicalizes), so field order never changes the result.
function canonicalContent(w) {
  return {
    kind: w.kind,
    content: w.content,
    subject: w.subject,
    source: { class: w.source.class, id: w.source.id },
    observation_time: w.observation_time, // SEEN-at — an input
    event_time: w.event_time,             // HAPPENED-at — an input, may differ
    boundary: w.boundary,
    consent_token: w.consent_token,
    provenance: w.provenance,
  };
}

// Derive the deterministic, ULID-like id: <12-char seq prefix><16-char hash tail>.
// seq prefix keeps ids monotonic & sortable; the hash tail binds the id to the
// witness content (tamper to content ⇒ different id). 28 chars, no randomness.
function deriveId(seq, contentSha) {
  const seqPart = encodeBase32(seq, 12);
  const hashPart = hexToBase32(contentSha.slice(0, 24), 16); // 96 content bits
  return seqPart + hashPart;
}

// Validate the §0 source/provenance floor. Returns null if ok, else a reason.
// A source is real only if it names BOTH a class and an id, and provenance must
// be present (the chain-of-custody that makes the witness more than a rumor).
function sourceRefusalReason(input) {
  const src = input?.source;
  if (!src || typeof src !== "object") return "no source (a memory without a source is a rumor)";
  const cls = src.class;
  const id = src.id;
  const has = (v) => typeof v === "string" && v.trim().length > 0;
  if (!has(cls)) return "source.class missing (unsourced witness rejected)";
  if (!has(id)) return "source.id missing (unsourced witness rejected)";
  // Provenance is the chain of custody; §0 requires it be witnessed, not blank.
  const prov = input?.provenance;
  const provOk =
    (typeof prov === "string" && prov.trim().length > 0) ||
    (Array.isArray(prov) && prov.length > 0) ||
    (prov && typeof prov === "object" && Object.keys(prov).length > 0);
  if (!provOk) return "no provenance (a memory without a source is a rumor)";
  return null;
}

// Thrown when §0 rejects a witness. Carries the reason so callers can surface it.
export class UnsourcedWitnessError extends Error {
  constructor(reason) {
    super(`§0 refusal: ${reason}`);
    this.name = "UnsourcedWitnessError";
    this.reason = reason;
  }
}

// Deep-freeze so a sealed Witness genuinely cannot be mutated (immutability law).
// Recurses arrays and plain objects. Idempotent. No iteration over Map/Set.
function deepFreeze(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  for (const key of Object.keys(obj)) deepFreeze(obj[key]);
  return Object.freeze(obj);
}

// The Witness store — append-only, ledger-backed.
//
//   const store = new WitnessStore();            // in-memory ledger
//   const store = new WitnessStore({ ledger });  // bring your own Ledger
//   const w = store.seal({ kind, content, source: {class, id},
//                          observation_time, event_time, ... });
//
// Every seal() appends a WITNESS event to the receipt ledger and stamps the
// returned receipt onto the (frozen) Witness. store.verify() walks the chain.
export class WitnessStore {
  constructor({ ledger, path = null } = {}) {
    // Reuse the chamber's hash-chained ledger as the receipt spine.
    this.ledger = ledger ?? new Ledger(path);
    // Local mirror of sealed witnesses, in append order (Array — ordered).
    this._witnesses = [];
  }

  // How many witnesses this store has sealed.
  get size() {
    return this._witnesses.length;
  }

  // The 1-based sequence the NEXT sealed witness will receive. Deterministic:
  // a function of how many witnesses already exist, nothing else.
  get nextSeq() {
    return this._witnesses.length + 1;
  }

  // Seal a Witness: validate §0, normalize, derive id, freeze, ledger-stamp.
  // `input` shape:
  //   { kind, content, subject?, source: { class, id },
  //     observation_time, event_time, boundary?, consent_token?, provenance }
  // observation_time and event_time are explicit inputs (NEVER read from a clock).
  // subject is optional and defaults to UNKNOWN. Throws UnsourcedWitnessError on §0.
  seal(input) {
    // §0 FLOOR — refuse the unsourced before anything else touches the chain.
    const refusal = sourceRefusalReason(input);
    if (refusal) throw new UnsourcedWitnessError(refusal);

    // Dual-clock: both are explicit inputs. We do NOT default one from the other
    // and we do NOT read the system clock. If event_time is absent it stays the
    // explicit value the caller passed (including null) — never silently == obs.
    const observation_time = input.observation_time;
    const event_time = Object.prototype.hasOwnProperty.call(input, "event_time")
      ? input.event_time
      : null;

    // Passive-first: UNKNOWN subject is first-class and the default.
    const hasSubject =
      typeof input.subject === "string" && input.subject.trim().length > 0;
    const subject = hasSubject ? input.subject : UNKNOWN;

    const seq = this.nextSeq;

    // Build the canonical content (no id, no receipt, no wall-clock).
    const content = canonicalContent({
      kind: input.kind,
      content: input.content,
      subject,
      source: input.source,
      observation_time,
      event_time,
      boundary: input.boundary ?? null,
      consent_token: input.consent_token ?? null,
      provenance: input.provenance,
    });

    // Deterministic id from seq + content hash. hashPayload canonicalizes, so the
    // id does not depend on key insertion order — only on the values themselves.
    const contentSha = hashPayload(content);
    const id = deriveId(seq, contentSha);

    // Seal into the receipt ledger. The payload is { id, ...content } so the
    // witness id is itself on-chain. The ledger's sha = f(parent, seq, kind,
    // payload_sha) — and payload_sha is order-independent — so two stores fed the
    // SAME inputs in the SAME order produce the SAME receipt sha (determinism).
    // NB: the ledger event also carries a wall-clock `ts`, but `ts` is NOT part
    // of the sha, so the receipt hash stays byte-stable across runs.
    const receiptEvent = this.ledger.append(WITNESS_KIND, { id, ...content });

    // The witness, assembled. content_sha lets us re-derive/verify without the
    // ledger; receipt is the chain-of-custody stamp.
    const witness = {
      id,
      seq,
      kind: content.kind,
      content: content.content,
      subject: content.subject,
      source: content.source,
      observation_time: content.observation_time,
      event_time: content.event_time,
      boundary: content.boundary,
      consent_token: content.consent_token,
      provenance: content.provenance,
      content_sha: contentSha,
      receipt: {
        seq: receiptEvent.seq,
        kind: receiptEvent.kind,
        payload_sha: receiptEvent.payload_sha,
        parent_sha: receiptEvent.parent_sha,
        sha: receiptEvent.sha,
      },
    };

    // Immutable once sealed — the whole point of a Witness.
    deepFreeze(witness);
    this._witnesses.push(witness);
    return witness;
  }

  // The sealed witnesses, in append order (frozen array — safe to hand out).
  all() {
    return Object.freeze(this._witnesses.slice());
  }

  // Look up a sealed witness by its id. Linear, order-independent of internals.
  get(id) {
    return this._witnesses.find((w) => w.id === id) ?? null;
  }

  // Tamper-evidence: walk the receipt chain. Returns the ledger's verdict
  // ({ ok, count, head } | { ok:false, at, reason }). If any sealed witness's
  // payload was altered on-chain, or a link was cut, this returns ok:false.
  verify() {
    return this.ledger.verify();
  }

  // Independent witness-level proof: re-derive each witness's id and receipt sha
  // from its own (frozen) content and confirm they still match what's on-chain.
  // Catches mutation even if someone rebuilt the ledger event in lockstep.
  verifyWitness(id) {
    const w = this.get(id);
    if (!w) return { ok: false, reason: "no such witness" };
    const content = canonicalContent(w);
    const contentSha = hashPayload(content);
    if (contentSha !== w.content_sha) {
      return { ok: false, id, reason: "content_sha mismatch (witness content altered)" };
    }
    if (deriveId(w.seq, contentSha) !== w.id) {
      return { ok: false, id, reason: "id no longer derives from content (tamper)" };
    }
    const expectPayloadSha = hashPayload({ id: w.id, ...content });
    if (expectPayloadSha !== w.receipt.payload_sha) {
      return { ok: false, id, reason: "receipt payload_sha mismatch (tamper)" };
    }
    const expectSha = sha256hex(
      `${w.receipt.parent_sha ?? "GENESIS"}|${w.receipt.seq}|${w.receipt.kind}|${expectPayloadSha}`
    );
    if (expectSha !== w.receipt.sha) {
      return { ok: false, id, reason: "receipt sha mismatch (tamper)" };
    }
    return { ok: true, id };
  }
}

// Functional convenience: derive the id a witness input WOULD get at a given seq,
// without sealing it. Pure — exposed so callers/tests can assert determinism.
export function previewId(input, seq) {
  const refusal = sourceRefusalReason(input);
  if (refusal) throw new UnsourcedWitnessError(refusal);
  const hasSubject =
    typeof input.subject === "string" && input.subject.trim().length > 0;
  const event_time = Object.prototype.hasOwnProperty.call(input, "event_time")
    ? input.event_time
    : null;
  const content = canonicalContent({
    kind: input.kind,
    content: input.content,
    subject: hasSubject ? input.subject : UNKNOWN,
    source: input.source,
    observation_time: input.observation_time,
    event_time,
    boundary: input.boundary ?? null,
    consent_token: input.consent_token ?? null,
    provenance: input.provenance,
  });
  return deriveId(seq, hashPayload(content));
}
