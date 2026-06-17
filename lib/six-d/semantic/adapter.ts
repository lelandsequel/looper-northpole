// 6D Semantic Layer — phase-consumption adapter.
//
// Shows, concretely, how a 6D phase consumes the IntentSemanticModel INSTEAD of
// the keyword helpers — without rewiring live v1. These are thin, deterministic
// accessors that a COSMIC-native phase calls in place of `actorsIn`/`bucketsFor`.
// They demonstrate the upgrade: an entity (canonical, deduped, provenance-stamped,
// id'd) where v1 had a bare lowercase string; a typed requirement where v1 had a
// substring-bucket guess.
//
// Pure: no clock, no randomness, no network.

import type { CanonicalEntity } from "./nebula";
import type { IntentSemanticModel, TypedRequirement } from "./model";

/**
 * Drop-in upgrade for helpers.actorsIn(text): instead of a flat list of singular
 * strings, return the CANONICAL actor entities — already deduped across surface
 * variants, each with a stable id, display name, the variants it absorbed, and
 * provenance refs. Order: by first appearance (sourceRef), stable.
 */
export function actorsFrom(model: IntentSemanticModel): CanonicalEntity[] {
  return model.entities
    .filter((e) => e.role === "actor")
    .sort((a, b) => firstRef(a).localeCompare(firstRef(b)) || a.id.localeCompare(b.id));
}

/** The canonical systems/mechanisms the intent names (idp, audit trail, …). */
export function systemsFrom(model: IntentSemanticModel): CanonicalEntity[] {
  return model.entities
    .filter((e) => e.role === "system")
    .sort((a, b) => firstRef(a).localeCompare(firstRef(b)) || a.id.localeCompare(b.id));
}

/** The controlled actions the intent governs (authenticate, record, reverse, …). */
export function actionsFrom(model: IntentSemanticModel): CanonicalEntity[] {
  return model.entities
    .filter((e) => e.role === "action")
    .sort((a, b) => firstRef(a).localeCompare(firstRef(b)) || a.id.localeCompare(b.id));
}

/** The single primary actor (v1's `actors[0]`), now an entity not a string. */
export function primaryActor(model: IntentSemanticModel): CanonicalEntity | undefined {
  return actorsFrom(model)[0];
}

/** Requirements of a given modality — e.g. only the mandatory ones. */
export function requirementsByModality(
  model: IntentSemanticModel,
  modality: TypedRequirement["typing"]["modality"],
): TypedRequirement[] {
  return model.requirements.filter((r) => r.typing.modality === modality);
}

/** Requirements that carry a measurable budget (numbers+units), typed. */
export function budgetedRequirements(model: IntentSemanticModel): TypedRequirement[] {
  return model.requirements.filter((r) => r.typing.canonical.budget !== undefined);
}

/** Requirements the schema could not type into a controlled grammar class. */
export function narrativeRequirements(model: IntentSemanticModel): TypedRequirement[] {
  return model.requirements.filter((r) => r.typing.ears === "narrative");
}

/** Look up a canonical entity by id (for resolving requirement.entityRefs). */
export function entityById(model: IntentSemanticModel, id: string): CanonicalEntity | undefined {
  return model.entities.find((e) => e.id === id);
}

const firstRef = (e: CanonicalEntity): string => e.sourceRefs[0] ?? "intent.title";
