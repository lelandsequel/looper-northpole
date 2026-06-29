export type TourStep = {
  id: string;
  path: string;
  selector?: string;
  title: string;
  body: string;
  /** Auto-run when step appears (after navigation + paint delay). */
  action?: "fill-refuse" | "submit-intake" | "load-sample" | "select-first-funded" | "run-build" | "wizard-fill" | "wizard-next" | "wizard-submit";
  actionDelayMs?: number;
  waitForSelector?: string;
  /** Auto-advance after action completes (watch mode). */
  nextDelayMs?: number;
  /** Min ms before Next is enabled on read-only steps, or after an action finishes. */
  dwellMs?: number;
};

/** Default pause before Next unlocks on manual steps. */
export const TOUR_DEFAULT_DWELL_MS = 3200;

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    path: "/",
    selector: "[data-tour=hero]",
    title: "Welcome to LOOPER",
    body: "LOOPER is like a fair judge for work ideas. People submit requests, LOOPER checks if they're complete, scores them with math (not vibes), and puts them in order. Every decision leaves a trail you can look up later — like showing your work on a math test.",
    dwellMs: 4500,
  },
  {
    id: "wizard-start",
    path: "/intake/guided",
    selector: "[data-tour=wizard-step-1]",
    title: "The Guided Intake",
    body: "Instead of a massive blank form, the front door is conversational but mathematically rigorous. We ask for the idea first.",
    action: "wizard-fill",
    actionDelayMs: 1400,
    waitForSelector: "[data-tour=wizard-step-1]",
    dwellMs: 5000,
  },
  {
    id: "wizard-value",
    path: "/intake/guided",
    selector: "[data-tour=wizard-step-2]",
    title: "Value Classification",
    body: "Users must classify the intent of their idea. We'll pick 'Risk-Compliance' and mark it as a Regulatory Mandate, which automatically pins it to the NOW phase in the portfolio.",
    action: "wizard-next",
    actionDelayMs: 1200,
    waitForSelector: "[data-tour=wizard-step-2]",
    dwellMs: 4000,
  },
  {
    id: "wizard-math",
    path: "/intake/guided",
    selector: "[data-tour=wizard-step-3]",
    title: "The Hard Math",
    body: "We force them to quantify the Reach and the Effort. No vague 'High/Medium/Low' guesses. Real units, real team-weeks.",
    action: "wizard-next",
    actionDelayMs: 1200,
    waitForSelector: "[data-tour=wizard-step-3]",
    dwellMs: 4000,
  },
  {
    id: "wizard-receipts",
    path: "/intake/guided",
    selector: "[data-tour=wizard-step-4]",
    title: "The Receipts",
    body: "This is the kill-screen. Notice how the submit button is greyed out. If you claim it saves money, you must provide the source for that math. CADMUS blocks the gate until evidence is provided.",
    action: "wizard-submit",
    actionDelayMs: 3000,
    waitForSelector: "[data-tour=wizard-step-4]",
    dwellMs: 5500,
  },
  {
    id: "looper-header",
    path: "/looper",
    selector: "[data-tour=looper-header]",
    title: "The control room",
    body: "This page shows how busy the team is and whether the score list is healthy. FUNDED means \"we have room to work on this now.\" BENCHED means \"good idea, but wait in line.\" Nothing here is a guess — it's all counted.",
    waitForSelector: "[data-tour=looper-header]",
    dwellMs: 4500,
  },
  {
    id: "intake-refuse",
    path: "/looper",
    selector: "[data-tour=intake]",
    title: "First, a bad example on purpose",
    body: "We're going to type a super vague idea — like \"make the app better\" with almost no details. Watch what happens when you don't give LOOPER enough information to score fairly.",
    action: "fill-refuse",
    actionDelayMs: 1400,
    waitForSelector: "[data-tour=intake]",
    dwellMs: 5000,
  },
  {
    id: "intake-refuse-submit",
    path: "/looper",
    selector: "[data-tour=intake-submit]",
    title: "LOOPER said no — and that's the point",
    body: "See REFUSED? That means the idea didn't have enough facts to enter the queue. LOOPER isn't being mean — it's stopping mystery projects that nobody could explain or compare to everything else.",
    action: "submit-intake",
    actionDelayMs: 1200,
    dwellMs: 5500,
  },
  {
    id: "intake-accept",
    path: "/looper",
    selector: "[data-tour=intake]",
    title: "Now a real idea",
    body: "Same form, but this time the idea has clear details: what's wrong, what proof we have, and what \"done\" looks like. LOOPER can actually score this one — like grading a homework assignment that has all the steps shown.",
    action: "load-sample",
    actionDelayMs: 1400,
    dwellMs: 5000,
  },
  {
    id: "intake-accept-submit",
    path: "/looper",
    selector: "[data-tour=queue]",
    title: "It joined the queue!",
    body: "When a complete idea gets in, LOOPER re-sorts the whole list. Same questions plus same data always gives the same rank — like a calculator, not a coin flip. That's what \"deterministic\" means in plain English.",
    action: "submit-intake",
    actionDelayMs: 1400,
    waitForSelector: "[data-tour=queue]",
    dwellMs: 6000,
  },
  {
    id: "queue",
    path: "/looper",
    selector: "[data-tour=queue]",
    title: "The waiting line",
    body: "FUNDED = we're working on it now. BENCHED = scored and waiting for a slot. HELD = might be a duplicate of something already moving. We'll click the top funded item so you can see its report card.",
    action: "select-first-funded",
    actionDelayMs: 1600,
    dwellMs: 5500,
  },
  {
    id: "receipts",
    path: "/looper",
    selector: "[data-tour=score-panel]",
    title: "The report card",
    body: "This panel shows exactly why an idea ranked where it did — reach, impact, confidence, effort, and money math broken out line by line. If someone asks \"why is this above that?\" you can point at the numbers instead of arguing from memory.",
    waitForSelector: "[data-tour=score-panel]",
    dwellMs: 6500,
  },
  {
    id: "done",
    path: "/looper",
    selector: "[data-tour=looper-header]",
    title: "That's LOOPER",
    body: "Intake → check → score → rank → receipt. No secret AI making up the ranking step. When you're ready, hit the home page, pick a gate (Sales, Risk, and the rest), and try your own idea.",
    dwellMs: 5000,
  },
];