import type { GateField } from "./types";

/** Shared across all gates until intake workshops split requester vs ops fields. */
export const CORE_IDEA_FIELDS: GateField[] = [
  { key: "title", label: "Title", kind: "text", required: true, section: "idea" },
  {
    key: "summary",
    label: "Summary",
    kind: "textarea",
    required: true,
    section: "idea",
    placeholder: "What are you asking for, in plain language?",
  },
  {
    key: "businessProblem",
    label: "Business problem",
    kind: "textarea",
    required: true,
    section: "idea",
  },
  {
    key: "additionalInfo",
    label: "Additional context",
    kind: "textarea",
    section: "idea",
  },
];

/**
 * Engine fields — same block on every gate for now.
 * Workshops can move these to ops-only forms per gate without touching LOOPER core.
 */
export const ENGINE_FIELDS: GateField[] = [
  { key: "reachValue", label: "Reach (annual)", kind: "number", required: true, section: "engine" },
  {
    key: "reachUnit",
    label: "Reach unit",
    kind: "select",
    required: true,
    section: "engine",
    options: [
      { value: "loans", label: "loans" },
      { value: "customers", label: "customers" },
      { value: "engineers", label: "engineers" },
      { value: "accounts", label: "accounts" },
    ],
  },
  { key: "reachSource", label: "Reach source", kind: "text", required: true, section: "engine" },
  { key: "effortTeamWeeks", label: "Effort (team-weeks)", kind: "number", required: true, section: "engine" },
  { key: "revenueImpact", label: "Revenue impact ($/yr)", kind: "number", section: "engine" },
  { key: "revenueSource", label: "Revenue source", kind: "text", section: "engine" },
  { key: "costSaveAnnual", label: "Cost save ($/yr)", kind: "number", section: "engine" },
  { key: "costSaveSource", label: "Cost save source", kind: "text", section: "engine" },
  { key: "riskReduction", label: "Risk reduction ($)", kind: "number", section: "engine" },
  { key: "mandateCitation", label: "Mandate / policy citation", kind: "text", section: "engine" },
];

export function composeFields(gateFields: GateField[]): GateField[] {
  return [...CORE_IDEA_FIELDS, ...gateFields, ...ENGINE_FIELDS];
}