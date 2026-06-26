// 6D Workbench — the six phase transforms.
//
// Each phase is a pure function (PhaseCtx) => PhaseArtifact. No model, no
// network, no clock. Every element it emits carries sourceRefs back to intent
// atoms or upstream elements, and every gap becomes an OpenQuestion instead of
// an invented fact. The Define phase is seeded by the CADMUS Engine's
// buildSpec (its refuse-when-underspecified questions become Define's open
// questions), and every Develop dev-prompt is emitted by CADMUS llmPrompt —
// so its grounding discipline ("do not invent facts…") rides along verbatim.

import { buildSpec, llmPrompt, type CadmusSpec } from "../cadmus";
import {
  actorsIn,
  bucketsFor,
  type Bucket,
  cap,
  exclusionOf,
  isNormative,
  acceptanceForGoal,
  asActorPhrase,
  goalNeedPhrase,
  lower1,
  mandatedMechanism,
  numbersWithUnits,
  sentences,
  stripPeriod,
  storyTitleFromGoal,
  tidy,
  userWantClause,
} from "./helpers";
import {
  type ArtifactElement,
  type IntentRef,
  type OpenQuestion,
  PHASE_META,
  type PhaseArtifact,
  type PhaseCtx,
  type PhaseId,
} from "./types";

// ── Collector: stable ids by construction order ──────────────────────────────

class C {
  els: ArtifactElement[] = [];
  oqs: OpenQuestion[] = [];
  private counts = new Map<string, number>();
  constructor(private phase: PhaseId) {}

  el(
    kind: string,
    body: string,
    sourceRefs: string[],
    extra?: { title?: string; fields?: Record<string, string | string[]> },
  ): ArtifactElement {
    const n = (this.counts.get(kind) ?? 0) + 1;
    this.counts.set(kind, n);
    const e: ArtifactElement = {
      id: `${this.phase}.${kind}.${n}`,
      kind,
      body,
      sourceRefs,
    };
    if (extra?.title) e.title = extra.title;
    if (extra?.fields) e.fields = extra.fields;
    this.els.push(e);
    return e;
  }

  oq(about: string, question: string, blocking = false): OpenQuestion {
    const q: OpenQuestion = {
      id: `${this.phase}.oq.${this.oqs.length + 1}`,
      phase: this.phase,
      about,
      question,
      blocking,
    };
    this.oqs.push(q);
    return q;
  }

  done(): PhaseArtifact {
    const meta = PHASE_META.find((m) => m.phase === this.phase)!;
    return { ...meta, elements: this.els, openQuestions: this.oqs };
  }
}

// ── Shared lookups ───────────────────────────────────────────────────────────

const atoms = (index: IntentRef[], kind: IntentRef["kind"]): IntentRef[] =>
  index.filter((a) => a.kind === kind);

const intentText = (ctx: PhaseCtx): string =>
  [ctx.intent.title, ctx.intent.context, ...ctx.intent.goals, ...ctx.intent.constraints].join(" ");

const phaseEls = (ctx: PhaseCtx, phase: PhaseId, kind?: string): ArtifactElement[] => {
  const art = ctx.upstream.find((a) => a.phase === phase);
  if (!art) return [];
  return kind ? art.elements.filter((e) => e.kind === kind) : art.elements;
};

const phaseOqs = (ctx: PhaseCtx, phase: PhaseId): OpenQuestion[] =>
  ctx.upstream.find((a) => a.phase === phase)?.openQuestions ?? [];

/** Where an actor term is first mentioned — for honest sourceRefs. */
const actorRef = (ctx: PhaseCtx, actor: string): string => {
  const re = new RegExp(`\\b${actor}s?\\b`, "i");
  const ctxAtom = atoms(ctx.index, "context").find((a) => re.test(a.text));
  if (ctxAtom) return ctxAtom.id;
  if (re.test(ctx.intent.title)) return "intent.title";
  const goal = atoms(ctx.index, "goal").find((a) => re.test(a.text));
  return goal ? goal.id : "intent.title";
};

// ═════════════════════════════════════════ 1 · DEFINE (PRD · POs & APOs) ════

