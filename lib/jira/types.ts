// LOOPER → Jira emit adapter — shared types.
//
// Schema: looper.jira.emit.v1
// Verification-first: nothing emits until extract + verify pass.
// Deterministic: same CosmicRun + receipt ⇒ same payload hash.

export const JIRA_EMIT_SCHEMA = "looper.jira.emit.v1" as const;

export type JiraEpic = {
  epicId: string;
  title: string;
  description: string;
};

export type JiraStory = {
  storyId: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  estimate?: string;
  labels: string[];
  dependsOn: string[];
};

/** Verified, ticket-ready payload extracted from a sealed 6D COSMIC run. */
export type JiraEmitPayload = {
  schema: typeof JIRA_EMIT_SCHEMA;
  initiativeId: string;
  specReceipt: string;
  cosmicRunHash: string;
  epic: JiraEpic;
  stories: JiraStory[];
};

export type JiraVerifyRefusal = {
  ok: false;
  refused: true;
  reasons: string[];
};

export type JiraVerifyOk = {
  ok: true;
  payload: JiraEmitPayload;
  emitHash: string;
};

export type JiraVerifyResult = JiraVerifyRefusal | JiraVerifyOk;

export type JiraAdapterKind = "file" | "http";

export type JiraEmitOutcome = {
  adapter: JiraAdapterKind;
  status: "emitted" | "refused";
  emitHash?: string;
  payload?: JiraEmitPayload;
  reasons?: string[];
  /** File adapter: path written. HTTP adapter: created issue keys. */
  artifact?: string | { epicKey: string; storyKeys: string[] };
  ledgerSeq?: number;
  ledgerSha?: string;
};