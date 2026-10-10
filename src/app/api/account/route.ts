import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { serpapiAccount } from "@/lib/serpapi/client";

export async function GET() {
  try {
    return NextResponse.json(await serpapiAccount());
  } catch (err) {
    return errorResponse(err);
  }
}
