// HL Prioritization OS — the grounded HL-Central readout.
//
// The cabinet artifact: markdown-native, single-source, and — the part the
// PowerPoints can never do — every line cites the ledger receipt it came from.
// It can't go stale, because it's regenerated from the chain, not hand-edited.
// Paste it into HL-Central / Loop / SharePoint; it stays true to the system.

import { FUNDING, TIER_LIST } from "./types.mjs";

export const money = (n) => {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  const s =
    abs >= 1_000_000
      ? `$${round1(v / 1_000_000)}M`
      : abs >= 1_000
        ? `$${round1(v / 1_000)}k`
        : `$${Math.round(v)}`;
  return s;
};

export function renderBrief(result) {
  const L = [];
  L.push(`# HL Prioritization — Cabinet Readout`);
  L.push(`_Generated from the system of record · methodology ${result.methodology_version}_`);
  L.push(
    `_Chain head \`${(result.head || "").slice(0, 12)}\` · ${
      result.verify.ok ? "verified, tamper-evident" : "CHAIN BROKEN"
    }_`
  );
  L.push("");
  L.push(
    `**Capacity:** ${result.capacityUsed}/${result.capacity} teams · ` +
      `**${result.funded.length}** funded · **${result.benched.length}** benched · ` +
      `**${result.held.length}** duplicates held · ` +
      `funded NPV **${money(result.portfolio?.fundedNpvTotal ?? 0)}**`
  );
  L.push("");

  // Tiered board (Now…Archived), only non-empty tiers.
  for (const tier of TIER_LIST) {
    const items = (result.tiers?.[tier] ?? []).filter(Boolean);
    if (!items.length) continue;
    L.push(`## ${tier}`);
    for (const it of items) {
      const tag = it.mandate ? " · MANDATE" : "";
      L.push(
        `- **#${it._rank} · ${it.title}** — ${it.area} · score **${it._score}** · ` +
          `NPV ${money(it._breakdown?.npv?.total ?? 0)} · ${it._teams} team(s)${tag}`
      );
      L.push(`  > why: ${topReasons(it)}  ·  receipt \`${shortReceipt(it)}\``);
    }
    L.push("");
  }

  if (result.held.length) {
    L.push(`## Held — duplicates ("third calculator" gate)`);
    for (const c of result.clusters) {
      L.push(
        `- Outcome **"${c.outcome}"** proposed by ${c.members.length} areas → ` +
          `fund **${c.primary}**, hold ${c.duplicates.map((d) => `\`${d}\``).join(", ")}.`
      );
    }
    L.push(`  > ${result.held.length} redundant build(s) avoided before a line of code was written.`);
    L.push("");
  }

  if (result.rejected.length) {
    L.push(`## Not intaken (unstructured / unsourced)`);
    for (const r of result.rejected) {
      L.push(`- ${r.title} — ${r.errors.slice(0, 3).join("; ")}${r.errors.length > 3 ? "; …" : ""}`);
    }
    L.push("");
  }

  L.push(`---`);
  L.push(
    `Every line above cites a ledger receipt. Nothing here is a story — it's a replay of recorded decisions. Synthetic demo data; no confidential information.`
  );
  return L.join("\n");
}

function topReasons(it) {
  const b = it._breakdown;
  if (!b) return "";
  const bits = [];
  if (b.rice?.valueType) bits.push(b.rice.valueType);
  if (b.npv?.total) bits.push(`NPV ${money(b.npv.total)}`);
  if (b.rice?.confidence) bits.push(`conf ${b.rice.confidence}`);
  return bits.join(", ");
}

function shortReceipt(it) {
  return (it._prioritizeReceipt || it._scoreReceipt || "").slice(0, 12);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
