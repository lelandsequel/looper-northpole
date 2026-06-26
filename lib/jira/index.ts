// LOOPER → Jira epic/story emit adapter.
//
// Pipeline: extract (6D Distribute) → verify (AURORA + ACs + receipt) → emit (file | http)
//
// See SPEC.md for the full contract.

export type {
  JiraAdapterKind,
  JiraEmitOutcome,
  JiraEmitPayload,
  JiraEpic,
  JiraStory,
  JiraVerifyResult,
} from "./types";

export { extractJiraPayload } from "./extract";
export { verifyJiraEmit } from "./verify";
export { emitJiraToFile } from "./emit-file";
export { emitJiraToHttp, jiraHttpConfigFromEnv } from "./emit-http";
export { previewJiraEmit, emitJira, getLatestJiraEmit } from "./pipeline";