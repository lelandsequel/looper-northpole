// 6D Semantic Layer — NEBULA action-suite (PORTED), pointed at intent mentions.
//
// PORTED, not imported, from ~/projects/nebula/engines/*.mjs (the chamber's
// canonical entity-reconciliation suite). The originals are ESM `.mjs` with a
// Node-`crypto` dependency and a (records → companies) domain shape. What was
// ported, and what changed and why:
//
//   • COALESCE (coalesce.mjs) — union-find over deterministic blocking keys.
//     PORTED 1:1 in spirit. Original blocks on name/email-domain/phone; we block
//     on lemmaKey / headNoun (morphology.ts). The union-find merge engine is the
//     same data structure and the same "share any strong key → union" rule.
//   • SIEVE (sieve.mjs) — refuse-to-guess partition. PORTED & STRENGTHENED into a
//     precision-RANKED sieve, matching Stanford's deterministic coref sieve
//     (Raghunathan/Lee 2013): a merge backed only by a low-precision signal is
//     routed to `review`, not forced. Original required ≥2 corroborating signals;
//     we rank signals by precision (head-noun exact > lemma exact > shared-token)
//     and keep the same "won't auto-merge on a coincidence" floor.
//   • ACCRETE (accrete.mjs) — choose the best variant per field. PORTED: original
//     keeps the longest/most-formal name; we keep the longest surface mention as
//     the canonical label and union every variant's provenance.
//   • BEACON (beacon.mjs) — mint canonical name + stable, collision-free id.
//     PORTED, minus the corporate-suffix fixups (we name actors/systems, not LLCs).
//   • WAKE (wake.mjs) — provenance trail + audit hash. PORTED, with the hash
//     swapped from Node `crypto.createHash` to a pure synchronous FNV-1a over the
//     shared `stableStringify`. WHY: the 6D parse path is a *synchronous* pure
//     transform compared with deepStrictEqual in tests; WebCrypto (used elsewhere
//     in this repo) is async. FNV-1a is deterministic, dependency-free, and keeps
//     the WAKE guarantee ("nothing leaves unaccounted") without forcing async up
//     the whole semantic pipeline. The trail structure is preserved 1:1.
//
// Pure: no clock, no randomness, no network. Same mentions in → same entities out.

import { stableStringify } from "../helpers";
import { headNoun, lemmaKey, titleCaseKey } from "./morphology";

/** A raw mention of an entity, located back in the intent for provenance. */
export type Mention = {
  /** The surface text exactly as it appeared. */
  surface: string;
  /** The intent atom id this mention was found in (e.g. "intent.goal.2"). */
  sourceRef: string;
  /** Character offset within that atom — stable secondary sort key. */
  at: number;
  /** "actor" | "system" | "action" — the role this mention plays. */
  role: EntityRole;
};

export type EntityRole = "actor" | "system" | "action";

/** A reconciled, canonical, provenance-stamped entity. The NEBULA output. */
export type CanonicalEntity = {
  /** Stable, collision-free id (BEACON). e.g. "ent_actor_agent". */
  id: string;
  /** Presentable canonical label (ACCRETE longest variant → BEACON titlecase). */
  display: string;
  role: EntityRole;
  /** The morphological merge key all variants share. */
  key: string;
  /** Every distinct surface form that reconciled into this entity, sorted. */
  variants: string[];
  /** Intent atom ids that mentioned this entity, de-duped + sorted (provenance). */
  sourceRefs: string[];
  /** WAKE trail: which mentions merged, by what signal, with an audit hash. */
  wake: WakeTrail;
};

export type MergeSignal = "head-noun" | "lemma-exact" | "shared-token";

export type WakeTrail = {
  reconciledFrom: Array<{ surface: string; sourceRef: string; at: number }>;
  /** The precision signal that justified the merge cluster. */
  signal: MergeSignal | "solo";
  transforms: string[];
  auditHash: string;
};

/** A cluster the sieve refused to auto-merge — surfaced, never silently dropped. */
export type ReviewItem = {
  needsReview: true;
  role: EntityRole;
  why: string;
  candidates: Array<{ surface: string; sourceRef: string }>;
};

export type ReconcileResult = {
  entities: CanonicalEntity[];
  review: ReviewItem[];
};

// ── Pure synchronous audit hash (WAKE) ───────────────────────────────────────
// FNV-1a (32-bit) over canonical JSON. Deterministic, sync, dependency-free.
const fnv1a = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
};
const auditHash = (v: unknown): string => fnv1a(stableStringify(v));

// ── COALESCE: union-find over blocking keys ──────────────────────────────────

type Cluster = { indices: number[]; signal: MergeSignal | "solo" };

/**
 * Group mentions of the same role into clusters by shared blocking key.
 * Highest-precision key first (head noun), then full lemma key. Mirrors
 * COALESCE's "share any strong key → union", with the precision recorded so the
 * sieve can rank it.
 */
