import fs from "node:fs";

import type { Initiative } from "@/lib/agility/types";
import { INITIATIVES } from "@/lib/agility/seed/initiatives.mjs";
import { replaceInitiatives } from "@/lib/store/initiatives";
import { DB_PATH } from "@/lib/store/paths";
import { getDb } from "@/lib/store/db";

let seeded = false;

/** Idempotent seed — safe on every cold start (Vercel /tmp). */
export function ensureSeeded(): void {
  if (seeded) return;
  getDb();
  if (!fs.existsSync(DB_PATH)) {
    seedNow();
    seeded = true;
    return;
  }
  const row = getDb().prepare("SELECT COUNT(*) as c FROM initiatives").get() as { c: number };
  if (row.c === 0) {
    seedNow();
  }
  seeded = true;
}

function seedNow(): void {
  const items = INITIATIVES.filter((i) => i.id !== "HL-013") as unknown as Initiative[];
  replaceInitiatives(items);
}