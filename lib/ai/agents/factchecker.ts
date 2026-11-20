import { callAgentJSON } from "../llm";
import type { FactCheck, Itinerary, PlanRequest, SourcePost } from "../types";

/**
 * Agent 3 – Fact-checker: verifies that every activity credited to a community story
 * is really supported by that story, and that the plan matches the request.
 */
export async function factCheckerAgent(
  req: PlanRequest,
  itinerary: Itinerary,
  posts: SourcePost[]
): Promise<FactCheck> {
  // Deterministic checks first (cheap and 100% reliable)
  const issues: string[] = [];
  const bySlug = new Map(posts.map((p) => [p.slug, p]));
  const days = itinerary.days ?? [];
  if (days.length !== req.days) issues.push(`Plan has ${days.length} days but ${req.days} were requested.`);
  const cited = new Set<string>();
  for (const d of days) {
    for (const a of d.activities ?? []) {
      if (a.sourceSlug && !bySlug.has(a.sourceSlug)) issues.push(`Day ${d.day}: "${a.activity}" cites a story that does not exist (${a.sourceSlug}).`);
      else if (a.sourceSlug) cited.add(a.sourceSlug);
    }
  }

  const sources = [...cited]
    .map((slug) => bySlug.get(slug)!)
    .map((p) => `[${p.slug}] "${p.title}"\n${p.content}`)
    .join("\n\n---\n\n");

  const system = `You are the Fact-checker Agent for Travel Journal. You are strict.
Check a trip plan before it is shown to a traveler.

Check:
1. SOURCES – every activity with a sourceSlug must be clearly supported by that story's text below. Credit to a story that doesn't mention it = issue.
2. REQUEST – the plan fits the destination (${req.destination}), ${req.days} days, budget "${req.budget}" and interests "${req.interests || "any"}".
3. REALISM – the daily schedule is physically doable; no obviously wrong facts.

Return JSON:
{
  "approved": true or false (approve only if score >= 8 and there are no source problems),
  "score": integer 1-10,
  "issues": ["specific problem", ...],
  "feedback": "concrete instructions to fix the plan"
}

STORIES CITED IN THE PLAN:
${sources || "(no stories cited)"}`;

  const check = await callAgentJSON<FactCheck>(system, `Plan to check:\n${JSON.stringify(itinerary, null, 2)}`, 900);

  if (issues.length > 0) {
    check.approved = false;
    check.issues = [...issues, ...(check.issues ?? [])];
    check.score = Math.min(check.score ?? 5, 6);
  }
  check.issues ??= [];
  return check;
}
