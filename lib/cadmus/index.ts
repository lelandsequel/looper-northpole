// CADMUS — turns messy intent into a buildable spec and an LLM-ready prompt.
//
// Deterministic. No model, no API key. The discipline IS the product: it forces
// an objective, testable acceptance criteria, explicit non-goals, constraints,
// and a "refuse-when-underspecified" guardrail into every prompt it emits — so
// whoever pastes the result into an LLM gets grounded, scoped output instead of
// confident guessing.

export type CadmusInput = {
  intent: string;
  audience?: string;
  role?: string;
  done?: string;
  nonGoals?: string;
  constraints?: string;
  format?: string;
};

export type CadmusSpec = {
  objective: string;
  audience: string;
  role: string;
  acceptance: string[];
  outOfScope: string[];
  constraints: string[];
  format: string;
  open: string[];
};

const splitLines = (s?: string): string[] =>
  String(s ?? "")
    .split(/\n|;|•|·|•/)
    .map((x) => x.trim())
    .filter(Boolean);

const cap = (s: string): string => {
  const t = s.trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
};
const period = (s: string): string => {
  const t = s.trim();
  return t && !/[.!?:]$/.test(t) ? t + "." : t;
};
const tidy = (s: string): string => period(cap(s));

export function buildSpec(input: CadmusInput): CadmusSpec {
  const objective = cap(String(input.intent ?? "").trim());
  const audience = String(input.audience ?? "").trim();
  const role = String(input.role ?? "").trim();
  const format = String(input.format ?? "").trim();

  const doneLines = splitLines(input.done);
  const acceptance = doneLines.length
    ? doneLines.map(tidy)
    : [
        `The result directly accomplishes the objective${objective ? `: ${objective.replace(/\.$/, "")}` : ""}.`,
        "Every claim is grounded in the provided inputs — nothing is invented or silently assumed.",
        format
          ? `The output is delivered as: ${format}.`
          : "The output is in a clear, immediately usable format.",
      ];

  const ng = splitLines(input.nonGoals);
  const outOfScope = ng.length
    ? ng.map(tidy)
    : [
        "Anything beyond the stated objective.",
        "Speculative features, options, or scope that were not explicitly requested.",
      ];

  const constraints = splitLines(input.constraints).map(tidy);

  const open: string[] = [];
  if (!audience) open.push("Who is the audience, and in what context will this be used?");
  if (!doneLines.length) open.push("What does “done” look like — how will we verify it's correct?");
  if (!constraints.length) open.push("Are there constraints (time, tools, compliance, length, tone, format)?");

  return { objective, audience, role, acceptance, outOfScope, constraints, format, open };
}

export function specMarkdown(spec: CadmusSpec): string {
  const L: string[] = [];
  L.push("# Spec");
  L.push("");
  L.push(`**Objective:** ${spec.objective || "(state the objective)"}`);
  if (spec.audience) L.push(`**Audience / context:** ${spec.audience}`);
  if (spec.role) L.push(`**Acting role:** ${spec.role}`);
  L.push("");
  L.push("## Acceptance criteria — must all be satisfied");
  spec.acceptance.forEach((a) => L.push(`- ${a}`));
  L.push("");
  L.push("## Non-goals — explicitly out of scope");
  spec.outOfScope.forEach((a) => L.push(`- ${a}`));
  if (spec.constraints.length) {
    L.push("");
    L.push("## Constraints");
    spec.constraints.forEach((c) => L.push(`- ${c}`));
  }
  if (spec.format) {
    L.push("");
    L.push("## Output format");
    L.push(spec.format);
  }
  if (spec.open.length) {
    L.push("");
    L.push("## Open questions — resolve before building");
    spec.open.forEach((q) => L.push(`- ${q}`));
  }
  return L.join("\n");
}

export function llmPrompt(spec: CadmusSpec): string {
  const L: string[] = [];
  L.push(`You are ${spec.role || "a careful, senior expert"}.`);
  L.push("");
  L.push("# Task");
  L.push(spec.objective || "(describe the task)");
  if (spec.audience) {
    L.push("");
    L.push("# Context");
    L.push(spec.audience);
  }
  L.push("");
  L.push("# Requirements — your output MUST satisfy ALL of these");
  spec.acceptance.forEach((a) => L.push(`- ${a}`));
  L.push("");
  L.push("# Out of scope — do NOT do these");
  spec.outOfScope.forEach((a) => L.push(`- ${a}`));
  if (spec.constraints.length) {
    L.push("");
    L.push("# Constraints");
    spec.constraints.forEach((c) => L.push(`- ${c}`));
  }
  if (spec.format) {
    L.push("");
    L.push("# Output format");
    L.push(spec.format);
  }
  L.push("");
  L.push("# Discipline — non-negotiable");
  L.push("- Ground every claim. If you lack the information to satisfy a requirement, say so explicitly instead of guessing.");
  L.push("- Do not invent facts, sources, names, numbers, or citations.");
  if (spec.open.length) {
    L.push("- Before answering, resolve or state your assumptions for these open questions:");
    spec.open.forEach((q) => L.push(`    - ${q}`));
  } else {
    L.push("- If any requirement is ambiguous, state your assumptions before answering.");
  }
  return L.join("\n");
}
