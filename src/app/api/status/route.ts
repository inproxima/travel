import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { features } from "@/lib/env";

export async function GET() {
  try {
    return NextResponse.json(features());
  } catch (err) {
    return errorResponse(err);
  }
}
