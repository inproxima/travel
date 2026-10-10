import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BudgetExceededError } from "@/lib/serpapi/budget";
import { SerpApiError } from "@/lib/serpapi/client";

/** Turns any thrown error into a JSON response the UI can show as-is. */
export function errorResponse(err: unknown) {
  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    return NextResponse.json({ error: `Invalid input: ${msg}` }, { status: 400 });
  }
  if (err instanceof BudgetExceededError) {
    return NextResponse.json({ error: err.message }, { status: 402 });
  }
  if (err instanceof SerpApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status && err.status >= 400 ? 502 : 500 });
  }
  if (err instanceof Error && err.name === "AbortError") {
    return NextResponse.json({ error: "Cancelled." }, { status: 499 });
  }
  const message = err instanceof Error ? err.message : "Something went wrong.";
  console.error(err);
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
