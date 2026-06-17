// 6D Semantic Layer — DEVELOP phase, model-driven promotion.
//
// Signature: (ctx: PhaseCtx, model: IntentSemanticModel) => PhaseArtifact
// Element KINDS (identical to v1 developPhase): implementation_plan, dev_prompt,
// edge_case, contract, handoff.
//
// THE PROMOTION vs v1 developPhase:
//
//   v1 DEVELOP                         → THIS (semantic)
//   ---------------------------------  -------------------------------------------
//   story.fields.labels (keyword        entityRefs on each typed requirement;
//   bucket strings, e.g. ["auth"]) to  entityById resolves the canonical entity so
//   decide which ADRs / states apply   the plan cites WHAT the entity is, not what
//                                      bucket a string fell in.
//
//   CADMUS spec acceptance = raw        CADMUS spec acceptance = typed requirement
//   AC bodies (text strings from       bodies + their EARS modality tag so the
//   define phase)                      dev-prompt is grounded in the obligation
//                                      type, not just the prose.
//
//   CADMUS spec constraints = raw       + typed requirement constraints (mandatory /
//   intent.constraints text            optional / budgeted) as explicit CADMUS
//                                      constraints, so the "do not invent" guardrail
//                                      fires against typed data, not strings.
//
//   narrativeRequirements silently      Each narrative requirement the model could
//   absent (the define layer just       NOT type into a controlled EARS class is
//   dropped them into open questions   surfaced in the dev-prompt as an explicit
//   on the define artifact)            "confirm with PO before building" open item.
//
// KEEP: the CADMUS llmPrompt emission (its "do not invent facts" discipline is
// load-bearing and rides through verbatim), the EDGE_TABLE / edge-case structural
// logic, the contract stub, and the handoff element. Same deterministic logic for
// all of these; the model only replaces the keyword-bucket input layer.
//
// Pure: no clock, no randomness.

import { llmPrompt, type CadmusSpec } from "../../cadmus";
import { numbersWithUnits, stripPeriod, tidy } from "../helpers";
import type { ArtifactElement, OpenQuestion, PhaseArtifact, PhaseCtx, PhaseId } from "../types";
import { PHASE_META } from "../types";
import { actionsFrom, actorsFrom, entityById, narrativeRequirements, requirementsByModality, systemsFrom } from "./adapter";
import type { CanonicalEntity } from "./nebula";
import type { IntentSemanticModel, TypedRequirement } from "./model";

// ── Local collector (mirrors phases.ts `C`, same stable-id contract) ──────────

