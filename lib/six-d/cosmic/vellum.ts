// 📜 VELLUM — provenance binding (COSMIC pattern; no standalone repo).
//
// There is NO VELLUM repo to import (confirmed in the design memo). VELLUM is a
// PATTERN, implemented here from doctrine: every artifact element's bare
// `sourceRefs: string[]` (6D v1) become source+hash BINDINGS. A binding resolves a
// ref to a concrete source atom (or upstream element) and records that source's
// content hash. An element with at least one ref but NO resolvable binding — or no
// refs at all — is UNBOUND: it cannot ship as fact and must be gated by AURORA.
//
// This is the "you define truth; we refuse what can't be bound to it" floor from
// the Scott round-2 pitch, made structural: the semantic source set IS the truth,
// and VELLUM marks anything that doesn't bind back to it.
//
// Doctrine reference: the chamber's COSMIC-grounding check (heimdall.mjs `cosmic()`)
// requires every claim to cite evidence that is present & verified. VELLUM is the
// 6D-artifact analogue: cite a source atom that exists, and hash-bind to it.
//
// Deterministic: hashes via sha256Hex over canonical content; no clock, no network.
// 🐦‍⬛ + 🔑

import { sha256Hex } from "../helpers";
import type { ArtifactElement, IntentRef, PhaseArtifact, RunManifest } from "../types";

/** One resolved (or failed) provenance binding for a single sourceRef. */
export type SourceBinding = {
  ref: string; // the sourceRef id as written on the element
  resolved: boolean; // did `ref` point at a real source atom / upstream element?
  sourceKind: "intent" | "element" | "unresolved";
  sourceHash: string | null; // sha256 of the bound source's content, or null if unresolved
};

/** VELLUM verdict for a single element. */
export type ProvenanceStatus = "BOUND" | "UNBOUND";

export type ElementProvenance = {
  elementId: string;
  phase: string;
  status: ProvenanceStatus;
  bindings: SourceBinding[];
  /** Human reason when UNBOUND (no refs / none resolvable). */
  reason?: string;
};

/** Canonical text used to hash a source atom or an upstream element. */
const intentContent = (a: IntentRef): string => `${a.kind}:${a.text}`;
const elementContent = (e: ArtifactElement): string =>
  // Element identity for provenance = what it claims + where it claims to come from.
  `${e.kind}:${e.title ?? ""}:${e.body}:${e.sourceRefs.join(",")}`;

/** Build the resolvable universe: intent atoms + every element by id. */
function buildSourceIndex(manifest: RunManifest): {
  intent: Map<string, IntentRef>;
  elements: Map<string, ArtifactElement>;
} {
  const intent = new Map<string, IntentRef>();
  for (const a of manifest.intentIndex) intent.set(a.id, a);
  const elements = new Map<string, ArtifactElement>();
  for (const art of manifest.artifacts) for (const e of art.elements) elements.set(e.id, e);
  return { intent, elements };
}

/**
 * Bind every element in the manifest to its sources and classify BOUND/UNBOUND.
 * An element is BOUND iff it has ≥1 ref AND ≥1 of its refs resolves to a real
 * source (intent atom or upstream element). Otherwise UNBOUND.
 *
 * Async because content hashing uses WebCrypto (sha256Hex).
 */
export async function bindProvenance(manifest: RunManifest): Promise<ElementProvenance[]> {
  const { intent, elements } = buildSourceIndex(manifest);
  const out: ElementProvenance[] = [];

  for (const art of manifest.artifacts) {
    for (const e of art.elements) {
      const bindings: SourceBinding[] = [];
      for (const ref of e.sourceRefs) {
        const atom = intent.get(ref);
        if (atom) {
          bindings.push({
            ref,
            resolved: true,
            sourceKind: "intent",
            sourceHash: await sha256Hex(intentContent(atom)),
          });
          continue;
        }
        const upstream = elements.get(ref);
        if (upstream && upstream.id !== e.id) {
          bindings.push({
            ref,
            resolved: true,
            sourceKind: "element",
            sourceHash: await sha256Hex(elementContent(upstream)),
          });
          continue;
        }
        bindings.push({ ref, resolved: false, sourceKind: "unresolved", sourceHash: null });
      }

      const anyResolved = bindings.some((b) => b.resolved);
      const status: ProvenanceStatus = anyResolved ? "BOUND" : "UNBOUND";
      const prov: ElementProvenance = { elementId: e.id, phase: art.phase, status, bindings };
      if (status === "UNBOUND") {
        prov.reason = e.sourceRefs.length
          ? `none of ${e.sourceRefs.length} sourceRef(s) resolve to a known source`
          : "element carries no sourceRefs";
      }
      out.push(prov);
    }
  }
  return out;
}

/** Convenience: just the UNBOUND elements. */
export const unboundElements = (prov: ElementProvenance[]): ElementProvenance[] =>
  prov.filter((p) => p.status === "UNBOUND");

/** Index provenance by elementId for downstream gating. */
export const provenanceById = (prov: ElementProvenance[]): Map<string, ElementProvenance> => {
  const m = new Map<string, ElementProvenance>();
  for (const p of prov) m.set(p.elementId, p);
  return m;
};

/**
 * Stable, hashable summary of a phase's provenance — folded into the AURORA
 * verdict payload so the ledger seal moves if any binding changes.
 */
export const phaseProvenanceDigestInput = (
  phase: PhaseArtifact,
  byId: Map<string, ElementProvenance>,
): Array<{ id: string; status: ProvenanceStatus; bound: string[] }> =>
  phase.elements.map((e) => {
    const p = byId.get(e.id);
    return {
      id: e.id,
      status: p?.status ?? "UNBOUND",
      bound: (p?.bindings ?? []).filter((b) => b.resolved).map((b) => b.sourceHash as string),
    };
  });
