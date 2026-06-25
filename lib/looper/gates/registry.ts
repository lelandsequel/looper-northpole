import { composeFields, CORE_IDEA_FIELDS, ENGINE_FIELDS } from "./fields";
import type { GateId, IntakeGate } from "./types";

/**
 * Intake gate registry — one engine, many front doors.
 *
 * Questionnaires are config. Add a gate or change `fields` here;
 * LOOPER rank/spec path stays the same.
 */
export const INTAKE_GATES: IntakeGate[] = [
  {
    id: "sales",
    title: "Sales & Growth",
    subtitle: "Revenue · correspondent · field ideas",
    tone: "sales",
    defaults: { valueType: "Direct Customer Revenue", area: "Sales" },
    fields: composeFields([
      {
        key: "channelSignal",
        label: "Channel / partner",
        kind: "text",
        section: "gate",
        placeholder: "Correspondent, retail, etc.",
      },
    ]),
  },
  {
    id: "risk",
    title: "Risk & Compliance",
    subtitle: "Credit box · mandates · regulatory",
    tone: "risk",
    defaults: { valueType: "Risk-Compliance", area: "Compliance", mandateByDefault: true },
    fields: composeFields([
      {
        key: "regDriver",
        label: "Regulatory / risk driver",
        kind: "textarea",
        required: true,
        section: "gate",
        placeholder: "Why must we do this?",
      },
    ]),
  },
  {
    id: "texas-heloc",
    title: "Texas HELOC / Strategy",
    subtitle: "Mission-scale bets",
    tone: "strategy",
    defaults: { valueType: "Strategic-Optionality", area: "Consumer Lending" },
    fields: composeFields([
      {
        key: "strategicThesis",
        label: "Strategic thesis",
        kind: "textarea",
        section: "gate",
        placeholder: "Why Texas? Why now?",
      },
    ]),
  },
  {
    id: "msp-ops",
    title: "MSP / Data Ops",
    subtitle: "Servicing · config · operations",
    tone: "ops",
    defaults: { valueType: "Direct Customer Service", area: "Servicing Operations" },
    fields: composeFields([
      {
        key: "opsContext",
        label: "MSP / ticket context",
        kind: "textarea",
        section: "gate",
        placeholder: "Escrow, Fly, ticket IDs…",
      },
    ]),
  },
  {
    id: "general",
    title: "General",
    subtitle: "Any Home Lending request",
    tone: "default",
    defaults: { valueType: "Internal Enabler", area: "Home Lending" },
    fields: [...CORE_IDEA_FIELDS, ...ENGINE_FIELDS],
  },
];

export function gateById(id: string): IntakeGate | undefined {
  return INTAKE_GATES.find((g) => g.id === id);
}

export function allGateIds(): GateId[] {
  return INTAKE_GATES.map((g) => g.id);
}