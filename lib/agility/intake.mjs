// HL Prioritization OS — intake (CADMUS discipline + Appendix A evidence gate).
//
// "If it's not in the system, it doesn't exist." Two checks at the door:
//   1. Structural — is this a real, comparable Initiative? (REQUIRED_FIELDS)
//   2. Evidence  — does every claim cite its source? (lib/rubric.mjs)
//
// A napkin idea in front of an exec fails (1). A polished pitch with an
// unsourced revenue number fails (2). Both are refused here, at submission —
// never at review. Only items that clear both compete for capacity.

import { REQUIRED_FIELDS, STATES } from "./types.mjs";
import { validate as validateEvidence } from "./rubric.mjs";

/**
 * Validate one initiative — structure + evidence.
 * @returns {{ ok, errors:string[], missingEvidence:Array }}
 */
export function validateInitiative(it) {
  const errors = [];

  // ── structural (CADMUS) ──
  for (const f of REQUIRED_FIELDS) {
    const v = f === "reach" ? it.reach?.value : it[f];
    if (v === undefined || v === null || v === "") errors.push(`missing field: ${f}`);
  }
  if (it.effortTeamWeeks !== undefined && Number(it.effortTeamWeeks) <= 0) {
    errors.push("effortTeamWeeks must be > 0");
  }
  for (const cf of ["deliveryConfidence", "valueConfidence"]) {
    if (it[cf] !== undefined) {
      const n = Number(it[cf]);
      if (![0.5, 0.8, 1.0].includes(n)) errors.push(`${cf} must be one of 0.5 / 0.8 / 1.0`);
    }
  }
  if (it.mandate === true && !nonEmpty(it.mandateCitation) && !nonEmpty(it.evidence?.mandate)) {
    errors.push("mandate=true requires mandateCitation");
  }

  // ── evidence (Appendix A) ──
  const ev = validateEvidence(it);
  for (const m of ev.missing) errors.push(`missing evidence: ${m.label}`);

  return { ok: errors.length === 0, errors, missingEvidence: ev.missing };
}

/** Intake a batch: record each accepted item into the ledger, reject the rest. */
export function intake(initiatives, ledger) {
  const accepted = [];
  const rejected = [];
  for (const it of initiatives) {
    const v = validateInitiative(it);
    if (v.ok) {
      const sha = ledger.append("INITIATIVE_INTAKEN", {
        id: it.id,
        title: it.title,
        area: it.area,
        outcome: it.outcome,
        valueType: it.valueType,
      });
      accepted.push({ ...it, state: it.state ?? STATES.SUBMITTED, _intakeReceipt: sha });
    } else {
      rejected.push({
        id: it.id ?? "(no id)",
        title: it.title ?? "(untitled)",
        errors: v.errors,
        missingEvidence: v.missingEvidence,
      });
    }
  }
  return { accepted, rejected };
}

function nonEmpty(v) {
  return v !== undefined && v !== null && String(v).trim() !== "";
}
