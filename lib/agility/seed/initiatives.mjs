// HL Prioritization OS — SYNTHETIC demo portfolio (Appendix A rubric, full).
//
// Illustrative only. No real names, no confidential data — made-up initiatives
// chosen to show the engine doing what an HL operating model actually needs:
// catching duplicate builds, ranking by time-value-correct NPV, surfacing
// found-money, pinning mandates, parking stale work, and refusing the napkin.
//
// Required scenarios baked in:
//   • a 3-item DUPLICATE CLUSTER  (HL-009/010/011 — "rate calculator")
//   • a MANDATE / regulatory item (HL-003 — auto-pins to Now)
//   • an "insurance portal" FOUND-MONEY item (HL-001 — high rev, low effort)
//   • a STALE WATCHLIST item      (HL-012 — state: Watchlist)
//   • the TIME-VALUE PAIR         (HL-006 early-effective vs HL-007 late-
//     effective, otherwise identical cost-saves — early must rank above late)
//   • a spread of all 5 value types
//   • a NAPKIN idea that is refused at intake (HL-013 — no structure/evidence)
//
// Dates use 2026-01-01 as the horizon start (see lib/score.mjs horizonStart).

import {
  VALUE_TYPES,
  TALENT_PROFILE,
  CONFIDENCE,
  BUDGET_CYCLE,
  BUSINESS_IMPACT,
  STATES,
} from "../types.mjs";

