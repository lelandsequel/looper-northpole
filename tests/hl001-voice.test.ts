import assert from "node:assert/strict";
import test from "node:test";

import { INITIATIVES } from "../lib/agility/seed/initiatives.mjs";
import { initiativeToIntent } from "../lib/loop/adapter";
import { extractJiraPayload } from "../lib/jira/extract";
import { runSixDCosmic } from "../lib/six-d/cosmic";
import { fullSpecMarkdown } from "../lib/looper/docs";
import {
  articleizeNounPhrase,
  decomposeBuildGoals,
  userWantClause,
} from "../lib/six-d/helpers";

const HL001 = INITIATIVES.find((i) => i.id === "HL-001")!;

test("HL-001 decomposes sign+onboard into two build slices", () => {
  const slices = decomposeBuildGoals(HL001.description, HL001.outcome);
  assert.deepEqual(slices, [
    "sign insurance agents into the marketplace",
    "onboard insurance agents into the marketplace",
  ]);
});

test("HL-001 voice adds articles and prefers onboard from context", () => {
  assert.equal(articleizeNounPhrase("insurance agent marketplace portal"), "the insurance agent marketplace portal");
  assert.equal(
    userWantClause(HL001.outcome, HL001.description),
    "I want to onboard the insurance agent marketplace portal",
  );
});

test("HL-001 spec: two build stories, epic NFRs, no metadata in design/dev prose", async () => {
  const { run, entry } = await runSixDCosmic(initiativeToIntent(HL001));
  const payload = extractJiraPayload(run, "HL-001", entry.hash)!;
  const md = fullSpecMarkdown(run);

  assert.equal(payload.stories.length, 2);
  assert.match(payload.stories[0].title, /sign/i);
  assert.match(payload.stories[1].title, /onboard/i);
  assert.ok(!payload.stories.some((s) => /validate revenue/i.test(s.title)));
  assert.ok(!payload.stories.some((s) => /scale to/i.test(s.title)));

  assert.match(payload.stories[0].description, /As an agent/);
  assert.ok(!payload.stories[0].description.includes("marketplace portal."));

  const design = run.manifest.artifacts.find((a) => a.phase === "design")!;
  const dir = design.elements.find((e) => e.kind === "design_direction")!.body;
  assert.match(dir, /Serve the agent/);
  assert.ok(!/outcome:/i.test(dir));
  assert.ok(!/area:/i.test(dir));
  assert.ok(!/sponsor:/i.test(dir));

  const develop = run.manifest.artifacts.find((a) => a.phase === "develop")!;
  const prompt = develop.elements.find((e) => e.kind === "dev_prompt")!.body;
  assert.ok(!/Outcome:/i.test(prompt));
  assert.ok(!/Area:/i.test(prompt));
  assert.ok(!/Budget cycle:/i.test(prompt));

  const define = run.manifest.artifacts.find((a) => a.phase === "define")!;
  assert.equal(define.elements.filter((e) => e.kind === "epic_nfr").length, 2);

  assert.ok(md.includes("Epic-level validation"));
});