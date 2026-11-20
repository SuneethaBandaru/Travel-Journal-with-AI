// ---------- Trip Planner ----------

export interface PlanRequest {
  destination: string;
  days: number;
  interests: string;
  budget: "budget" | "mid-range" | "luxury";
}

/** A community post the Researcher can use as a source. */
export interface SourcePost {
  slug: string;
  title: string;
  country: string;
  content: string;
}

export interface Insight {
  tip: string;
  sourceSlug: string;
}

export interface Research {
  coverage: "good" | "partial" | "none";
  relevantPosts: { slug: string; title: string; country: string }[];
  insights: Insight[];
  summary: string;
}

export interface Activity {
  time: string;
  activity: string;
  /** slug of the community post this idea comes from, or null for general suggestions */
  sourceSlug: string | null;
}

export interface Itinerary {
  title: string;
  summary: string;
  days: { day: number; title: string; activities: Activity[] }[];
  tips: string[];
}

export interface FactCheck {
  approved: boolean;
  score: number;
  issues: string[];
  feedback: string;
}

export type PlannerAgent = "researcher" | "planner" | "factchecker";

export type PlannerEvent =
  | { type: "agent_start"; agent: PlannerAgent; iteration?: number }
  | { type: "agent_done"; agent: PlannerAgent; iteration?: number; output: unknown; ms: number }
  | { type: "complete"; result: PlanResult }
  | { type: "error"; message: string };

export interface PlanResult {
  request: PlanRequest;
  research: Research;
  itinerary: Itinerary;
  checks: FactCheck[];
  revisions: number;
  sources: { slug: string; title: string; country: string }[];
  totalMs: number;
}

// ---------- Comment moderation ----------

export type ModerationCategory =
  | "ok"
  | "spam"
  | "harassment"
  | "hate"
  | "scam"
  | "personal_data"
  | "off_topic";

export interface ModerationDecision {
  status: "approved" | "hidden";
  category: ModerationCategory;
  reason: string;
  /** which agent made the final decision */
  decidedBy: "moderator" | "reviewer" | "fallback";
}
