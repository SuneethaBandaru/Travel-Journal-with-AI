import { callAgentJSON } from "../llm";
import type { FactCheck, Itinerary, PlanRequest, Research } from "../types";

/**
 * Agent 2 – Planner: turns the Researcher's community insights into a day-by-day itinerary.
 * When the Fact-checker rejects a plan, the Planner revises it using that feedback (the loop).
 */
export async function plannerAgent(
  req: PlanRequest,
  research: Research,
  previous?: { itinerary: Itinerary; check: FactCheck }
): Promise<Itinerary> {
  const insights = research.insights.map((i) => `- ${i.tip} [source: ${i.sourceSlug}]`).join("\n");

  const system = `You are the Planner Agent for Travel Journal.
Create a realistic day-by-day travel itinerary.

Rules:
- Exactly ${req.days} days, numbered 1..${req.days}. 2-4 activities per day with a time of day ("Morning", "Afternoon", "Evening" or a clock time).
- Build the plan around the COMMUNITY INSIGHTS first. When an activity comes from an insight, set "sourceSlug" to that insight's source.
- You may add general, well-known suggestions to fill gaps, but then "sourceSlug" MUST be null. Never attach a source to something the source doesn't say.
- Respect the budget (${req.budget}) and interests (${req.interests || "general sightseeing"}).
- Keep travel between places realistic for one day.

Return JSON:
{
  "title": "catchy trip title",
  "summary": "2 sentences describing the trip",
  "days": [{ "day": 1, "title": "theme of the day", "activities": [{ "time": "Morning", "activity": "...", "sourceSlug": "slug-or-null" }] }],
  "tips": ["practical tip", "..."]
}

COMMUNITY INSIGHTS (coverage: ${research.coverage}):
${insights || "(none – the community has not written about this destination yet; use general suggestions with sourceSlug null)"}`;

  let user = `Plan a ${req.days}-day trip to ${req.destination}.`;
  if (previous) {
    user += `

YOUR PREVIOUS PLAN WAS REJECTED BY THE FACT-CHECKER.
Previous plan: ${JSON.stringify(previous.itinerary)}
Issues: ${previous.check.issues.join("; ")}
Feedback: ${previous.check.feedback}

Return a corrected plan that fixes every issue.`;
  }

  return callAgentJSON<Itinerary>(system, user, 2500);
}
