import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api";
import { features } from "@/lib/env";
import { addDays } from "@/lib/geo";
import { CABIN_TO_AWARD, type Cabin } from "@/lib/models";
import { usablePrograms } from "@/lib/points";
import { searchAwards } from "@/lib/seatsaero";
import { getSettings } from "@/lib/settings";

const code = z.string().trim().toUpperCase().regex(/^[A-Z]{3}(,[A-Z]{3})*$/);
const input = z.object({
  from: code,
  to: code,
  date: z.iso.date(),
  flexDays: z.number().int().min(0).max(7).default(3),
  cabins: z.array(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])).min(1).default([1, 2, 3, 4]),
  onlyMine: z.boolean().default(false),
  directOnly: z.boolean().default(false),
});

/** Award seats from seats.aero around a date. Uses no SerpApi credits. */
export async function POST(req: Request) {
  try {
    if (!features().seatsAero) return NextResponse.json({ error: "seats.aero isn't set up, so points show estimates only.", estimatesOnly: true }, { status: 409 });
    const q = input.parse(await readJson(req));
    const today = new Date().toISOString().slice(0, 10);
    const start = addDays(q.date, -q.flexDays) < today ? today : addDays(q.date, -q.flexDays);
    const sources = q.onlyMine ? usablePrograms(getSettings().programs) : undefined;
    if (sources && sources.length === 0) {
      return NextResponse.json({ error: "Select the programs you hold in Settings first, or turn off “Only programs I can use”." }, { status: 400 });
    }
    const days = await searchAwards(
      { origin: q.from, destination: q.to, startDate: start, endDate: addDays(q.date, q.flexDays), cabins: (q.cabins as Cabin[]).map((c) => CABIN_TO_AWARD[c]), sources, directOnly: q.directOnly },
      req.signal,
    );
    return NextResponse.json({ days, start, end: addDays(q.date, q.flexDays) });
  } catch (err) {
    return errorResponse(err);
  }
}
