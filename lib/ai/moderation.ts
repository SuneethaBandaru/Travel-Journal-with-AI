import { aiEnabled } from "./llm";
import { moderatorAgent, reviewerAgent } from "./agents/moderator";
import type { ModerationDecision } from "./types";

const CONFIDENCE_THRESHOLD = 0.85;

/**
 * Orchestrates the moderation team. Runs automatically on EVERY new comment:
 *
 *   Moderator ──(clear case)──────────────→ decision
 *       └──(unsure / low confidence)→ Reviewer → final decision
 *
 * If the AI is unavailable, comments are approved so the site keeps working
 * (they are logged as "fallback" so a human can check them later).
 */
export async function moderateComment(comment: string, postTitle: string): Promise<ModerationDecision> {
  if (!aiEnabled()) {
    return { status: "approved", category: "ok", reason: "AI moderation is not configured.", decidedBy: "fallback" };
  }

  try {
    const first = await moderatorAgent(comment, postTitle);

    const clearApprove = first.verdict === "approve" && first.category === "ok";
    const clearHide = first.verdict === "hide" && first.confidence >= CONFIDENCE_THRESHOLD;

    if (clearApprove) return { status: "approved", category: "ok", reason: first.reason, decidedBy: "moderator" };
    if (clearHide) return { status: "hidden", category: first.category, reason: first.reason, decidedBy: "moderator" };

    // Borderline → escalate to the Reviewer agent
    const final = await reviewerAgent(comment, postTitle, first);
    return {
      status: final.verdict === "hide" ? "hidden" : "approved",
      category: final.verdict === "hide" ? final.category : "ok",
      reason: final.reason,
      decidedBy: "reviewer",
    };
  } catch (err) {
    console.error("Moderation failed, approving comment:", err);
    return { status: "approved", category: "ok", reason: "Moderation temporarily unavailable.", decidedBy: "fallback" };
  }
}
