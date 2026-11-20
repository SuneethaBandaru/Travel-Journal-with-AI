import type { SupabaseClient } from "@supabase/supabase-js";
import { researcherAgent } from "./agents/researcher";
import { plannerAgent } from "./agents/planner";
import { factCheckerAgent } from "./agents/factchecker";
import type { FactCheck, Itinerary, PlanRequest, PlannerAgent, PlannerEvent, PlanResult, SourcePost } from "./types";

const MAX_REVISIONS = 2;
const MAX_STORIES = 25;

/** Loads community stories from Supabase, putting stories about the destination first. */
async function loadStories(supabase: SupabaseClient, destination: string): Promise<SourcePost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("title, slug, content, categories(name, slug)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Could not load community stories: ${error.message}`);

  const dest = destination.toLowerCase();
  const stories = (data ?? []).map((p) => {
    const cat = p.categories as unknown as { name: string; slug: string } | null;
    return {
      slug: p.slug as string,
      title: p.title as string,
      country: cat?.name ?? "Unknown",
      content: String(p.content ?? "").slice(0, 1200),
    };
  });

  const matches = (s: SourcePost) =>
    s.country.toLowerCase().includes(dest) ||
    dest.includes(s.country.toLowerCase()) ||
    s.title.toLowerCase().includes(dest) ||
    s.content.toLowerCase().includes(dest);

  return [...stories.filter(matches), ...stories.filter((s) => !matches(s))].slice(0, MAX_STORIES);
}

/**
 * Orchestrates the Trip Planner agent team:
 *
 *   Researcher → Planner ⇄ Fact-checker (loop, max 2 revisions)
 *
 * Yields an event whenever an agent starts/finishes so the UI can show live progress.
 */
export async function* runTripPlanner(supabase: SupabaseClient, req: PlanRequest): AsyncGenerator<PlannerEvent> {
  const started = Date.now();

  async function* step<T>(agent: PlannerAgent, fn: () => Promise<T>, iteration?: number): AsyncGenerator<PlannerEvent, T> {
    yield { type: "agent_start", agent, iteration };
    const t0 = Date.now();
    const output = await fn();
    yield { type: "agent_done", agent, iteration, output, ms: Date.now() - t0 };
    return output;
  }

  const stories = await loadStories(supabase, req.destination);
  const research = yield* step("researcher", () => researcherAgent(req, stories));

  const checks: FactCheck[] = [];
  let itinerary: Itinerary = yield* step("planner", () => plannerAgent(req, research), 1);
  let check: FactCheck = yield* step("factchecker", () => factCheckerAgent(req, itinerary, stories), 1);
  checks.push(check);

  let revisions = 0;
  while (!check.approved && revisions < MAX_REVISIONS) {
    revisions++;
    const prev = { itinerary, check };
    itinerary = yield* step("planner", () => plannerAgent(req, research, prev), revisions + 1);
    check = yield* step("factchecker", () => factCheckerAgent(req, itinerary, stories), revisions + 1);
    checks.push(check);
  }

  // Sources = the stories actually cited in the final plan
  const cited = new Set(itinerary.days.flatMap((d) => d.activities.map((a) => a.sourceSlug).filter(Boolean)));
  const sources = stories
    .filter((s) => cited.has(s.slug))
    .map(({ slug, title, country }) => ({ slug, title, country }));

  const result: PlanResult = { request: req, research, itinerary, checks, revisions, sources, totalMs: Date.now() - started };
  yield { type: "complete", result };
}
