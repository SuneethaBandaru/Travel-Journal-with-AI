import { callAgentJSON } from "../llm";
import type { PlanRequest, Research, SourcePost } from "../types";

/**
 * Agent 1 – Researcher: reads the community's real trip stories and extracts
 * the tips that matter for this traveler's request.
 */
export async function researcherAgent(req: PlanRequest, posts: SourcePost[]): Promise<Research> {
  const library = posts
    .map((p) => `[${p.slug}] (${p.country}) "${p.title}"\n${p.content}`)
    .join("\n\n---\n\n");

  const system = `You are the Researcher Agent for Travel Journal, a community of travelers who share trip stories.
A traveler wants a trip plan. Your job: find the community stories that are relevant and extract concrete, useful tips
(places to visit, food, neighbourhoods, transport, costs, warnings) from them.

Rules:
- Only use information that is actually written in the stories below. Never invent tips.
- Every insight must reference the slug of the story it came from (the text in [brackets]).
- Prefer stories from the requested destination. Stories from other places are only relevant if they directly help.
- coverage = "good" if there are several useful stories, "partial" if only a little, "none" if nothing relevant.

Return JSON:
{
  "coverage": "good" | "partial" | "none",
  "relevantPosts": [{ "slug": "...", "title": "...", "country": "..." }],
  "insights": [{ "tip": "short concrete tip", "sourceSlug": "..." }],
  "summary": "1-2 sentences about what the community knows about this destination"
}

COMMUNITY STORIES:
${library || "(no stories in the database yet)"}`;

  const user = `Destination: ${req.destination}
Trip length: ${req.days} days
Interests: ${req.interests || "anything"}
Budget: ${req.budget}`;

  const research = await callAgentJSON<Research>(system, user, 1800);

  // Guardrail: drop anything that references a post that doesn't exist
  const valid = new Set(posts.map((p) => p.slug));
  research.relevantPosts = (research.relevantPosts ?? []).filter((p) => valid.has(p.slug));
  research.insights = (research.insights ?? []).filter((i) => valid.has(i.sourceSlug));
  return research;
}
