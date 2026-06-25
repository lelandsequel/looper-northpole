/** Multi-entry intake — gate definitions are data, engine is shared. */

export type GateId = "sales" | "risk" | "texas-heloc" | "msp-ops" | "general";

export type GateFieldKind = "text" | "textarea" | "number" | "date" | "select" | "email";

export type GateField = {
  key: string;
  label: string;
  kind: GateFieldKind;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  /** UI section — lets workshops reshape forms without code changes. */
  section?: "idea" | "gate" | "engine";
};

export type GateDefaults = {
  valueType: string;
  area: string;
  mandateByDefault?: boolean;
};

export type IntakeGate = {
  id: GateId;
  title: string;
  subtitle: string;
  tone: "sales" | "risk" | "strategy" | "ops" | "default";
  /** Questionnaire for this front door — edit in registry only. */
  fields: GateField[];
  defaults: GateDefaults;
};

/** Tag on initiatives — which door they entered through. */
export type LooperInitiative = import("@/lib/agility/types").Initiative & {
  _intakeGate?: GateId;
  _gateAnswers?: Record<string, string>;
};