import { validateInitiative } from "@/lib/agility/intake.mjs";
import type { Initiative } from "@/lib/agility/types";

export const CADMUS_RUBRIC = [
  "description — what you're building and why",
  "outcome — the measurable result",
  "valueType — one of: Direct Customer Revenue, Direct Customer Service, Internal Enabler, Risk-Compliance, Strategic-Optionality",
  "evidence — source citations for every claim (reach, revenue, cost-save, etc.)",
  "reach — { value, unit, source }",
  "effortTeamWeeks — team-weeks estimate (> 0)",
  "deliveryConfidence — 0.5 | 0.8 | 1.0",
  "valueConfidence — 0.5 | 0.8 | 1.0",
] as const;

export type CadmusRefusal = {
  ok: false;
  refused: true;
  rubric: readonly string[];
  errors: string[];
  missingEvidence?: Array<{ field: string; label: string }>;
};

export type CadmusAccept = {
  ok: true;
  refused: false;
  initiative: Initiative;
};

export type CadmusResult = CadmusRefusal | CadmusAccept;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** CADMUS gate — refuse unstructured input. No guessing. */
export function cadmusGate(raw: string): CadmusResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      ok: false,
      refused: true,
      rubric: CADMUS_RUBRIC,
      errors: ["empty input"],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      ok: false,
      refused: true,
      rubric: CADMUS_RUBRIC,
      errors: [
        "unstructured input — submit a JSON initiative object, not free text",
        "required: description, outcome, valueType, evidence",
      ],
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      refused: true,
      rubric: CADMUS_RUBRIC,
      errors: ["input must be a JSON object"],
    };
  }

  const initiative = parsed as unknown as Initiative;
  const v = validateInitiative(initiative);
  if (!v.ok) {
    return {
      ok: false,
      refused: true,
      rubric: CADMUS_RUBRIC,
      errors: v.errors,
      missingEvidence: v.missingEvidence,
    };
  }

  return { ok: true, refused: false, initiative };
}