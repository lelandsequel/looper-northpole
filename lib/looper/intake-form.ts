import type { Initiative } from "@/lib/agility/types";

export const VALUE_TYPES = [
  "Direct Customer Revenue",
  "Direct Customer Service",
  "Internal Enabler",
  "Risk-Compliance",
  "Strategic-Optionality",
] as const;

export const CONFIDENCE_OPTIONS = [
  { label: "Low (0.5)", value: 0.5 },
  { label: "Medium (0.8)", value: 0.8 },
  { label: "High (1.0)", value: 1.0 },
] as const;

export type IntakeFormState = {
  title: string;
  description: string;
  area: string;
  sponsor: string;
  outcome: string;
  valueType: (typeof VALUE_TYPES)[number];
  reachValue: string;
  reachUnit: string;
  reachSource: string;
  effortTeamWeeks: string;
  deliveryConfidence: number;
  valueConfidence: number;
  revenueImpact: string;
  revenueSource: string;
  costSaveAnnual: string;
  savingsEffectiveDate: string;
  costSaveSource: string;
  businessImpact: string;
};

export const EMPTY_INTAKE_FORM: IntakeFormState = {
  title: "",
  description: "",
  area: "",
  sponsor: "",
  outcome: "",
  valueType: "Internal Enabler",
  reachValue: "",
  reachUnit: "engineers",
  reachSource: "",
  effortTeamWeeks: "6",
  deliveryConfidence: 0.8,
  valueConfidence: 0.8,
  revenueImpact: "",
  revenueSource: "",
  costSaveAnnual: "",
  savingsEffectiveDate: "",
  costSaveSource: "",
  businessImpact: "",
};

function slugId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return `HL-${slug || "initiative"}-${Date.now().toString(36)}`;
}

/** Build a CADMUS-ready initiative object from the guided form. */
export function initiativeFromForm(form: IntakeFormState): Initiative {
  const evidence: Record<string, string> = {};
  if (form.reachSource.trim()) evidence.reach = form.reachSource.trim();
  if (form.revenueSource.trim()) evidence.revenue = form.revenueSource.trim();
  if (form.costSaveSource.trim()) evidence.costSave = form.costSaveSource.trim();

  const initiative: Initiative = {
    id: slugId(form.title),
    title: form.title.trim(),
    description: form.description.trim(),
    area: form.area.trim(),
    sponsor: form.sponsor.trim(),
    outcome: form.outcome.trim(),
    valueType: form.valueType,
    reach: {
      value: Number(form.reachValue),
      unit: form.reachUnit.trim() || "users",
      source: form.reachSource.trim() || undefined,
    },
    effortTeamWeeks: Number(form.effortTeamWeeks),
    deliveryConfidence: form.deliveryConfidence,
    valueConfidence: form.valueConfidence,
    evidence,
  };

  const revenue = Number(form.revenueImpact);
  if (revenue > 0) initiative.revenueImpact = revenue;

  const costSave = Number(form.costSaveAnnual);
  if (costSave > 0) {
    initiative.costSaveAnnual = costSave;
    if (form.savingsEffectiveDate.trim()) {
      initiative.savingsEffectiveDate = form.savingsEffectiveDate.trim();
    }
  }

  if (form.businessImpact.trim()) {
    initiative.businessImpact = form.businessImpact.trim();
  }

  return initiative;
}

export function formToJson(form: IntakeFormState): string {
  return JSON.stringify(initiativeFromForm(form), null, 2);
}