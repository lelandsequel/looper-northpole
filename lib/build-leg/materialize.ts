import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";


import type { PriceQuoteFn } from "./demo/contract";
import type { CandidateBuild } from "./types";

const MODULE_CANDIDATES = ["priceQuote.ts", "priceQuote.mjs", "priceQuote.js"];

function pickModuleSource(modules: Record<string, string>): { name: string; source: string } | null {
  for (const name of MODULE_CANDIDATES) {
    if (modules[name]) return { name, source: modules[name] };
  }
  const key = Object.keys(modules).find((k) => /priceQuote\.(ts|mjs|js)$/i.test(k));
  if (!key) return null;
  return { name: key, source: modules[key]! };
}

async function toMjsSource(source: string, filename: string): Promise<string> {
  let body = source.trim();
  if (/\.tsx?$/i.test(filename)) {
    const { transformSync } = await import("esbuild");
    body = transformSync(body, { loader: "ts", format: "esm", target: "node18" }).code;
  }
  if (!/\bexport\b/.test(body)) {
    body = `export const priceQuote = ${body}`;
  }
  return body;
}

/**
 * Turn a CandidateBuild into a runnable priceQuote fn.
 * Inline fn passes through; modules are written to a temp sandbox and imported.
 */
export async function materializeCandidate(raw: CandidateBuild): Promise<CandidateBuild> {
  if (typeof raw.priceQuote === "function") {
    return {
      ...raw,
      meta: { ...raw.meta, source: raw.meta?.source ?? "inline", materializedFrom: "inline" },
    };
  }

  if (!raw.modules || !Object.keys(raw.modules).length) {
    return raw;
  }

  const picked = pickModuleSource(raw.modules);
  if (!picked) return raw;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "northpole-build-"));
  const outName = "priceQuote.mjs";
  const outPath = path.join(dir, outName);
  fs.writeFileSync(outPath, await toMjsSource(picked.source, picked.name), "utf8");

  try {
    const mod = (await import(pathToFileURL(outPath).href)) as { priceQuote?: PriceQuoteFn };
    if (typeof mod.priceQuote !== "function") {
      return raw;
    }
    return {
      priceQuote: mod.priceQuote,
      meta: {
        source: "agent",
        agentReceipt: raw.meta?.agentReceipt ?? null,
        materializedFrom: picked.name,
      },
    };
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }
}