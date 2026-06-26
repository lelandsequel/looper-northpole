import fs from "node:fs";
import path from "node:path";

import { DATA_DIR } from "@/lib/store/paths";

import type { JiraEmitPayload } from "./types";

const EMIT_DIR = path.join(DATA_DIR, "jira-emits");

/** Write verified payload to data/jira-emits/ — default demo adapter. */
export function emitJiraToFile(payload: JiraEmitPayload, emitHash: string): string {
  fs.mkdirSync(EMIT_DIR, { recursive: true });
  const filename = `${payload.initiativeId}-${emitHash.slice(0, 16)}.json`;
  const filePath = path.join(EMIT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}