export function definePhase(ctx: PhaseCtx): PhaseArtifact {
  const c = new C("define");
  const { intent } = ctx;
  const goals = atoms(ctx.index, "goal");
  const constraints = atoms(ctx.index, "constraint");
  const contextAtoms = atoms(ctx.index, "context");
  const sources = atoms(ctx.index, "source");
  const actors = actorsIn(intentText(ctx));

  if (goals.length === 0) {
    c.oq("goals", "No goals were provided — Define cannot produce a meaningful PRD. State at least one goal.", true);
  }

  // CADMUS Engine seed: objective + its refuse-when-underspecified questions.
  const seed = buildSpec({
    intent: `${intent.title}${goals[0] ? ` — ${lower1(stripPeriod(goals[0].text))}` : ""}`,
    audience: actors.join(", "),
    done: intent.goals.join("\n"),
    constraints: intent.constraints.join("\n"),
  });
  c.el("objective", seed.objective, ["intent.title", ...(goals[0] ? [goals[0].id] : [])], {
    title: "Objective",
  });
  for (const q of seed.open) c.oq("prd", `${q} (raised by the CADMUS engine)`);

  // Problem statement — the context, verbatim. We restate; we do not embellish.
  if (contextAtoms.length) {
    c.el("problem_statement", intent.context.trim(), contextAtoms.map((a) => a.id), {
      title: "Problem / current state",
    });
  } else {
    c.oq("problem_statement", "No context was provided — describe the current state and why it needs to change.", true);
  }

  // Scope.
  for (const g of goals) {
    c.el("in_scope", `In scope — ${tidy(g.text)}`, [g.id]);
  }
  const exclusions = constraints
    .map((a) => ({ a, x: exclusionOf(a.text) }))
    .filter((p): p is { a: IntentRef; x: string } => Boolean(p.x));
  if (exclusions.length) {
    for (const { a, x } of exclusions) {
      c.el("out_of_scope", `Out of scope — ${tidy(x)} (stated constraint).`, [a.id]);
    }
  } else {
    c.oq("out_of_scope", "No explicit exclusions were provided — confirm out-of-scope boundaries with the accountable PO before build.");
  }

  // Assumptions — only where the intent forces one, and flagged as assumptions.
  for (const a of constraints) {
    const mech = mandatedMechanism(a.text);
    if (mech) {
      c.el(
        "assumption",
        `Assumes ${mech} is available in the target environment and supports this flow (mandated by a stated constraint).`,
        [a.id],
      );
    }
  }
  if (sources.length) {
    c.el(
      "assumption",
      "Assumes the provided source material is current and authoritative for this feature.",
      sources.map((s) => s.id),
    );
  }

  // User stories — one per goal, short ticket voice.
  const actor = actors[0] ?? "user";
  for (const g of goals) {
    c.el(
      "story",
      `${asActorPhrase(actor)}, ${userWantClause(g.text)}.`,
      [g.id, "intent.title", ...(actors[0] ? [actorRef(ctx, actor)] : [])],
      { title: storyTitleFromGoal(g.text), fields: { actor } },
    );
  }

  // Acceptance criteria — description-derived for primary goal; shaped text for meta goals.
  const contextText = contextAtoms[0]?.text ?? intent.context;
  for (let i = 0; i < goals.length; i++) {
    const g = goals[i];
    const then = acceptanceForGoal(g.text, i, contextText);
    c.el(
      "acceptance_criterion",
      then,
      [g.id, ...(i === 0 && contextAtoms[0] ? [contextAtoms[0].id] : [])],
      {
        fields: {
          given: "the feature is in the pilot scope",
          when: "the covered workflow runs",
          then,
        },
      },
    );
  }
  // Extra ACs from description sentences on the primary story (when not normative).
  if (goals.length && contextAtoms[0]) {
    const extra = sentences(contextAtoms[0].text).filter((s) => s.length > 20 && !isNormative(s));
    for (let si = 1; si < extra.length; si++) {
      c.el("acceptance_criterion", tidy(extra[si]), [contextAtoms[0].id, goals[0].id]);
    }
  }
  // b) normative sentences in the context ("must / should / require…").
  for (const s of contextAtoms) {
    if (isNormative(s.text)) {
      c.el(
        "acceptance_criterion",
        `Given the flow described in the intent, when it executes, then the stated requirement holds: ${tidy(s.text)}`,
        [s.id],
        {
          fields: {
            given: "the flow described in the intent",
            when: "it executes",
            then: tidy(s.text),
          },
        },
      );
    }
  }
  // c) numeric budgets in constraints become measurable criteria.
  for (const a of constraints) {
    for (const n of numbersWithUnits(a.text)) {
      c.el(
        "acceptance_criterion",
        `Given the feature is active, when the affected flow completes, then it satisfies the stated budget (${n.raw}): ${tidy(a.text)}`,
        [a.id],
        {
          fields: {
            given: "the feature is active",
            when: "the affected flow completes",
            then: `within ${n.raw} — ${stripPeriod(a.text)}`,
            budget: n.raw,
          },
        },
      );
    }
  }

  // Success metrics — measurable verbs only; no numeric target → open question.
  for (const g of goals) {
    if (!/\b(reduce|increase|improve|preserve|full|cut|grow|eliminate)\b/i.test(g.text)) continue;
    const nums = numbersWithUnits(g.text);
    const related = constraints.find(
      (a) => numbersWithUnits(a.text).length && bucketsFor(a.text).some((b) => bucketsFor(g.text).includes(b)),
    );
    if (nums.length) {
      c.el("success_metric", `Track: ${tidy(g.text)} (stated target: ${nums[0].raw}).`, [g.id]);
    } else if (/\bfull\b/i.test(g.text)) {
      c.el(
        "success_metric",
        `Track: 100% of covered actions satisfy — ${tidy(g.text)} ("full" is the stated bar).`,
        [g.id],
      );
    } else if (related) {
      const n = numbersWithUnits(related.text)[0];
      c.el(
        "success_metric",
        `Track: ${stripPeriod(g.text)} — against the stated budget ${n.raw}.`,
        [g.id, related.id],
      );
    } else {
      c.el("success_metric", `Track: ${tidy(g.text)} — baseline and numeric target TBD.`, [g.id]);
      c.oq("success_metric", `Goal "${stripPeriod(g.text)}" has no numeric target — define baseline and target with the accountable PO.`);
    }
  }

  return c.done();
}

