import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api";
import { addPlace, listPlaces } from "@/lib/settings";

const newPlace = z.object({
  label: z.string().trim().min(1).max(40),
  address: z.string().trim().min(3).max(200),
});

export async function GET() {
  try {
    return NextResponse.json({ places: listPlaces() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const { label, address } = newPlace.parse(await readJson(req));
    return NextResponse.json({ place: await addPlace(label, address) });
  } catch (err) {
    return errorResponse(err);
  }
}
