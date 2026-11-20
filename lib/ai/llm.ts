/**
 * Shared LLM helper used by every AI agent in Travel Journal.
 *
 * Uses Groq's FREE API (OpenAI-compatible). Create a key at https://console.groq.com/keys
 * and set GROQ_API_KEY in .env.local (and in Vercel's environment variables).
 * Override the model with LLM_MODEL.
 */

const DEFAULT_MODEL = "openai/gpt-oss-120b";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function aiEnabled() {
  return Boolean(process.env.GROQ_API_KEY);
}

async function callGroq(system: string, user: string, maxTokens: number): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set. Add it to .env.local (and to Vercel's environment variables).");
  }
  const model = process.env.LLM_MODEL || DEFAULT_MODEL;

  // Retry on rate limits (429) – the free tier has per-minute limits
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        // gpt-oss models "think" before answering, so leave room for reasoning tokens
        max_tokens: maxTokens + 2000,
        ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : { temperature: 0.3 }),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (res.status === 429 && attempt < 3) {
      const retryAfter = Number(res.headers.get("retry-after")) || 2 ** attempt * 2;
      await sleep(Math.min(retryAfter, 15) * 1000);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Groq API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content ?? "";
  }
  throw new Error("AI rate limit reached. Wait a minute and try again.");
}

/**
 * Calls the LLM with a system prompt (the agent's role) and a user message,
 * and parses the JSON object the agent is instructed to return.
 */
export async function callAgentJSON<T>(system: string, user: string, maxTokens = 1500): Promise<T> {
  const fullSystem = `${system}\n\nRespond ONLY with a single valid JSON object. No markdown, no code fences, no text outside the JSON.`;
  const text = (await callGroq(fullSystem, user, maxTokens)).trim();
  try {
    return JSON.parse(text) as T;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(text.slice(start, end + 1)) as T;
    throw new Error("Agent did not return valid JSON: " + text.slice(0, 200));
  }
}
