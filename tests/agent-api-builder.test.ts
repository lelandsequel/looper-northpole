import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { apiBuilder } from "../lib/build-leg/adapters/agent-api";
import { runBuildLeg, STALE_DATA_STORY } from "../lib/build-leg";
import { materializeCandidate } from "../lib/build-leg/materialize";

const fixedSource = fs.readFileSync(
  path.join(process.cwd(), "lib/build-leg/demo/candidate/priceQuote.ts"),
  "utf8",
);
const brokenSource = fs.readFileSync(
  path.join(process.cwd(), "lib/build-leg/demo/broken/priceQuote.ts"),
  "utf8",
);

test("materializeCandidate loads priceQuote from agent modules", async () => {
  const out = await materializeCandidate({
    modules: { "priceQuote.ts": fixedSource },
    meta: { source: "agent" },
  });
  assert.equal(typeof out.priceQuote, "function");
});

test("apiBuilder: round 1 broken → REFUSE, round 2 fixed → ships", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async (_url, init) => {
    calls += 1;
    const body = JSON.parse(String(init?.body ?? "{}")) as { round: number };
    const source = body.round <= 1 ? brokenSource : fixedSource;
    return new Response(JSON.stringify({ ok: true, modules: { "priceQuote.ts": source } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const builder = apiBuilder({ url: "http://agent.test/build", fetchImpl });
  const result = await runBuildLeg(STALE_DATA_STORY, builder, { maxRounds: 3 });

  assert.equal(calls, 2);
  assert.equal(result.status, "shipped");
  assert.equal(result.roundsToGreen, 2);
  assert.equal(result.rounds[0].verdict.verdict, "REFUSE");
  assert.equal(result.rounds[1].verdict.verdict, "NO_OBJECTION");
});

test("apiBuilder throws when agent returns ok:false", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ ok: false, error: "out of tokens" }), { status: 200 });

  const builder = apiBuilder({ url: "http://agent.test/build", fetchImpl });
  await assert.rejects(() => runBuildLeg(STALE_DATA_STORY, builder, { maxRounds: 1 }), /out of tokens/);
});