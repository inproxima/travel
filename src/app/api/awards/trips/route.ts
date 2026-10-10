import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api";
import { awardTrips } from "@/lib/seatsaero";

const input = z.object({ id: z.string().min(1).max(200) });

export async function POST(req: Request) {
  try {
    return NextResponse.json(await awardTrips(input.parse(await readJson(req)).id, req.signal));
  } catch (err) {
    return errorResponse(err);
  }
}
