#!/usr/bin/env node
// CLI parity check — same engine as LOOPER dashboard.
import { prioritize } from "../lib/agility/engine.mjs";
import { INITIATIVES } from "../lib/agility/seed/initiatives.mjs";

const capacity = Number(process.argv.find((a) => a.startsWith("--capacity="))?.split("=")[1] ?? 12);
const json = process.argv.includes("--json");
const initiatives = process.argv.includes("--seed") ? INITIATIVES : INITIATIVES;
const r = prioritize(initiatives, { capacity });

if (json) {
  console.log(JSON.stringify(r, (k, v) => (k === "ledger" ? undefined : v), 2));
} else {
  console.log(`capacity ${r.capacityUsed}/${r.capacity} · funded ${r.stats.funded} · head ${r.head?.slice(0, 16)}…`);
  for (const it of r.ranked) {
    console.log(`#${it._rank} ${it._funding} score=${it._score} raw=${it._priorityRaw} ${it.id} ${it.title}`);
  }
}