function coalesce(mentions: Mention[]): Cluster[] {
  const n = mentions.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb); // lower index wins → stable
  };

  // Bucket by each key kind; mentions sharing a bucket get unioned.
  const headBuckets = new Map<string, number[]>();
  const lemmaBuckets = new Map<string, number[]>();
  mentions.forEach((m, i) => {
    const h = headNoun(m.surface);
    const k = lemmaKey(m.surface);
    if (h) (headBuckets.get(h) ?? headBuckets.set(h, []).get(h)!).push(i);
    if (k) (lemmaBuckets.get(k) ?? lemmaBuckets.set(k, []).get(k)!).push(i);
  });
  for (const idxs of lemmaBuckets.values())
    for (let j = 1; j < idxs.length; j++) union(idxs[0], idxs[j]);
  for (const idxs of headBuckets.values())
    for (let j = 1; j < idxs.length; j++) union(idxs[0], idxs[j]);

  // Collect clusters by root, in stable (lowest-index-first) order.
  const byRoot = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    (byRoot.get(r) ?? byRoot.set(r, []).get(r)!).push(i);
  }
  const clusters: Cluster[] = [];
  for (const indices of byRoot.values()) {
    indices.sort((a, b) => a - b);
    clusters.push({ indices, signal: clusterSignal(mentions, indices) });
  }
  // Deterministic cluster order: by first member index.
  clusters.sort((a, b) => a.indices[0] - b.indices[0]);
  return clusters;
}

/** The highest-precision signal that holds across a cluster (the sieve's rank). */
function clusterSignal(mentions: Mention[], indices: number[]): MergeSignal | "solo" {
  if (indices.length === 1) return "solo";
  const heads = new Set(indices.map((i) => headNoun(mentions[i].surface)));
  const lemmas = new Set(indices.map((i) => lemmaKey(mentions[i].surface)));
  if (lemmas.size === 1) return "lemma-exact"; // all variants reduce identically
  if (heads.size === 1) return "head-noun"; // same head, different qualifiers
  return "shared-token"; // unioned transitively via partial overlap
}

// ── SIEVE: precision-ranked refuse-to-guess ──────────────────────────────────
// head-noun / lemma-exact are high precision → auto. shared-token is the
// coincidence-risk class → review (a human decides if "audit log" and "access
// log" are one system). This is NEBULA's "won't auto-merge without corroboration"
// floor, ranked the way Stanford's deterministic coref sieve ranks its passes.

const AUTO_SIGNALS = new Set<MergeSignal | "solo">(["solo", "lemma-exact", "head-noun"]);

// ── ACCRETE + BEACON + WAKE: build the canonical entity ──────────────────────

function buildEntity(
  mentions: Mention[],
  cluster: Cluster,
  taken: Set<string>,
): CanonicalEntity {
  const members = cluster.indices.map((i) => mentions[i]);
  const role = members[0].role;

  // ACCRETE: the canonical label is the longest surface variant (most complete),
  // ties broken by earliest appearance — deterministic.
  const sortedByLabel = [...members].sort(
    (a, b) => b.surface.length - a.surface.length || a.at - b.at || a.sourceRef.localeCompare(b.sourceRef),
  );
  const key = lemmaKey(sortedByLabel[0].surface) || headNoun(sortedByLabel[0].surface) || fold0(sortedByLabel[0].surface);
  const display = titleCaseKey(key) || sortedByLabel[0].surface;

  // BEACON: stable, collision-free id namespaced by role.
  const slugBase = `ent_${role}_${(key || display).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}` || `ent_${role}`;
  let id = slugBase;
  let nth = 2;
  while (taken.has(id)) id = `${slugBase}_${nth++}`;
  taken.add(id);

  const variants = [...new Set(members.map((m) => m.surface))].sort();
  const sourceRefs = [...new Set(members.map((m) => m.sourceRef))].sort();

  // WAKE: leave the trail. Reconstruct where it came from + audit hash.
  const reconciledFrom = members
    .map((m) => ({ surface: m.surface, sourceRef: m.sourceRef, at: m.at }))
    .sort((a, b) => a.sourceRef.localeCompare(b.sourceRef) || a.at - b.at);
  const trailSansHash = {
    reconciledFrom,
    signal: cluster.signal,
    transforms: ["coalesce", "accrete", "beacon"],
  };
  const wake: WakeTrail = {
    ...trailSansHash,
    auditHash: auditHash({ id, display, role, key, variants, sourceRefs, trail: trailSansHash }),
  };

  return { id, display, role, key, variants, sourceRefs, wake };
}

const fold0 = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

// ── The pipe: mentions → reconciled entities + review queue ───────────────────

/**
 * Reconcile a set of role-tagged mentions into canonical entities. Mentions of
 * different roles never merge. Deterministic end-to-end.
 */
export function reconcile(mentions: Mention[]): ReconcileResult {
  const entities: CanonicalEntity[] = [];
  const review: ReviewItem[] = [];
  const taken = new Set<string>();

  // Partition by role so an "audit" action never merges with an "auditor" actor.
  const roles: EntityRole[] = ["actor", "system", "action"];
  for (const role of roles) {
    const roleMentions = mentions.filter((m) => m.role === role);
    if (!roleMentions.length) continue;
    const clusters = coalesce(roleMentions);
    for (const cluster of clusters) {
      if (AUTO_SIGNALS.has(cluster.signal)) {
        entities.push(buildEntity(roleMentions, cluster, taken));
      } else {
        const members = cluster.indices.map((i) => roleMentions[i]);
        review.push({
          needsReview: true,
          role,
          why: `merged only on a "${cluster.signal}" signal (partial overlap, no shared head noun) — NEBULA refuses to auto-collapse these into one entity without a human call.`,
          candidates: members.map((m) => ({ surface: m.surface, sourceRef: m.sourceRef })),
        });
      }
    }
  }

  // Stable output order: by id.
  entities.sort((a, b) => a.id.localeCompare(b.id));
  return { entities, review };
}
