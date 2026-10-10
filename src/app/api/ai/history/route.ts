import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { listResults } from "@/lib/ai/history";

export async function GET() {
  try {
    return NextResponse.json({ items: listResults() });
  } catch (err) {
    return errorResponse(err);
  }
}
