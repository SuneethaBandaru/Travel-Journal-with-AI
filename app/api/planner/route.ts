import { createClient } from "@/lib/supabase/server";
import { runTripPlanner } from "@/lib/ai/planner-orchestrator";
import type { PlanRequest } from "@/lib/ai/types";

export const maxDuration = 60; // seconds

/** Runs the Trip Planner agent team and streams progress as NDJSON (one JSON event per line). */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return Response.json({ error: "Please log in first." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Partial<PlanRequest> | null;
  const destination = String(body?.destination ?? "").trim().slice(0, 100);
  if (!destination) return Response.json({ error: "Enter a destination." }, { status: 400 });

  const request: PlanRequest = {
    destination,
    days: Math.min(Math.max(Number(body?.days) || 3, 1), 10),
    interests: String(body?.interests ?? "").trim().slice(0, 300),
    budget: body?.budget === "budget" || body?.budget === "luxury" ? body.budget : "mid-range",
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        for await (const event of runTripPlanner(supabase, request)) send(event);
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Something went wrong" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
