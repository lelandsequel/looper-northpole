import { getDb } from "./db";
import type { Initiative } from "@/lib/agility/types";

export function listInitiatives(): Initiative[] {
  const rows = getDb()
    .prepare("SELECT payload FROM initiatives ORDER BY created_at ASC")
    .all() as Array<{ payload: string }>;
  return rows.map((r) => JSON.parse(r.payload) as Initiative);
}

export function getInitiative(id: string): Initiative | null {
  const row = getDb()
    .prepare("SELECT payload FROM initiatives WHERE id = ?")
    .get(id) as { payload: string } | undefined;
  return row ? (JSON.parse(row.payload) as Initiative) : null;
}

export function upsertInitiative(initiative: Initiative): void {
  getDb()
    .prepare(
      `INSERT INTO initiatives (id, payload) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
    )
    .run(initiative.id, JSON.stringify(initiative));
}

export function replaceInitiatives(initiatives: Initiative[]): void {
  const database = getDb();
  const tx = database.transaction((items: Initiative[]) => {
    database.prepare("DELETE FROM initiatives").run();
    const insert = database.prepare("INSERT INTO initiatives (id, payload) VALUES (?, ?)");
    for (const it of items) insert.run(it.id, JSON.stringify(it));
  });
  tx(initiatives);
}