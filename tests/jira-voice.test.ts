import assert from "node:assert/strict";
import test from "node:test";

import { INITIATIVES } from "../lib/agility/seed/initiatives.mjs";
import { initiativeToIntent } from "../lib/loop/adapter";
import { runSixDCosmic } from "../lib/six-d/cosmic";
import { extractJiraPayload } from "../lib/jira/extract";
import { epicStoriesMarkdown } from "../lib/looper/docs";
import {
  polishAcceptanceCriterion,
  polishStoryDescription,
  polishStoryTitle,
} from "../lib/jira/voice";

const HL002 = INITIATIVES.find((i) => i.id === "HL-002")!;

test("voice strips boilerplate from story titles and descriptions", async () => {
  const { run, entry } = await runSixDCosmic(initiativeToIntent(HL002));
  const payload = extractJiraPayload(run, "HL-002", entry.hash)!;

  for (const story of payload.stories) {
  assert.ok(!story.title.toLowerCase().includes("deliver the stated outcome"));
  assert.ok(!story.description.includes("delivers its intended outcome"));
  assert.ok(!story.description.includes("As a agent"));
    assert.ok(!story.description.includes("\n\nAcceptance:"));
  }
});

test("voice shortens acceptance criteria", () => {
  const ac = polishAcceptanceCriterion(
    "Given the feature is active in the pilot slice, when the covered workflow runs, then: Correspondent real-time loan pricing.",
  );
  assert.equal(ac, "Correspondent real-time loan pricing.");
});

test("epic-stories markdown has no duplicated acceptance block in description", async () => {
  const { run, entry } = await runSixDCosmic(initiativeToIntent(HL002));
  const payload = extractJiraPayload(run, "HL-002", entry.hash)!;
  const md = epicStoriesMarkdown(payload);
  assert.ok(!md.includes("Acceptance:\n-"));
  assert.match(md, /I want/);
});

test("polish helpers are deterministic", () => {
  const raw =
    'As a user, I need: deliver the stated outcome: pricing — so that "Title" delivers its intended outcome.';
  assert.equal(polishStoryDescription(raw), polishStoryDescription(raw));
  assert.equal(polishStoryTitle("Deliver the stated outcome: pricing"), polishStoryTitle("Deliver the stated outcome: pricing"));
});