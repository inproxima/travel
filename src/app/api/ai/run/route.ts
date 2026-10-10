import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api";
import { normalizeSpec } from "@/lib/ai/parse";
import { planResearch } from "@/lib/ai/plan";
import { runPlanner } from "@/lib/ai/pipeline";
import { tripSpecSchema } from "@/lib/ai/schemas";
import type { PlannerEvent } from "@/lib/ai/types";
import { env } from "@/lib/env";
import { listPlaces } from "@/lib/settings";

const input = z.object({ request: z.string().trim().min(1).max(1500), spec: tripSpecSchema });

export const maxDuration = 900;

/** Step 2: run the research and stream progress as newline-delimited JSON. */
export async function POST(req: Request) {
  let parsed: z.infer<typeof input>;
  let plan: ReturnType<typeof planResearch>;
  const saved = listPlaces();
  try {
    parsed = input.parse(await readJson(req));
    // The plan is rebuilt here, so the browser can't ask for more research than the cap allows.
    parsed.spec = normalizeSpec(parsed.spec, new Date().toISOString().slice(0, 10), saved);
    plan = planResearch(parsed.spec, saved, env().AI_MAX_SERPAPI_CALLS);
  } catch (err) {
    return errorResponse(err);
  }

  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: PlannerEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          // The browser went away; the abort signal stops the work.
        }
      };
      try {
        const result = await runPlanner({ request: parsed.request, spec: parsed.spec, plan, saved }, send, abort.signal);
        send({ type: "result", result });
      } catch (err) {
        if (!abort.signal.aborted) send({ type: "error", message: err instanceof Error ? err.message : "The planner failed." });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache, no-transform" } });
}
