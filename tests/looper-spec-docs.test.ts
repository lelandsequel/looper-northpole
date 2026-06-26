import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { INITIATIVES } from "../lib/agility/seed/initiatives.mjs";
import { initiativeToIntent } from "../lib/loop/adapter";
import { runSixDCosmic } from "../lib/six-d/cosmic";
import { epicStoriesMarkdown, writeSpecDocs } from "../lib/looper/docs";
import { extractJiraPayload } from "../lib/jira/extract";
import { sha256Hex, stableStringify } from "../lib/six-d/helpers";
import { DATA_DIR } from "../lib/store/paths";

const HL002 = INITIATIVES.find((i) => i.id === "HL-002")!;

test("epic-stories.md contains epic title and acceptance criteria", async () => {
  const { run, entry } = await runSixDCosmic(initiativeToIntent(HL002));
  const payload = extractJiraPayload(run, "HL-002", entry.hash)!;
  const md = epicStoriesMarkdown(payload);
  assert.match(md, new RegExp(`# Epic: ${payload.epic.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.match(md, /## Stories/);
  assert.match(md, /Acceptance criteria/);
  for (const story of payload.stories) {
    assert.match(md, new RegExp(story.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("writeSpecDocs creates epic-stories.md and full-spec.md on disk", async () => {
  const { run, entry } = await runSixDCosmic(initiativeToIntent(HL002));
  const payload = extractJiraPayload(run, "HL-002", entry.hash)!;
  const emitHash = await sha256Hex(stableStringify(payload));
  const docs = writeSpecDocs(run, "HL-002", entry.hash, emitHash);

  assert.ok(fs.existsSync(docs.paths.epicStories));
  assert.ok(fs.existsSync(docs.paths.fullSpec));
  assert.ok(docs.fullSpec.includes("6D Workbench"));
  assert.ok(docs.fullSpec.includes("COSMIC"));

  fs.rmSync(docs.dir, { recursive: true, force: true });
});

test("deterministic — same run ⇒ same epic-stories markdown", async () => {
  const intent = initiativeToIntent(HL002);
  const a = await runSixDCosmic(intent);
  const b = await runSixDCosmic(intent);
  const pa = extractJiraPayload(a.run, "HL-002", a.entry.hash)!;
  const pb = extractJiraPayload(b.run, "HL-002", b.entry.hash)!;
  assert.equal(epicStoriesMarkdown(pa), epicStoriesMarkdown(pb));
});