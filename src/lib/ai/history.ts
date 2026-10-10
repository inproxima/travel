import { getDb } from "@/lib/db";
import type { PlannerResult } from "./types";

export type HistoryItem = { id: string; request: string; destination: string; topPick: string | null; createdAt: number };

export function saveResult(r: PlannerResult) {
  getDb()
    .prepare("INSERT INTO history (id, kind, title, body, created_at) VALUES (?, 'ai', ?, ?, ?)")
    .run(r.id, r.request.slice(0, 200), JSON.stringify(r), r.createdAt);
}

export function listResults(limit = 30): HistoryItem[] {
  const rows = getDb().prepare("SELECT id, body, created_at FROM history WHERE kind = 'ai' ORDER BY created_at DESC LIMIT ?").all(limit) as {
    id: string;
    body: string;
    created_at: number;
  }[];
  return rows.map((row) => {
    const r = JSON.parse(row.body) as PlannerResult;
    return { id: row.id, request: r.request, destination: r.spec.destination, topPick: r.ranked[0]?.hotel.name ?? null, createdAt: row.created_at };
  });
}

export function getResult(id: string): PlannerResult | null {
  const row = getDb().prepare("SELECT body FROM history WHERE id = ? AND kind = 'ai'").get(id) as { body: string } | undefined;
  return row ? (JSON.parse(row.body) as PlannerResult) : null;
}

export function deleteResult(id: string) {
  getDb().prepare("DELETE FROM history WHERE id = ? AND kind = 'ai'").run(id);
}