class SC {
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
    const e: ArtifactElement = { id: `${this.phase}.${kind}.${n}`, kind, body, sourceRefs };
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

// ── Upstream selectors (identical helpers to phases.ts) ────────────────────────

const phaseEls = (ctx: PhaseCtx, phase: PhaseId, kind?: string): ArtifactElement[] => {
  const art = ctx.upstream.find((a) => a.phase === phase);
  if (!art) return [];
  return kind ? art.elements.filter((e) => e.kind === kind) : art.elements;
};

const phaseOqs = (ctx: PhaseCtx, phase: PhaseId): OpenQuestion[] =>
  ctx.upstream.find((a) => a.phase === phase)?.openQuestions ?? [];

// ── Edge-case table (identical to v1; structural floor that does not vary) ────
// The edge cases listed here are structurally required whenever an auth or risk
// entity is present — they are not guesses, they are the universal boundary
// conditions of guarded actions. Kept verbatim from v1 so the detect phase test
// coverage continues to expect them.

type EdgeRole = "actor" | "system" | "action";

const EDGE_BY_ROLE: Partial<Record<EdgeRole, string[]>> = {
  // auth / identity-check entities: any entity whose display suggests auth/idp/step-up
  system: [
    "Challenge declined by the actor",
    "Challenge timed out or expired mid-action",
    "Session expires between initiation and commit",
    "Double-submit while a challenge is pending",
  ],
  action: ["Actor retries immediately after a refusal — ensure no partial state"],
};

// A helper that decides whether an entity is "auth-flavoured" from its display
// text, without doing keyword-bucket matching. This is the honest use of the
// entity: we look at what the reconciler produced, not at raw label strings.
const isAuthEntity = (e: CanonicalEntity): boolean =>
  /step.?up|re.?auth|authentication|idp|identity.?provider|sso|login|credential/i.test(
    e.variants.join(" "),
  );

const isRiskEntity = (e: CanonicalEntity): boolean =>
  /high.?risk|unauthorized|fraud|reversal|irreversible/i.test(e.variants.join(" "));

// ── THE PROMOTION: model-to-story matcher ────────────────────────────────────
// v1 keyed off story.fields.labels (keyword buckets). We key off the TYPED
// requirements that share entity refs with the story. The story's sourceRefs
// include the goal atom ids that were distributed into it; a requirement that
// names the same atom ref (via req.sourceRef) is directly associated.
//
// For requirements that name entities (req.entityRefs), we resolve them from the
// model and include the entity display + role in the plan line — so the engineer
// reads "Honor the reconciled system 'Auth IDP'" rather than "label: auth".

function requirementsForStory(
  story: ArtifactElement,
  model: IntentSemanticModel,
): TypedRequirement[] {
  // The story's sourceRefs include the goal atom ids it was built from.
  const storyGoalRefs = new Set(story.sourceRefs.filter((r) => r.startsWith("intent.goal.")));
  // Also pick up AC ref ids that trace back to the same goals.
  const acIds = new Set((story.fields?.acRefs as string[] | undefined) ?? []);

  return model.requirements.filter((req) => {
    // Direct: requirement came from the same goal atom.
    if (storyGoalRefs.has(req.sourceRef)) return true;
    // Indirect: no direct goal ref, but the requirement's entity refs are in the
    // story's AC refs (downstream of the same goal). Kept narrow to avoid drift.
    if (acIds.size && req.entityRefs.length) {
      return req.entityRefs.some((eId) => {
        const entity = entityById(model, eId);
        return entity && story.sourceRefs.some((r) => r.includes(entity.key));
      });
    }
    return false;
  });
}

// ── DEVELOP (semantic) ────────────────────────────────────────────────────────
// vs v1 developPhase:
//   • implementation_plan cites reconciled entities the story touches, not labels.
//   • CADMUS spec acceptance and constraints carry typed obligations.
//   • narrativeRequirements that the model could not type are surfaced as explicit
//     "confirm with PO" open items in the dev-prompt — not silently dropped.
//   • Edge cases are triggered by entity role + variant text, not keyword buckets.
//   • Contract emission: same structural rule (auth or risk entity present), same
//     stub shape — still deterministic, now entity-grounded in sourceRefs.

export function developPhaseSemantic(ctx: PhaseCtx, model: IntentSemanticModel): PhaseArtifact {
  const c = new SC("develop");
  const { intent } = ctx;
  const constraints = ctx.index.filter((a) => a.kind === "constraint");
  const stories = phaseEls(ctx, "distribute", "story");
  const epic = phaseEls(ctx, "distribute", "epic")[0];
  const adrs = phaseEls(ctx, "design", "adr");
  const states = phaseEls(ctx, "design", "state");
  const defineAcs = phaseEls(ctx, "define", "acceptance_criterion");
  const outOfScope = phaseEls(ctx, "define", "out_of_scope");
  const upstreamOqTexts = [...phaseOqs(ctx, "define"), ...phaseOqs(ctx, "design")].map((q) => q.question);

  // Resolve entity sets from the model once (used across stories).
  const systems = systemsFrom(model);
  const actions = actionsFrom(model);
  const actors = actorsFrom(model);
  const authSystems = systems.filter(isAuthEntity);
  const riskSystems = systems.filter(isRiskEntity);
  const riskActions = actions.filter(isRiskEntity);
  const hasAuthOrRisk = authSystems.length > 0 || riskSystems.length > 0 || riskActions.length > 0;

  // Narrative requirements the model could not type — to be passed through as
  // explicit "confirm with PO" items in every dev-prompt's open questions.
  const narrativeReqs = narrativeRequirements(model);
  const narrativeOpenItems: string[] = narrativeReqs.map(
    (r) =>
      `Narrative requirement could not be typed into a controlled EARS obligation — confirm its testable meaning with the PO before building: "${stripPeriod(r.text)}"`,
  );

  // Mandatory typed requirements (SHALL / MUST) for the CADMUS spec constraints.
  const mandatoryReqs = requirementsByModality(model, "mandatory");
  const optionalReqs = requirementsByModality(model, "optional");

  let emittedContract = false;
  let auditEdgeRaised = false;

  for (const story of stories) {
    const acIds = (story.fields?.acRefs as string[]) ?? [];
    const acs = defineAcs.filter((ac) => acIds.includes(ac.id));

    // ── THE PROMOTION: Implementation plan ──────────────────────────────────
    // v1: planLines driven by story.fields.labels (keyword buckets → ADR tag
    // matching). Semantic: planLines driven by:
    //   1. The reconciled entities the story's requirements name.
    //   2. ADRs that cite those entities (by entityId field, or by entity variant).
    //   3. States, as before (triggered by auth/risk ENTITY presence, not label).

    const storyReqs = requirementsForStory(story, model);
    const planLines: string[] = [];
    const planRefs: string[] = [story.id];

    // Entities touched by this story (deduplicated, ordered).
    const touchedEntityIds = new Set<string>(storyReqs.flatMap((r) => r.entityRefs));
    const touchedEntities = [...touchedEntityIds]
      .map((id) => entityById(model, id))
      .filter((e): e is CanonicalEntity => Boolean(e));

    if (touchedEntities.length) {
      const entityList = touchedEntities
        .map((e) => `${e.display} (${e.role}, reconciled from ${e.variants.map((v) => `"${v}"`).join(", ")})`)
        .join("; ");
      planLines.push(`Story touches reconciled ${touchedEntities.length > 1 ? "entities" : "entity"}: ${entityList}.`);
      planRefs.push(...touchedEntities.flatMap((e) => e.sourceRefs));
    }

    // ADR matching: prefer entityId field match, fall back to variant-text match.
    for (const adr of adrs) {
      const adrEntityId = (adr.fields?.entityId as string | undefined) ?? "";
      const adrTags = (adr.fields?.tags as string[]) ?? [];
      const entityMatch =
        touchedEntityIds.has(adrEntityId) ||
        touchedEntities.some((e) =>
          e.variants.some((v) =>
            adrTags.some((t) => v.toLowerCase().includes(t)) ||
            (adr.title ?? "").toLowerCase().includes(e.key.toLowerCase()),
          ),
        );
      if (entityMatch) {
        planLines.push(`Honor ADR "${adr.title ?? adr.id}" — see its decision and consequences.`);
        planRefs.push(adr.id);
      }
    }

    // States apply when auth or risk entities are present (same rule as v1,
    // now entity-grounded rather than label-string-grounded).
    const storyTouchesAuthOrRisk =
      touchedEntities.some((e) => isAuthEntity(e) || isRiskEntity(e)) ||
      (touchedEntities.length === 0 && hasAuthOrRisk);
    if (storyTouchesAuthOrRisk && states.length) {
      planLines.push("Implement every state defined in Design — including blocked and expired paths.");
      planRefs.push(...states.map((s) => s.id));
    }

    planLines.push(
      "Implement to satisfy the story's acceptance criteria exactly; flag any gap as an open question rather than assuming.",
    );

    c.el("implementation_plan", planLines.map((l) => `- ${l}`).join("\n"), planRefs, {
      title: `Plan — ${story.title ?? story.id}`,
    });

    // ── Dev prompt — CADMUS llmPrompt, grounded in typed obligations ─────────
    // THE PROMOTION:
    //   acceptance: typed requirement texts (+ EARS modality tag for context)
    //               where v1 used raw AC body strings. If no typed reqs for this
    //               story, fall back to the same raw AC bodies v1 used — honest.
    //   constraints: mandatory typed requirements + raw intent constraints.
    //   open: upstream open questions + narrativeOpenItems (the model's typed gap).

    const typedAcceptance =
      storyReqs.length
        ? storyReqs.map((r) => {
            const tag = r.typing.ears !== "narrative" ? ` [${r.typing.modality}/${r.typing.ears}]` : "";
            return `${tidy(r.text)}${tag}`;
          })
        : acs.map((ac) => ac.body);

    const typedConstraints: string[] = [
      ...mandatoryReqs.map((r) => `[mandatory] ${tidy(r.text)}`),
      ...optionalReqs.map((r) => `[optional] ${tidy(r.text)}`),
      ...intent.constraints.map((x) => tidy(x)),
    ];

    // Deduplicate: if a mandatory req text overlaps with an intent.constraint
    // line, keep the typed version (the one with the [mandatory] tag wins).
    const seenConstraintTexts = new Set<string>();
    const deduplicatedConstraints = typedConstraints.filter((c) => {
      const key = c.replace(/^\[(?:mandatory|optional)\]\s*/, "").toLowerCase().trim();
      if (seenConstraintTexts.has(key)) return false;
      seenConstraintTexts.add(key);
      return true;
    });

    const specOpenItems = [...upstreamOqTexts, ...narrativeOpenItems];

    const spec: CadmusSpec = {
      objective: `Implement "${story.title ?? story.id}" for ${intent.title}.`,
      audience: `Engineering handoff for the pilot slice of "${intent.title}".`,
      role: "a senior software engineer",
      acceptance: typedAcceptance.length
        ? typedAcceptance
        : [
            `The result directly accomplishes the story: ${story.title ?? story.id}.`,
            "Every claim is grounded in the provided inputs — nothing is invented or silently assumed.",
          ],
      outOfScope: outOfScope.length
        ? outOfScope.map((o) => o.body)
        : [
            "Anything beyond the stated objective.",
            "Speculative features or scope not explicitly requested.",
          ],
      constraints: deduplicatedConstraints,
      format: "A short implementation plan, then the code changes with tests.",
      open: specOpenItems,
    };

    c.el("dev_prompt", llmPrompt(spec), [story.id, ...acIds, ...constraints.map((a) => a.id)], {
      title: `Dev prompt — ${story.title ?? story.id}`,
      fields: { use: "paste into your approved AI coding assistant", emittedBy: "CADMUS llmPrompt" },
    });

    // ── Edge cases ────────────────────────────────────────────────────────────
    // v1: keyed off labels (keyword-bucket strings). Semantic: keyed off entity
    // role + variant text. Same EDGE_BY_ROLE table; same structural logic.
    // Auth-flavoured system entities → EDGE_BY_ROLE["system"] edges.
    // Risk-flavoured action entities → EDGE_BY_ROLE["action"] edges.

    if (storyTouchesAuthOrRisk || touchedEntities.some((e) => isAuthEntity(e))) {
      for (const edge of EDGE_BY_ROLE["system"] ?? []) {
        c.el("edge_case", edge, [story.id]);
      }
    }
    if (touchedEntities.some((e) => isRiskEntity(e)) || riskActions.length > 0) {
      for (const edge of EDGE_BY_ROLE["action"] ?? []) {
        c.el("edge_case", edge, [story.id]);
      }
    }

    // Numeric budget edge cases — unchanged from v1 (budgeted constraints are
    // still found via numbersWithUnits on the raw constraint text; the model
    // also captures them as budgetedRequirements, but the raw constraints are
    // what the define/distribute phases used, so we preserve exact parity).
    const isPerformanceStory =
      storyReqs.some((r) => /latency|speed|fast|performance|p95|slow/i.test(r.text)) ||
      (story.fields?.labels as string[] | undefined)?.includes("performance");
    if (isPerformanceStory) {
      for (const a of constraints) {
        for (const n of numbersWithUnits(a.text)) {
          c.el("edge_case", `Boundary: the flow completes exactly at the stated budget (${n.raw}).`, [story.id, a.id]);
        }
      }
    }

    // Audit edge case — triggered by audit-related entities or the "audit" action.
    const storyIsAudit =
      touchedEntities.some((e) => /audit|log|trail|record/i.test(e.variants.join(" "))) ||
      actions.some((e) => /audit|log|trail|record/i.test(e.variants.join(" ")));
    if (storyIsAudit && !auditEdgeRaised) {
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

    // ── Interface contract ───────────────────────────────────────────────────
    // Same rule as v1: emit exactly once, when auth/risk entities are present.
    // sourceRefs now cite the auth system entity's own sourceRefs (provenance)
    // in addition to the story, rather than just the auth-ADR id.
    if ((storyTouchesAuthOrRisk || hasAuthOrRisk) && !emittedContract) {
      emittedContract = true;
      const authAdr = adrs.find((a) => {
        const adrEntityId = (a.fields?.entityId as string | undefined) ?? "";
        return authSystems.some((s) => s.id === adrEntityId) ||
          authSystems.some((s) => s.variants.some((v) => (a.title ?? "").toLowerCase().includes(v.toLowerCase())));
      }) ?? adrs.find((a) => ((a.fields?.tags as string[]) ?? []).includes("auth"));

      const contractSourceRefs = [
        story.id,
        ...(authAdr ? [authAdr.id] : []),
        ...authSystems.flatMap((s) => s.sourceRefs),
      ];

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
        contractSourceRefs,
        { title: "Challenge contract (stub)", fields: { language: "ts" } },
      );
    }
  }

  if (!emittedContract) {
    c.oq("contract", "No interface contracts are derivable from the intent — define service boundaries with the team.");
  }

  // ── Handoff ────────────────────────────────────────────────────────────────
  // Identical structure to v1. sourceRefs still include the epic + stories + ADRs
  // because those are the actual upstream artifacts. Entity provenance rides in the
  // individual elements above; the handoff just points at the navigation anchors.
  const handoffRefs = [
    ...(epic ? [epic.id] : []),
    ...stories.map((s) => s.id),
    ...adrs.map((a) => a.id),
    ...actors.flatMap((a) => a.sourceRefs),
  ];

  // Include a note about the entity grounding so the engineer knows the plan lines
  // are entity-sourced, not keyword-bucket-sourced.
  const entitySummary =
    model.entities.length
      ? `Grounded in ${model.entities.length} reconciled entit${model.entities.length === 1 ? "y" : "ies"} (${model.entities.map((e) => e.display).join(", ")}) from the semantic model.`
      : "No entities were reconciled from the intent — plans are structurally derived.";

  c.el(
    "handoff",
    [
      `Start from the epic and its ${stories.length} stor${stories.length === 1 ? "y" : "ies"}; every story carries its acceptance criteria inline.`,
      `Honor the ${adrs.length} design decision record${adrs.length === 1 ? "" : "s"} and the state set from Design.`,
      "Every element carries sourceRefs — any line can be traced back to the original intent before you build on it.",
      entitySummary,
      ...(narrativeReqs.length
        ? [
            `${narrativeReqs.length} requirement(s) could not be deterministically typed (see dev-prompt open questions) — confirm with the PO before building against them.`,
          ]
        : []),
    ].join("\n"),
    handoffRefs.length ? handoffRefs : ["intent.title"],
    { title: "Engineering handoff" },
  );

  return c.done();
}