export const INITIATIVES = [
  // ── FOUND MONEY: the insurance portal that came out of nowhere ────────────
  {
    id: "HL-001",
    title: "Insurance Agent Portal",
    description:
      "Net-new self-serve portal that signs and onboards insurance agents into the marketplace. High-margin revenue line, small surface area — found money.",
    area: "Growth",
    sponsor: "Strategy",
    outcome: "insurance agent marketplace portal",
    valueType: VALUE_TYPES.REVENUE,
    mandate: false,
    businessImpact: BUSINESS_IMPACT.CONSUMER,
    reach: { value: 18000, unit: "agents", source: "Partnerships TAM model 2026-Q1" },
    revenueImpact: 7_200_000,
    cogs: 0.18,
    ongoingTCO: 140_000,
    budgetCyclePosition: BUDGET_CYCLE.PRE_LOCK,
    deliveryConfidence: CONFIDENCE.HIGH,
    valueConfidence: CONFIDENCE.MEDIUM,
    effortTeamWeeks: 8,
    talentProfile: TALENT_PROFILE.ANY,
    dependsOn: [],
    evidence: {
      reach: "Partnerships TAM model 2026-Q1",
      revenue: "Strategy revenue memo INS-2026-014",
      tco: "Cloud cost quote PLT-Q1-883",
    },
    state: STATES.SUBMITTED,
  },

  // ── REVENUE: correspondent pricing engine (bigger build, real upside) ─────
  {
    id: "HL-002",
    title: "Correspondent Pricing Engine",
    description:
      "Real-time loan pricing for the correspondent channel — faster, sharper quotes to win lock volume from competitors. " +
      "The engine must return a priced quote within two seconds at the p95. " +
      "It must price against the live rate-sheet feed and the borrower eligibility service. " +
      "It must never quote below the locked margin floor. " +
      "It must expose the margin and concession breakdown on every quote so the price is explainable. " +
      "Every quote must be logged with its full rate inputs and eligibility decision so any price is auditable after the fact. " +
      "The engine requires the rate-sheet feed and the eligibility service to be live. " +
      "If either is stale or unavailable it must refuse to quote rather than price on stale data. " +
      "It shall support correspondent-specific pricing overrides set by Capital Markets. " +
      "It shall reprice automatically when a new rate sheet publishes intraday.",
    area: "Correspondent",
    sponsor: "Correspondent",
    outcome: "correspondent real-time loan pricing",
    valueType: VALUE_TYPES.REVENUE,
    mandate: false,
    businessImpact: BUSINESS_IMPACT.CORRESPONDENT,
    reach: { value: 42000, unit: "loans", source: "Correspondent volume FY25 actuals" },
    revenueImpact: 5_400_000,
    cogs: 0.22,
    ongoingTCO: 220_000,
    budgetCyclePosition: BUDGET_CYCLE.CROSSES_LOCK,
    deliveryConfidence: CONFIDENCE.MEDIUM,
    valueConfidence: CONFIDENCE.MEDIUM,
    effortTeamWeeks: 22,
    talentProfile: TALENT_PROFILE.SPECIALIST,
    dependsOn: [],
    evidence: {
      reach: "Correspondent volume FY25 actuals",
      revenue: "Capital Markets uplift study CM-2026-07",
      tco: "Infra estimate PLT-Q1-901",
      latency: "Correspondent quote SLA target CM-2026-09",
      margin: "Pricing policy MARGIN-2026-02",
      eligibility: "Eligibility service contract ELIG-2026-05",
    },
    state: STATES.SUBMITTED,
  },

  // ── MANDATE / regulatory: must-do, auto-pins to Now ───────────────────────
  {
    id: "HL-003",
    title: "TX State Disclosure Update",
    description:
      "Statutory disclosure change for Texas originations. Non-compliance is a hard stop — funded regardless of score.",
    area: "Compliance",
    sponsor: "Regulatory",
    outcome: "texas regulatory disclosure compliance",
    valueType: VALUE_TYPES.RISK,
    mandate: true,
    mandateCitation: "TX Fin. Code §342.305 (eff. 2026-09-01)",
    businessImpact: BUSINESS_IMPACT.CONSUMER,
    reach: { value: 31000, unit: "loans", source: "TX origination volume FY25" },
    riskReduction: 4_000_000,
    pRisk: 0.6,
    ongoingTCO: 20_000,
    budgetCyclePosition: BUDGET_CYCLE.POST_LOCK,
    deliveryConfidence: CONFIDENCE.HIGH,
    valueConfidence: CONFIDENCE.HIGH,
    effortTeamWeeks: 6,
    talentProfile: TALENT_PROFILE.ANY,
    dependsOn: [],
    evidence: {
      mandate: "TX Fin. Code §342.305",
      reach: "TX origination volume FY25",
      riskReduction: "Risk register R-2026-1180",
      tco: "Compliance run-cost note CMP-12",
    },
    state: STATES.SUBMITTED,
  },

  // ── SERVICE: borrower self-service payments (customer-impact led) ─────────
  {
    id: "HL-004",
    title: "Borrower Payment Self-Service",
    description:
      "Lets borrowers manage and schedule payments without calling servicing. Lifts CSAT and deflects call volume.",
    area: "Servicing",
    sponsor: "Servicing",
    outcome: "self-service borrower payment management",
    valueType: VALUE_TYPES.SERVICE,
    mandate: false,
    businessImpact: BUSINESS_IMPACT.SERVICING,
    reach: { value: 260000, unit: "borrowers", source: "Servicing portfolio 2026" },
    customerImpact: 900_000,
    costSaveAnnual: 480_000,
    savingsEffectiveDate: "2026-06-01",
    ongoingTCO: 90_000,
    budgetCyclePosition: BUDGET_CYCLE.PRE_LOCK,
    deliveryConfidence: CONFIDENCE.MEDIUM,
    valueConfidence: CONFIDENCE.HIGH,
    effortTeamWeeks: 14,
    talentProfile: TALENT_PROFILE.ANY,
    dependsOn: [],
    evidence: {
      reach: "Servicing portfolio 2026",
      customerImpact: "CSAT-to-retention model SVC-2026-03",
      costSave: "Call-deflection model SVC-2026-04",
      tco: "Infra estimate PLT-Q1-915",
    },
    state: STATES.SUBMITTED,
  },

  // ── ENABLER: sprint reporting automation (quick internal win) ─────────────
  {
    id: "HL-005",
    title: "Auditable Sprint Reporting",
    description:
      "Generates sprint/release reporting straight from Jira + git — kills hours of manual status assembly and makes the record auditable.",
    area: "Portfolio Ops",
    sponsor: "Portfolio Ops",
    outcome: "auditable sprint reporting from jira and git",
    valueType: VALUE_TYPES.ENABLER,
    mandate: false,
    businessImpact: BUSINESS_IMPACT.SERVICING,
    reach: { value: 320, unit: "engineers", source: "HC roster 2026-Q1" },
    costSaveAnnual: 360_000,
    savingsEffectiveDate: "2026-03-01",
    ongoingTCO: 15_000,
    budgetCyclePosition: BUDGET_CYCLE.PRE_LOCK,
    deliveryConfidence: CONFIDENCE.HIGH,
    valueConfidence: CONFIDENCE.HIGH,
    effortTeamWeeks: 4,
    talentProfile: TALENT_PROFILE.ANY,
    dependsOn: [],
    evidence: {
      reach: "HC roster 2026-Q1",
      costSave: "Time-study OPS-2026-02",
      tco: "Tooling quote OPS-Q1-21",
    },
    state: STATES.SUBMITTED,
  },

  // ── TIME-VALUE PAIR — identical cost-saves, different effective dates ──────
  // HL-006 goes live EARLY (month 2). HL-007 goes live LATE (month 11). Same
  // $1.2M/yr save, same everything else → HL-006 MUST rank above HL-007.
  {
    id: "HL-006",
    title: "Certificate Rotation Automation",
    description:
      "Automates certificate rotation across the estate. Rollout completes in month 2, so the savings start realizing almost immediately.",
    area: "Resiliency",
    sponsor: "Core Ops",
    outcome: "automated tls certificate rotation estate",
    valueType: VALUE_TYPES.ENABLER,
    mandate: false,
    businessImpact: BUSINESS_IMPACT.SERVICING,
    reach: { value: 320, unit: "engineers", source: "HC roster 2026-Q1" },
    costSaveAnnual: 1_200_000,
    savingsEffectiveDate: "2026-02-01", // EARLY
    ongoingTCO: 30_000,
    budgetCyclePosition: BUDGET_CYCLE.PRE_LOCK,
    deliveryConfidence: CONFIDENCE.HIGH,
    valueConfidence: CONFIDENCE.HIGH,
    effortTeamWeeks: 5,
    talentProfile: TALENT_PROFILE.ANY,
    dependsOn: [],
    evidence: {
      reach: "HC roster 2026-Q1",
      costSave: "Toil-reduction model OPS-2026-09",
      tco: "Tooling quote OPS-Q1-30",
    },
    state: STATES.SUBMITTED,
  },
  {
    id: "HL-007",
    title: "Secrets Vault Migration",
    description:
      "Same recurring cost-save as the cert-rotation work, but a staffing constraint pushes the rollout to month 11 — the savings barely land inside Year 1. Identical numbers, late effective date: the time-value control.",
    area: "Resiliency",
    sponsor: "Core Ops",
    outcome: "centralized secrets vault migration",
    valueType: VALUE_TYPES.ENABLER,
    mandate: false,
    businessImpact: BUSINESS_IMPACT.SERVICING,
    reach: { value: 320, unit: "engineers", source: "HC roster 2026-Q1" },
    costSaveAnnual: 1_200_000,
    savingsEffectiveDate: "2026-11-01", // LATE
    ongoingTCO: 30_000,
    budgetCyclePosition: BUDGET_CYCLE.PRE_LOCK,
    deliveryConfidence: CONFIDENCE.HIGH,
    valueConfidence: CONFIDENCE.HIGH,
    effortTeamWeeks: 5,
    talentProfile: TALENT_PROFILE.ANY,
    dependsOn: [],
    evidence: {
      reach: "HC roster 2026-Q1",
      costSave: "Toil-reduction model OPS-2026-09",
      tco: "Tooling quote OPS-Q1-30",
    },
    state: STATES.SUBMITTED,
  },

  // ── OPTIONALITY: platform decommission (strategic, expensive) ─────────────
  {
    id: "HL-008",
    title: "MX Legacy Decommission",
    description:
      "Retires the MX legacy platform, unlocking faster delivery everywhere downstream. Strategic optionality more than near-term dollars.",
    area: "Platform Ops",
    sponsor: "Portfolio Ops",
    outcome: "decommission mx legacy platform",
    valueType: VALUE_TYPES.OPTIONALITY,
    mandate: false,
    businessImpact: BUSINESS_IMPACT.CORRESPONDENT,
    reach: { value: 320, unit: "engineers", source: "HC roster 2026-Q1" },
    costSaveAnnual: 700_000,
    savingsEffectiveDate: "2027-01-01",
    costAvoid: 1_500_000,
    pAvoid: 0.5,
    ongoingTCO: 60_000,
    budgetCyclePosition: BUDGET_CYCLE.CROSSES_LOCK,
    deliveryConfidence: CONFIDENCE.MEDIUM,
    valueConfidence: CONFIDENCE.MEDIUM,
    effortTeamWeeks: 30,
    talentProfile: TALENT_PROFILE.STAFF_PLUS,
    dependsOn: [],
    evidence: {
      reach: "HC roster 2026-Q1",
      costSave: "Decommission savings model PLT-2026-11",
      costAvoid: "Counterfactual: MX EOL support quote PLT-2026-12",
      tco: "Residual run-cost PLT-Q1-940",
    },
    state: STATES.SUBMITTED,
  },

  // ── THE THREE-CALCULATOR PROBLEM (same outcome, three areas) ──────────────
  {
    id: "HL-009",
    title: "Mortgage Rate Calculator — Sales",
    description: "Sales wants a borrower-facing mortgage rate calculator.",
    area: "Sales",
    sponsor: "Sales",
    outcome: "mortgage rate calculator",
    valueType: VALUE_TYPES.SERVICE,
    mandate: false,
    businessImpact: BUSINESS_IMPACT.CONSUMER,
    reach: { value: 120000, unit: "borrowers", source: "Sales web traffic 2025" },
    revenueImpact: 600_000,
    cogs: 0.2,
    customerImpact: 120_000,
    ongoingTCO: 25_000,
    budgetCyclePosition: BUDGET_CYCLE.PRE_LOCK,
    deliveryConfidence: CONFIDENCE.HIGH,
    valueConfidence: CONFIDENCE.MEDIUM,
    effortTeamWeeks: 6,
    talentProfile: TALENT_PROFILE.ANY,
    dependsOn: [],
    evidence: {
      reach: "Sales web traffic 2025",
      revenue: "Lead-conversion model SAL-2026-01",
      customerImpact: "CSAT proxy SAL-2026-02",
      tco: "Tooling quote SAL-Q1-04",
    },
    state: STATES.SUBMITTED,
  },
  {
    id: "HL-010",
    title: "Mortgage Rate Calculator — Servicing",
    description: "Servicing wants the same mortgage rate calculator for its portal.",
    area: "Servicing",
    sponsor: "Servicing",
    outcome: "mortgage rate calculator",
    valueType: VALUE_TYPES.SERVICE,
    mandate: false,
    businessImpact: BUSINESS_IMPACT.SERVICING,
    reach: { value: 60000, unit: "borrowers", source: "Servicing portal traffic 2025" },
    customerImpact: 80_000,
    ongoingTCO: 25_000,
    budgetCyclePosition: BUDGET_CYCLE.PRE_LOCK,
    deliveryConfidence: CONFIDENCE.MEDIUM,
    valueConfidence: CONFIDENCE.MEDIUM,
    effortTeamWeeks: 6,
    talentProfile: TALENT_PROFILE.ANY,
    dependsOn: [],
    evidence: {
      reach: "Servicing portal traffic 2025",
      customerImpact: "CSAT proxy SVC-2026-08",
      tco: "Tooling quote SVC-Q1-09",
    },
    state: STATES.SUBMITTED,
  },
  {
    id: "HL-011",
    title: "Mortgage Rate Calculator — Correspondent",
    description: "Correspondent wants the same mortgage rate calculator for partners.",
    area: "Correspondent",
    sponsor: "Correspondent",
    outcome: "mortgage rate calculator",
    valueType: VALUE_TYPES.SERVICE,
    mandate: false,
    businessImpact: BUSINESS_IMPACT.CORRESPONDENT,
    reach: { value: 12000, unit: "partners", source: "Correspondent partner count 2025" },
    customerImpact: 40_000,
    ongoingTCO: 25_000,
    budgetCyclePosition: BUDGET_CYCLE.PRE_LOCK,
    deliveryConfidence: CONFIDENCE.MEDIUM,
    valueConfidence: CONFIDENCE.LOW,
    effortTeamWeeks: 6,
    talentProfile: TALENT_PROFILE.ANY,
    dependsOn: [],
    evidence: {
      reach: "Correspondent partner count 2025",
      customerImpact: "CSAT proxy COR-2026-02",
      tco: "Tooling quote COR-Q1-03",
    },
    state: STATES.SUBMITTED,
  },

  // ── STALE WATCHLIST: parked last quarter, no movement ─────────────────────
  {
    id: "HL-012",
    title: "Internal Wiki Search Revamp",
    description:
      "A nice-to-have search refresh that was parked on the watchlist two quarters ago and never picked back up.",
    area: "Internal Tools",
    sponsor: "Eng Enablement",
    outcome: "internal wiki search relevance revamp",
    valueType: VALUE_TYPES.ENABLER,
    mandate: false,
    businessImpact: BUSINESS_IMPACT.SERVICING,
    reach: { value: 320, unit: "engineers", source: "HC roster 2026-Q1" },
    costSaveAnnual: 60_000,
    savingsEffectiveDate: "2026-09-01",
    ongoingTCO: 10_000,
    budgetCyclePosition: BUDGET_CYCLE.POST_LOCK,
    deliveryConfidence: CONFIDENCE.MEDIUM,
    valueConfidence: CONFIDENCE.LOW,
    effortTeamWeeks: 7,
    talentProfile: TALENT_PROFILE.ANY,
    dependsOn: [],
    evidence: {
      reach: "HC roster 2026-Q1",
      costSave: "Search time-study ENB-2025-19",
      tco: "Tooling quote ENB-Q3-44",
    },
    state: STATES.WATCHLIST, // <- stale, stays on Watchlist
  },

  // ── NAPKIN IDEA — refused at intake (no structure, no evidence) ───────────
  {
    id: "HL-013",
    title: "Big AI Thing (no details yet)",
    description: "An influential VP wants 'an AI thing'. No rubric, no sources.",
    area: "Sales",
    sponsor: "An Influential VP",
    outcome: "unspecified ai initiative",
    // intentionally missing: valueType, reach, confidences, effort, evidence
    // → REFUSED by intake (structure + evidence both fail)
  },
];