// ═══════════════════════════════════ 2 · DESIGN (DDD · UX) ══════════════════

export function designPhase(ctx: PhaseCtx): PhaseArtifact {
  const c = new C("design");
  const { intent } = ctx;
  const goals = atoms(ctx.index, "goal");
  const constraints = atoms(ctx.index, "constraint");
  const contextAtoms = atoms(ctx.index, "context");
  const actors = actorsIn(intentText(ctx));
  const allBuckets = bucketsFor(intentText(ctx));

  // Direction — assembled strictly from source statements.
  const dir = [
    `Serve ${actors.length ? actors.join(", ") : "the (unnamed) user"} for "${intent.title}".`,
    goals.length ? `The experience must deliver: ${goals.map((g) => lower1(stripPeriod(g.text))).join("; ")}.` : "",
    constraints.length ? `While honoring: ${constraints.map((a) => lower1(stripPeriod(a.text))).join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  c.el(
    "design_direction",
    dir,
    ["intent.title", ...goals.map((g) => g.id), ...constraints.map((a) => a.id)],
    { title: "Design direction" },
  );

  // Decision records (ADR-style), each traced to the statements that force it.
  for (const a of constraints) {
    const mech = mandatedMechanism(a.text);
    if (mech) {
      c.el(
        "adr",
        `Context: "${stripPeriod(a.text)}" (stated constraint). Decision: adopt ${mech} as the mechanism for this flow. Consequences: the integration path, availability, and failure modes of ${mech} become design dependencies. Status: Proposed (pilot).`,
        [a.id],
        { title: `Use ${mech}`, fields: { status: "Proposed (pilot)", tags: ["auth"] } },
      );
    }
  }
  const riskGoal = goals.find((g) => bucketsFor(g.text).includes("risk"));
  const speedGoal = goals.find((g) => bucketsFor(g.text).includes("performance"));
  if (riskGoal && speedGoal) {
    c.el(
      "adr",
      `Context: the intent states both "${stripPeriod(riskGoal.text)}" and "${stripPeriod(speedGoal.text)}". Decision: tier flows by risk — apply added friction only where the risk goal demands it; leave routine paths unchanged. Consequences: a risk classification must exist for covered actions. Status: Proposed (pilot).`,
      [riskGoal.id, speedGoal.id],
      { title: "Tier actions by risk", fields: { status: "Proposed (pilot)", tags: ["risk", "performance"] } },
    );
  }
  const auditGoal = goals.find((g) => bucketsFor(g.text).includes("audit"));
  if (auditGoal) {
    c.el(
      "adr",
      `Context: "${stripPeriod(auditGoal.text)}" (stated goal). Decision: write the record at the same point where the action is allowed or refused, so the trail cannot diverge from the outcome. Consequences: the write path is part of the critical flow and needs an explicit failure policy. Status: Proposed (pilot).`,
      [auditGoal.id],
      { title: "Capture the record at the decision point", fields: { status: "Proposed (pilot)", tags: ["audit"] } },
    );
  }

  // UX considerations.
  if (speedGoal) {
    c.el("ux_consideration", `Minimize added friction on routine work — stated goal: "${stripPeriod(speedGoal.text)}".`, [speedGoal.id]);
  }
  const a11y = constraints.find((a) => bucketsFor(a.text).includes("accessibility"));
  if (a11y) {
    c.el(
      "ux_consideration",
      `Meet the stated accessibility bar (${stripPeriod(a11y.text)}) — focus order, contrast, and screen-reader announcements for any interruption or challenge step.`,
      [a11y.id],
    );
  }
  for (const actor of actors) {
    c.el("ux_consideration", `Design explicitly for the ${actor} named in the intent.`, [actorRef(ctx, actor)]);
  }

  // States & edge surfaces.
  const normative = contextAtoms.find((s) => isNormative(s.text));
  if (allBuckets.includes("auth")) {
    const ref = normative ? [normative.id] : constraints.filter((a) => bucketsFor(a.text).includes("auth")).map((a) => a.id);
    const states = [
      "Default — no challenge presented",
      "Challenge presented — action held",
      "Challenge passed — action commits",
      "Challenge failed or declined — action blocked",
      "Challenge timed out / expired — action blocked",
    ];
    for (const s of states) c.el("state", s, ref.length ? ref : ["intent.title"]);
  } else {
    const ref = goals[0] ? [goals[0].id] : ["intent.title"];
    for (const s of ["Idle", "In progress", "Succeeded", "Failed — no partial effects"]) {
      c.el("state", s, ref);
    }
  }

  // Honest gaps.
  if (!/design system|component library|figma|brand/i.test(intentText(ctx))) {
    c.oq("design_direction", "No design-system or component-library reference provided — confirm with UX before high-fidelity design.");
  }
  if (allBuckets.includes("auth")) {
    c.oq("state", "Confirm the exact challenge UX (inline modal vs redirect) with the accountable UX owner.");
  }

  return c.done();
}

// ═══════════════════════ 3 · DISTRIBUTE (ABD · Agility) ═════════════════════

const SIZE_UP: Record<string, string> = { S: "M", M: "L", L: "L" };

export function distributePhase(ctx: PhaseCtx): PhaseArtifact {
  const c = new C("distribute");
  const { intent } = ctx;
  const goals = atoms(ctx.index, "goal");
  const contextAtoms = atoms(ctx.index, "context");
  const defineStories = phaseEls(ctx, "define", "story");
  const defineAcs = phaseEls(ctx, "define", "acceptance_criterion");
  const objective = phaseEls(ctx, "define", "objective")[0];
  const problem = phaseEls(ctx, "define", "problem_statement")[0];

  // Epic — problem statement when available (not objective mashed into context).
  const epicBody = problem
    ? problem.body
    : `${objective ? objective.body : tidy(intent.title)}${contextAtoms[0] ? ` ${tidy(contextAtoms[0].text)}` : ""}`;
  c.el(
    "epic",
    epicBody,
    [
      ...(problem ? [problem.id] : objective ? [objective.id] : ["intent.title"]),
      ...(contextAtoms[0] && !problem ? [contextAtoms[0].id] : []),
    ],
    { title: intent.title },
  );

  // Assign every AC to exactly one story (by goal ref, then bucket affinity).
  const storyBuckets: Bucket[][] = goals.map((g) => bucketsFor(g.text));
  const acAssignment = new Map<string, number>(); // ac.id -> story index
  for (const ac of defineAcs) {
    const goalIdx = goals.findIndex((g) => ac.sourceRefs.includes(g.id));
    if (goalIdx >= 0) {
      acAssignment.set(ac.id, goalIdx);
      continue;
    }
    const acBucketList = bucketsFor(ac.body);
    const byBucket = storyBuckets.findIndex((bs) => bs.some((b) => acBucketList.includes(b)));
    acAssignment.set(ac.id, byBucket >= 0 ? byBucket : 0);
  }

  // Dependencies (deterministic rules), computed on goal indices first.
  const idxWith = (b: Bucket): number => storyBuckets.findIndex((bs) => bs.includes(b));
  const dependsOn: number[][] = goals.map(() => []);
  const riskIdx = idxWith("risk");
  for (let i = 0; i < goals.length; i++) {
    if (storyBuckets[i].includes("audit") && riskIdx >= 0 && riskIdx !== i) dependsOn[i].push(riskIdx);
    if (storyBuckets[i].includes("ui")) {
      const core = riskIdx >= 0 ? riskIdx : idxWith("auth");
      if (core >= 0 && core !== i && !dependsOn[i].includes(core)) dependsOn[i].push(core);
    }
  }

  // Stories.
  const storyIds: string[] = goals.map((_, i) => `distribute.story.${i + 1}`);
  for (let i = 0; i < goals.length; i++) {
    const g = goals[i];
    const src = defineStories[i];
    const acs = defineAcs.filter((ac) => acAssignment.get(ac.id) === i);
    let estimate = acs.length <= 1 ? "S" : acs.length <= 3 ? "M" : "L";
    if (dependsOn[i].length) estimate = SIZE_UP[estimate];
    const deps = dependsOn[i].map((d) => storyIds[d]);
    const body = src ? src.body : `${asActorPhrase("user")}, ${userWantClause(g.text)}.`;
    c.el(
      "story",
      body,
      [...(src ? [src.id] : []), g.id, ...acs.map((ac) => ac.id)],
      {
        title: storyTitleFromGoal(g.text),
        fields: {
          estimate,
          labels: storyBuckets[i].length ? storyBuckets[i] : ["general"],
          dependsOn: deps,
          acRefs: acs.map((ac) => ac.id),
        },
      },
    );
  }

  // Dependency graph.
  const edges: string[] = [];
  for (let i = 0; i < goals.length; i++) {
    for (const d of dependsOn[i]) edges.push(`${storyIds[i]} → ${storyIds[d]}`);
  }
  c.el(
    "dependency_graph",
    edges.length ? edges.join("\n") : "No cross-story dependencies derived from the intent.",
    storyIds.length ? storyIds : ["intent.title"],
    { title: "Dependencies" },
  );

  c.oq(
    "story",
    "Estimates are deterministic t-shirt heuristics (AC count + dependencies) — calibrate with the team's own sizing convention.",
  );

  return c.done();
}

// ═════════════════════════ 4 · DEVELOP (SDD · SWE) ══════════════════════════

const EDGE_TABLE: Partial<Record<Bucket, string[]>> = {
  auth: [
    "Challenge declined by the actor",
    "Challenge timed out or expired mid-action",
    "Session expires between initiation and commit",
    "Double-submit while a challenge is pending",
  ],
  risk: ["Actor retries immediately after a refusal — ensure no partial state"],
};

export function developPhase(ctx: PhaseCtx): PhaseArtifact {
  const c = new C("develop");
  const { intent } = ctx;
  const constraints = atoms(ctx.index, "constraint");
  const stories = phaseEls(ctx, "distribute", "story");
  const epic = phaseEls(ctx, "distribute", "epic")[0];
  const adrs = phaseEls(ctx, "design", "adr");
  const states = phaseEls(ctx, "design", "state");
  const defineAcs = phaseEls(ctx, "define", "acceptance_criterion");
  const outOfScope = phaseEls(ctx, "define", "out_of_scope");
  const upstreamQuestions = [...phaseOqs(ctx, "define"), ...phaseOqs(ctx, "design")].map((q) => q.question);

  let emittedContract = false;
  let auditEdgeRaised = false;

  for (const story of stories) {
    const labels = (story.fields?.labels as string[]) ?? [];
    const acIds = (story.fields?.acRefs as string[]) ?? [];
    const acs = defineAcs.filter((ac) => acIds.includes(ac.id));

    // Implementation plan.
    const planLines: string[] = [];
    const planRefs: string[] = [story.id];
    for (const adr of adrs) {
      const tags = (adr.fields?.tags as string[]) ?? [];
      if (tags.some((t) => labels.includes(t))) {
        planLines.push(`Honor ADR "${adr.title ?? adr.id}" — see its decision and consequences.`);
        planRefs.push(adr.id);
      }
    }
    if (labels.includes("auth") || labels.includes("risk")) {
      if (states.length) {
        planLines.push("Implement every state defined in Design — including blocked and expired paths.");
        planRefs.push(...states.map((s) => s.id));
      }
    }
    planLines.push("Implement to satisfy the story's acceptance criteria exactly; flag any gap as an open question rather than assuming.");
    c.el("implementation_plan", planLines.map((l) => `- ${l}`).join("\n"), planRefs, {
      title: `Plan — ${story.title ?? story.id}`,
    });

    // Dev prompt — emitted by the CADMUS Engine (llmPrompt), discipline included.
    const spec: CadmusSpec = {
      objective: `Implement "${story.title ?? story.id}" for ${intent.title}.`,
      audience: `Engineering handoff for the pilot slice of "${intent.title}".`,
      role: "a senior software engineer",
      acceptance: acs.map((ac) => ac.body),
      outOfScope: outOfScope.length
        ? outOfScope.map((o) => o.body)
        : ["Anything beyond the stated objective.", "Speculative features or scope not explicitly requested."],
      constraints: intent.constraints.map((x) => tidy(x)),
      format: "A short implementation plan, then the code changes with tests.",
      open: upstreamQuestions,
    };
    c.el("dev_prompt", llmPrompt(spec), [story.id, ...acIds, ...constraints.map((a) => a.id)], {
      title: `Dev prompt — ${story.title ?? story.id}`,
      fields: { use: "paste into your approved AI coding assistant", emittedBy: "CADMUS llmPrompt" },
    });

    // Edge cases.
    for (const b of labels) {
      for (const edge of EDGE_TABLE[b as Bucket] ?? []) {
        c.el("edge_case", edge, [story.id]);
      }
    }
    if (labels.includes("performance")) {
      for (const a of constraints) {
        for (const n of numbersWithUnits(a.text)) {
          c.el("edge_case", `Boundary: the flow completes exactly at the stated budget (${n.raw}).`, [story.id, a.id]);
        }
      }
    }
    if (labels.includes("audit") && !auditEdgeRaised) {
      auditEdgeRaised = true;
      c.el(
        "edge_case",
        "The record write fails after the action is approved — whether the action proceeds or blocks is UNSPECIFIED in the intent (see open question).",
        [story.id],
      );
      c.oq(
        "edge_case",
        "If the audit/record write fails, does the action proceed or block? The intent does not specify — the accountable owner must decide before build.",
        true,
      );
    }

    // Interface contract (only where the intent forces one).
    if (labels.includes("auth") || labels.includes("risk")) {
      if (!emittedContract) {
        emittedContract = true;
        const authAdr = adrs.find((a) => ((a.fields?.tags as string[]) ?? []).includes("auth"));
        c.el(
          "contract",
          [
            "type ChallengeRequest = {",
            "  actionId: string;      // the held action",
            "  actorId: string;       // who is being challenged",
            "  reason: string;        // captured for the record (stated requirement)",
            "};",
            "",
            "type ChallengeResult = {",
            "  passed: boolean;",
            "  method: string;        // mechanism mandated by the stated constraint",
            "};",
          ].join("\n"),
          [story.id, ...(authAdr ? [authAdr.id] : [])],
          { title: "Challenge contract (stub)", fields: { language: "ts" } },
        );
      }
    }
  }

  if (!emittedContract) {
    c.oq("contract", "No interface contracts are derivable from the intent — define service boundaries with the team.");
  }

  // Handoff.
  const handoffRefs = [
    ...(epic ? [epic.id] : []),
    ...stories.map((s) => s.id),
    ...adrs.map((a) => a.id),
  ];
  c.el(
    "handoff",
    [
      `Start from the epic and its ${stories.length} stor${stories.length === 1 ? "y" : "ies"}; every story carries its acceptance criteria inline.`,
      `Honor the ${adrs.length} design decision record${adrs.length === 1 ? "" : "s"} and the state set from Design.`,
      "Every element carries sourceRefs — any line can be traced back to the original intent before you build on it.",
    ].join("\n"),
    handoffRefs.length ? handoffRefs : ["intent.title"],
    { title: "Engineering handoff" },
  );

  return c.done();
}

// ═══════════════════════════ 5 · DETECT (QDD · QA) ══════════════════════════

export function detectPhase(ctx: PhaseCtx): PhaseArtifact {
  const c = new C("detect");
  const { intent } = ctx;
  const goals = atoms(ctx.index, "goal");
  const stories = phaseEls(ctx, "distribute", "story");
  const defineAcs = phaseEls(ctx, "define", "acceptance_criterion");
  const auditGoal = goals.find((g) => bucketsFor(g.text).includes("audit"));

  const coverage = new Map<string, string[]>(); // ac.id -> scenario ids
  let genericNegativeRaised = false;

  for (const story of stories) {
    const labels = (story.fields?.labels as string[]) ?? [];
    const acIds = (story.fields?.acRefs as string[]) ?? [];
    const acs = defineAcs.filter((ac) => acIds.includes(ac.id));
    const guarded = labels.includes("auth") || labels.includes("risk");

    for (const ac of acs) {
      const happy = c.el("test_scenario", `Verify: ${ac.body}`, [ac.id, story.id], {
        fields: { type: "happy", ac: ac.id, story: story.id },
      });
      coverage.set(ac.id, [...(coverage.get(ac.id) ?? []), happy.id]);

      if (guarded) {
        const refs = [ac.id, story.id, ...(auditGoal ? [auditGoal.id] : [])];
        const neg = c.el(
          "test_scenario",
          `Given the same setup, when the challenge fails, is declined, or times out, then the action does not commit${auditGoal ? " and the attempt is recorded (stated goal)" : ""}.`,
          refs,
          { fields: { type: "negative", ac: ac.id, story: story.id } },
        );
        coverage.set(ac.id, [...(coverage.get(ac.id) ?? []), neg.id]);
      } else {
        const neg = c.el(
          "test_scenario",
          `Negative path for "${stripPeriod(ac.body).slice(0, 80)}…": induce the failure mode and verify the system refuses without partial effects — expected behavior is not specified in the intent (see open question).`,
          [ac.id, story.id],
          { fields: { type: "negative", ac: ac.id, story: story.id } },
        );
        coverage.set(ac.id, [...(coverage.get(ac.id) ?? []), neg.id]);
        if (!genericNegativeRaised) {
          genericNegativeRaised = true;
          c.oq("test_scenario", "Expected behavior for generic failure paths is not specified — confirm refusal/rollback semantics with QA and the PO.");
        }
      }

      const budget = ac.fields?.budget as string | undefined;
      if (budget) {
        const edge = c.el(
          "test_scenario",
          `Boundary test at ${budget}: verify behavior at, and just beyond, the stated budget.`,
          [ac.id, story.id],
          { fields: { type: "edge", ac: ac.id, story: story.id } },
        );
        coverage.set(ac.id, [...(coverage.get(ac.id) ?? []), edge.id]);
      }
    }
  }

  // Coverage map — and an honest blocking flag if anything is uncovered.
  const lines: string[] = [];
  for (const ac of defineAcs) {
    const sc = coverage.get(ac.id) ?? [];
    lines.push(`${ac.id} → ${sc.length ? sc.join(", ") : "UNCOVERED"}`);
    if (!sc.length) {
      c.oq("coverage", `Acceptance criterion ${ac.id} has no test scenario — close the gap before sign-off.`, true);
    }
  }
  c.el("coverage_map", lines.length ? lines.join("\n") : "No acceptance criteria to cover.", defineAcs.map((a) => a.id), {
    title: "AC → scenario coverage",
  });

  // Scaffolding — Playwright + Gherkin, assembled from the scenarios verbatim.
  const scenarios = c.els.filter((e) => e.kind === "test_scenario");
  const pw: string[] = [`test.describe(${JSON.stringify(intent.title)}, () => {`];
  for (const s of scenarios) {
    const name = stripPeriod(s.body).replace(/\s+/g, " ").slice(0, 80);
    pw.push(`  test(${JSON.stringify(name)}, async ({ page }) => {`);
    pw.push("    // arrange / act / assert per the scenario — see its sourceRefs");
    pw.push("  });");
  }
  pw.push("});");
  c.el("scaffold", pw.join("\n"), scenarios.map((s) => s.id), {
    title: "Playwright skeleton",
    fields: { language: "ts", framework: "playwright" },
  });

  const gherkin: string[] = [`Feature: ${intent.title}`];
  for (const ac of defineAcs) {
    const f = ac.fields ?? {};
    gherkin.push("");
    gherkin.push(`  Scenario: ${stripPeriod(String(f.then ?? ac.id)).slice(0, 80)}`);
    gherkin.push(`    Given ${f.given ?? "the documented setup"}`);
    gherkin.push(`    When ${f.when ?? "the flow executes"}`);
    gherkin.push(`    Then ${f.then ?? "the criterion holds"}`);
  }
  c.el("scaffold", gherkin.join("\n"), defineAcs.map((a) => a.id), {
    title: "Gherkin feature (Cucumber)",
    fields: { language: "gherkin", framework: "cucumber" },
  });

  return c.done();
}

// ══════════════════════════ 6 · DELIVER (CDD · SRE) ═════════════════════════

export function deliverPhase(ctx: PhaseCtx): PhaseArtifact {
  const c = new C("deliver");
  const { intent } = ctx;
  const constraints = atoms(ctx.index, "constraint");
  const goals = atoms(ctx.index, "goal");
  const stories = phaseEls(ctx, "distribute", "story");
  const allBuckets = bucketsFor(intentText(ctx));

  // Release notes — from the stories, verbatim.
  c.el(
    "release_notes",
    [`${intent.title} — pilot release`, "", ...stories.map((s) => `- ${s.title ?? s.id}`)].join("\n"),
    ["intent.title", ...stories.map((s) => s.id)],
    { title: "Release notes (draft)" },
  );

  // Runbook inputs — only what the intent supports.
  for (const a of constraints) {
    const mech = mandatedMechanism(a.text);
    if (mech) {
      c.el("runbook_input", `Verify ${mech} is configured and reachable in the target environment before enabling.`, [a.id]);
    }
    for (const n of numbersWithUnits(a.text)) {
      c.el("runbook_input", `Validate the stated budget (${n.raw}) in pre-prod before rollout.`, [a.id]);
    }
  }
  const auditGoal = goals.find((g) => bucketsFor(g.text).includes("audit"));
  if (auditGoal) {
    c.el("runbook_input", "Confirm the record/audit destination is writable and monitored before enabling.", [auditGoal.id]);
  }
  c.oq("runbook_input", "Rollback owner and procedure are not derivable from the intent — assign both before deploy.");

  // Monitoring questions.
  if (allBuckets.includes("auth")) {
    c.el("monitoring_question", "Which signal tracks challenge pass / fail / timeout rates?", [
      ...(constraints.find((a) => bucketsFor(a.text).includes("auth"))?.id
        ? [constraints.find((a) => bucketsFor(a.text).includes("auth"))!.id]
        : ["intent.title"]),
    ]);
  }
  if (auditGoal) {
    c.el("monitoring_question", "What alerts when a record write fails?", [auditGoal.id]);
  }
  for (const a of constraints) {
    for (const n of numbersWithUnits(a.text)) {
      c.el("monitoring_question", `How is the stated budget (${n.raw}) observed in production (e.g. p95)?`, [a.id]);
    }
  }

  c.oq("deliver", "Deployment window and accountable SRE owner unconfirmed.");

  return c.done();
}

export const PHASES: Array<(ctx: PhaseCtx) => PhaseArtifact> = [
  definePhase,
  designPhase,
  distributePhase,
  developPhase,
  detectPhase,
  deliverPhase,
];
