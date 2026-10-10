import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { env } from "@/lib/env";
import { Budget, BudgetExceededError } from "@/lib/serpapi/budget";
import { SerpApiError, type CallContext } from "@/lib/serpapi/client";
import { SeatsAeroError } from "@/lib/seatsaero";

/** Turns any thrown error into a JSON response the UI can show as-is. */
export function errorResponse(err: unknown) {
  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    return NextResponse.json({ error: `Invalid input: ${msg}` }, { status: 400 });
  }
  if (err instanceof BudgetExceededError) {
    return NextResponse.json({ error: err.message }, { status: 402 });
  }
  if (err instanceof SeatsAeroError) {
    return NextResponse.json({ error: err.message }, { status: err.status === 429 ? 429 : 502 });
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

/**
 * Runs one Flights/Hotels action with its own credit budget and the request's
 * abort signal, and reports how many credits it spent.
 */
export async function withCredits<T extends object>(req: Request, fn: (ctx: CallContext) => Promise<T>) {
  try {
    const budget = new Budget(env().MAX_CALLS_PER_SEARCH);
    const result = await fn({ budget, signal: req.signal });
    return NextResponse.json({ ...result, credits: budget.snapshot().spent });
  } catch (err) {
    return errorResponse(err);
  }
}
