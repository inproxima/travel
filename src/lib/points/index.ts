import programs from "@/data/programs.json";
import transferPartners from "@/data/transfer-partners.json";

// Pure helpers, safe in the browser: which programs a traveller can use and
// what points are worth. Ratios in transfer-partners.json are miles per bank point.

export type Holding = { held: boolean; balance: number | null; cpp: number };
export type Holdings = Record<string, Holding>;

const AIRLINES = programs.airlines;
const BANKS = programs.banks;
const PARTNERS = transferPartners as unknown as Record<string, Record<string, number>>;

export function programName(id: string): string {
  return [...AIRLINES, ...BANKS].find((p) => p.id === id)?.name ?? id;
}

export function isBank(id: string): boolean {
  return BANKS.some((b) => b.id === id);
}

export type Route = {
  /** Where the points come from: the airline program itself, or a bank currency. */
  from: string;
  ratio: number;
  /** Points of `from` needed for the award. */
  pointsNeeded: number;
  balance: number | null;
  enough: boolean | null;
};

/** Every way the traveller can pay for `miles` in `program`, best first. */
export function waysToPay(program: string, miles: number, holdings: Holdings): Route[] {
  const routes: Route[] = [];
  const own = holdings[program];
  if (own?.held) routes.push({ from: program, ratio: 1, pointsNeeded: miles, balance: own.balance, enough: own.balance == null ? null : own.balance >= miles });
  for (const bank of BANKS) {
    const h = holdings[bank.id];
    const ratio = PARTNERS[bank.id]?.[program];
    if (!h?.held || !ratio) continue;
    const need = Math.ceil(miles / ratio / 1000) * 1000;
    routes.push({ from: bank.id, ratio, pointsNeeded: need, balance: h.balance, enough: h.balance == null ? null : h.balance >= need });
  }
  // Prefer routes the balance covers, then the fewest points.
  return routes.sort((a, b) => Number(b.enough === true) - Number(a.enough === true) || a.pointsNeeded - b.pointsNeeded);
}

/** Airline programs the traveller holds directly or can transfer into. */
export function usablePrograms(holdings: Holdings): string[] {
  const out = new Set<string>();
  for (const a of AIRLINES) if (holdings[a.id]?.held) out.add(a.id);
  for (const b of BANKS) if (holdings[b.id]?.held) for (const p of Object.keys(PARTNERS[b.id] ?? {})) out.add(p);
  return [...out];
}

/** Cents per point you get by paying taxes + miles instead of the cash fare. */
export function centsPerPoint(cashPrice: number | null, taxes: number | null, miles: number | null): number | null {
  if (cashPrice == null || miles == null || miles <= 0) return null;
  const value = ((cashPrice - (taxes ?? 0)) / miles) * 100;
  return value > 0 ? Math.round(value * 100) / 100 : null;
}

export type Estimate = { program: string; cpp: number; points: number; balance: number | null; enough: boolean | null };

/**
 * Points needed to cover a cash fare at the value the traveller set per point.
 * An estimate for "pay with points" or travel-portal bookings, not award space.
 */
export function estimatePoints(cashPrice: number | null, holdings: Holdings): Estimate[] {
  if (cashPrice == null) return [];
  return Object.entries(holdings)
    .filter(([, h]) => h.held && h.cpp > 0)
    .map(([program, h]) => {
      const points = Math.ceil(cashPrice / (h.cpp / 100) / 100) * 100;
      return { program, cpp: h.cpp, points, balance: h.balance, enough: h.balance == null ? null : h.balance >= points };
    })
    .sort((a, b) => Number(b.enough === true) - Number(a.enough === true) || a.points - b.points);
}

export function compactPoints(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 || n >= 100_000 ? 0 : 1)}k` : String(n);
}
