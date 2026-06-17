// 6D Workbench — the preloaded synthetic demo feature.
//
// Fully synthetic: no real teams, systems, or data. Bank-realistic on purpose
// so all six phases have something honest to chew on (a risk goal, a speed
// goal, an audit goal, a mandated mechanism, a numeric budget, accessibility).

import type { RawIntent } from "./engine";

export const EXAMPLE_INTENT: RawIntent = {
  title: "Servicing Console — Step-Up Authentication for High-Risk Actions",
  context:
    "Servicing agents can trigger high-risk actions (large payment reversals, account-detail changes) with a single click. A step-up re-authentication must be required before any high-risk action commits, with a clear reason captured for the record. This is a synthetic demo feature — no real systems or data.",
  goals: [
    "Reduce unauthorized high-risk actions",
    "Preserve agent speed on low-risk work",
    "Capture a full audit trail for every high-risk action",
  ],
  constraints: [
    "Must use the enterprise identity provider for step-up",
    "No change to existing role permissions",
    "Added latency budget: under 2s for the step-up flow",
    "Accessibility: WCAG AA",
  ],
  sourceMaterial: [],
};
