import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api";
import { AIRLINE_PROGRAMS, BANK_PROGRAMS, getSettings, saveSettings, settingsSchema } from "@/lib/settings";

export async function GET() {
  try {
    return NextResponse.json({ settings: getSettings(), airlines: AIRLINE_PROGRAMS, banks: BANK_PROGRAMS });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: Request) {
  try {
    const next = settingsSchema.parse(await readJson(req));
    return NextResponse.json({ settings: saveSettings(next) });
  } catch (err) {
    return errorResponse(err);
  }
}
