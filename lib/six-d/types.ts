// 6D Workbench — shared types.
//
// The whole system is a deterministic pipeline: a FeatureIntent is decomposed
// into referencable atoms (IntentRef), six pure phase transforms produce
// PhaseArtifacts whose every element carries sourceRefs back to the atoms (or
// to upstream elements), and the run is sealed with a SHA-256 receipt over the
// canonicalized manifest. No model, no network, no clock — same input, same
// bytes, same hash.

export type PhaseId =
  | "define"
  | "design"
  | "distribute"
  | "develop"
  | "detect"
  | "deliver";

export type FeatureIntent = {
  /** Stable slug derived from the title at normalization time. */
  id: string;
  title: string;
  /** The messy ask, verbatim. */
  context: string;
  goals: string[];
  constraints: string[];
  sourceMaterial: string[];
};

/** The intent decomposed into atoms every artifact element can point back to. */
export type IntentRef = {
  id: string; // "intent.title" | "intent.context.2" | "intent.goal.1" | ...
  kind: "title" | "context" | "goal" | "constraint" | "source";
  text: string;
};

export type ArtifactElement = {
  id: string; // "<phase>.<kind>.<n>" — stable by construction order
  kind: string; // "acceptance_criterion" | "story" | "adr" | "test_scenario" | ...
  title?: string;
  body: string; // markdown-ish text, rendered pre-wrap
  /** Structured extras: given/when/then, estimate, labels, dependsOn, language… */
  fields?: Record<string, string | string[]>;
  /** Ids of intent atoms and/or upstream elements this element derives from. */
  sourceRefs: string[];
};

export type OpenQuestion = {
  id: string; // "<phase>.oq.<n>"
  phase: PhaseId;
  about: string; // the field/element the gap concerns
  question: string;
  blocking: boolean;
};

export type PhaseArtifact = {
  phase: PhaseId;
  n: number; // 1..6
  name: string; // "Define" ...
  role: string; // "POs & APOs" ...
  deliverable: string; // "PRD" ...
  elements: ArtifactElement[];
  openQuestions: OpenQuestion[];
};

export type RunManifest = {
  schema: "6d.run.v1";
  intent: FeatureIntent;
  intentIndex: IntentRef[];
  artifacts: PhaseArtifact[]; // exactly 6, in phase order
  generatedBy: string;
  /** sha256 hex over canonical(manifest minus this field). */
  receipt: string;
};

export type TraceProblem = { elementId: string; ref: string; problem: string };

export type PhaseCtx = {
  intent: FeatureIntent;
  index: IntentRef[];
  /** Every resolvable id so far: intent atoms + upstream elements. */
  byId: Map<string, IntentRef | ArtifactElement>;
  upstream: PhaseArtifact[];
};

export const PHASE_META: Array<{
  phase: PhaseId;
  n: number;
  name: string;
  role: string;
  deliverable: string;
}> = [
  { phase: "define", n: 1, name: "Define", role: "POs & APOs", deliverable: "PRD" },
  { phase: "design", n: 2, name: "Design", role: "UX", deliverable: "Design direction & decision records" },
  { phase: "distribute", n: 3, name: "Distribute", role: "Agility", deliverable: "Story map & ticket-ready slices" },
  { phase: "develop", n: 4, name: "Develop", role: "SWE", deliverable: "Engineering handoff" },
  { phase: "detect", n: 5, name: "Detect", role: "QA", deliverable: "Test design" },
  { phase: "deliver", n: 6, name: "Deliver", role: "SRE", deliverable: "Release & ops inputs" },
];
