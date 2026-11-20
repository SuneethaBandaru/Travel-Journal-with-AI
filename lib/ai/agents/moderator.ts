import { callAgentJSON } from "../llm";
import type { ModerationCategory } from "../types";

export interface ModeratorVerdict {
  verdict: "approve" | "hide" | "unsure";
  category: ModerationCategory;
  confidence: number; // 0-1
  reason: string;
}

const POLICY = `TRAVEL JOURNAL COMMUNITY RULES
Allowed: opinions, questions, disagreement, criticism of a trip or place, mild humour, emojis, any language.
Not allowed:
- spam: ads, promo codes, repeated links, "follow me", SEO junk
- scam: fake travel deals, crypto/investment offers, phishing, "DM me for cheap tickets"
- harassment: insults or threats aimed at a person, bullying
- hate: attacks on people for nationality, ethnicity, religion, gender, sexuality, disability
- personal_data: sharing someone's phone number, home address, passport/ID or email
- off_topic: completely unrelated to the post AND disruptive (being slightly off topic is fine)`;

/** Agent 4 – Moderator: first check of every new comment against the community rules. */
export async function moderatorAgent(comment: string, postTitle: string): Promise<ModeratorVerdict> {
  const system = `You are the Moderator Agent for Travel Journal, a travel community.
Check a new comment against the rules. Be fair: do NOT hide normal opinions or criticism.

${POLICY}

Return JSON:
{
  "verdict": "approve" | "hide" | "unsure",
  "category": "ok" | "spam" | "harassment" | "hate" | "scam" | "personal_data" | "off_topic",
  "confidence": number between 0 and 1,
  "reason": "one short sentence explaining the decision (shown to the comment author if hidden)"
}`;

  return callAgentJSON<ModeratorVerdict>(system, `Post title: "${postTitle}"\nComment: """${comment}"""`, 400);
}

/**
 * Agent 5 – Reviewer: a second, more careful opinion for borderline cases
 * (the Moderator was unsure, or wants to hide a comment without high confidence).
 */
export async function reviewerAgent(
  comment: string,
  postTitle: string,
  first: ModeratorVerdict
): Promise<{ verdict: "approve" | "hide"; category: ModerationCategory; reason: string }> {
  const system = `You are the senior Reviewer Agent for Travel Journal's moderation team.
The first Moderator flagged a comment as borderline. Make the FINAL decision.
Hiding a legitimate comment hurts free discussion; letting real abuse through hurts the community. Weigh both.
When in doubt about plain criticism or rudeness that is not aimed at a person, approve.

${POLICY}

Return JSON:
{
  "verdict": "approve" | "hide",
  "category": "ok" | "spam" | "harassment" | "hate" | "scam" | "personal_data" | "off_topic",
  "reason": "one short sentence explaining the final decision"
}`;

  const user = `Post title: "${postTitle}"
Comment: """${comment}"""

First Moderator said: ${first.verdict} (${first.category}, confidence ${first.confidence}) – "${first.reason}"`;

  return callAgentJSON(system, user, 400);
}
