export type TourStep = {
  id: string;
  path: string;
  selector?: string;
  title: string;
  body: string;
  /** Auto-run when step appears (after navigation + paint delay). */
  action?: "fill-refuse" | "submit-intake" | "load-sample" | "submit-intake" | "select-first-funded" | "run-build";
  actionDelayMs?: number;
  waitForSelector?: string;
  nextDelayMs?: number;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    path: "/",
    selector: "[data-tour=hero]",
    title: "The prioritization portal",
    body: "LOOPER scores intake. NORTHPOLE builds only what wins the queue. Every decision is receipted — no LLM in the rank path.",
  },
  {
    id: "looper-header",
    path: "/looper",
    selector: "[data-tour=looper-header]",
    title: "Mission control",
    body: "Capacity, ledger head, chain verify. Funded vs benched is uncommitted work — separate from live Jira, so metrics stay honest.",
    waitForSelector: "[data-tour=looper-header]",
  },
  {
    id: "intake-refuse",
    path: "/looper",
    selector: "[data-tour=intake]",
    title: "Not a suggestion box",
    body: "Watch CADMUS refuse unstructured intake. No evidence, no queue entry.",
    action: "fill-refuse",
    actionDelayMs: 600,
    waitForSelector: "[data-tour=intake]",
  },
  {
    id: "intake-refuse-submit",
    path: "/looper",
    selector: "[data-tour=intake-submit]",
    title: "REFUSED",
    body: "Thin asks die here. This is the gate the room asked for.",
    action: "submit-intake",
    actionDelayMs: 400,
    nextDelayMs: 1200,
  },
  {
    id: "intake-accept",
    path: "/looper",
    selector: "[data-tour=intake]",
    title: "Structured intake",
    body: "Now a real initiative — evidence, NPV fields, rubric-complete JSON.",
    action: "load-sample",
    actionDelayMs: 400,
  },
  {
    id: "intake-accept-submit",
    path: "/looper",
    selector: "[data-tour=queue]",
    title: "Rank moves",
    body: "Intake + prioritize. The whole portfolio re-scores. Deterministic — same inputs, same rank.",
    action: "submit-intake",
    actionDelayMs: 500,
    waitForSelector: "[data-tour=queue]",
    nextDelayMs: 1500,
  },
  {
    id: "queue",
    path: "/looper",
    selector: "[data-tour=queue]",
    title: "NOW queue",
    body: "FUNDED = capacity allocated. BENCHED = scored but waiting. HELD = duplicate cluster.",
    action: "select-first-funded",
    actionDelayMs: 800,
    nextDelayMs: 600,
  },
  {
    id: "receipts",
    path: "/looper",
    selector: "[data-tour=score-panel]",
    title: "Why is this here?",
    body: "RICE × 3-year NPV breakdown. Every score cites a receipt you can re-verify six months later.",
    waitForSelector: "[data-tour=score-panel]",
  },
  {
    id: "northpole-intro",
    path: "/north-pole",
    selector: "[data-tour=northpole-header]",
    title: "After commitment",
    body: "Only funded initiatives enter NORTHPOLE. Spec → build gate → audit → feedback back to LOOPER.",
    waitForSelector: "[data-tour=northpole-funded]",
  },
  {
    id: "northpole-run",
    path: "/north-pole",
    selector: "[data-tour=northpole-funded]",
    title: "Run the loop",
    body: "6D COSMIC spec, then build gate. Round 1 REFUSE, round 2 ship — the validator doesn't trust the builder.",
    action: "run-build",
    actionDelayMs: 600,
    waitForSelector: "[data-tour=build-results]",
    nextDelayMs: 8000,
  },
  {
    id: "build-gate",
    path: "/north-pole",
    selector: "[data-tour=gate]",
    title: "The moat",
    body: "Acceptance criteria run as executable probes. Typed REFUSE reasons loop back until green or honest exhaustion.",
    waitForSelector: "[data-tour=gate]",
  },
  {
    id: "feedback",
    path: "/north-pole",
    selector: "[data-tour=feedback]",
    title: "Circle closes",
    body: "Build outcome updates delivery confidence → LOOPER re-prioritizes. Constant prioritization, not score-once.",
    waitForSelector: "[data-tour=feedback]",
  },
  {
    id: "done",
    path: "/north-pole",
    selector: "[data-tour=northpole-header]",
    title: "Clone it. Verify it.",
    body: "Apache-2.0 · no telemetry · 42 tests green. Intake → rank → spec → gate → receipt. Chase adapters are next — the engine is here.",
  },
];