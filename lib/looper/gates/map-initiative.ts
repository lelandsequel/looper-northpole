import type { Initiative } from "@/lib/agility/types";

import type { IntakeGate, LooperInitiative } from "./types";

function slugId(gateId: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  return `HL-${gateId}-${slug || "idea"}-${Date.now().toString(36)}`;
}

/** Normalize any gate questionnaire → CADMUS-ready initiative. */
export function initiativeFromGate(gate: IntakeGate, values: Record<string, string>): LooperInitiative {
  const title = (values.title ?? "").trim();
  const summary = (values.summary ?? "").trim();
  const businessProblem = (values.businessProblem ?? "").trim();
  const additional = (values.additionalInfo ?? "").trim();
  const gateBits = gate.fields
    .filter((f) => f.section === "gate")
    .map((f) => values[f.key]?.trim())
    .filter(Boolean);

  const description = [summary, businessProblem, ...gateBits, additional].filter(Boolean).join("\n\n");

  const evidence: Record<string, string> = {};
  if (values.reachSource?.trim()) evidence.reach = values.reachSource.trim();
  if (values.revenueSource?.trim()) evidence.revenue = values.revenueSource.trim();
  if (values.costSaveSource?.trim()) evidence.costSave = values.costSaveSource.trim();
  if (values.mandateCitation?.trim()) evidence.mandate = values.mandateCitation.trim();

  const initiative: LooperInitiative = {
    id: slugId(gate.id, title),
    title,
    description,
    area: gate.defaults.area,
    sponsor: "Home Lending Intake",
    outcome: summary.slice(0, 120) || title,
    valueType: gate.defaults.valueType,
    reach: {
      value: Number(values.reachValue) || 0,
      unit: (values.reachUnit ?? "users").trim(),
      source: values.reachSource?.trim(),
    },
    effortTeamWeeks: Math.max(1, Number(values.effortTeamWeeks) || 1),
    deliveryConfidence: gate.id === "risk" ? 1.0 : 0.8,
    valueConfidence: gate.id === "risk" ? 1.0 : 0.8,
    evidence,
    businessImpact:
      gate.id === "sales"
        ? "Correspondent"
        : gate.id === "texas-heloc"
          ? "Consumer"
          : gate.id === "msp-ops"
            ? "Servicing"
            : undefined,
    _intakeGate: gate.id,
    _gateAnswers: values,
  };

  if (gate.defaults.mandateByDefault || values.mandateCitation?.trim()) {
    initiative.mandate = true;
    initiative.mandateCitation = values.mandateCitation?.trim() || "Regulatory mandate — see intake";
  }

  const revenue = Number(values.revenueImpact);
  if (revenue > 0) initiative.revenueImpact = revenue;

  const costSave = Number(values.costSaveAnnual);
  if (costSave > 0) initiative.costSaveAnnual = costSave;

  const riskReduction = Number(values.riskReduction);
  if (riskReduction > 0) {
    initiative.riskReduction = riskReduction;
    initiative.pRisk = 0.6;
  }

  return initiative;
}

export function gateInitiativeJson(gate: IntakeGate, values: Record<string, string>): string {
  return JSON.stringify(initiativeFromGate(gate, values), null, 2);
}