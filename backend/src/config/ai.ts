function getKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY set nahi hai. backend/.env check karo aur backend restart karo.");
  }
  return key;
}

export function getAiModel(): string {
  const model = process.env.AI_MODEL;
  if (!model) {
    throw new Error("AI_MODEL set nahi hai. backend/.env mein Gemini model ka naam daalo aur backend restart karo.");
  }
  return model;
}

export type AiMessage = { role: "user" | "assistant"; content: string };

const RETRYABLE_STATUS = [429, 500, 503, 504];
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGemini(model: string, system: string, list: AiMessage[], maxTokens: number): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": getKey(),
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: list.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });

  const data: any = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err: any = new Error(data?.error?.message || `Gemini API error (${response.status})`);
    err.status = response.status;
    throw err;
  }

  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    throw new Error("AI ne koi jawab nahi diya (shayad safety filter ne rok diya). Dobara try karo.");
  }

  return parts.map((p: any) => p?.text || "").join("").trim();
}

export async function askAI(system: string, messages: AiMessage[] | string, maxTokens = 1500): Promise<string> {
  const list: AiMessage[] = typeof messages === "string" ? [{ role: "user", content: messages }] : messages;

  const models = [getAiModel()];
  const fallback = process.env.AI_FALLBACK_MODEL;
  if (fallback && fallback !== models[0]) models.push(fallback);

  let lastError: any;

  for (const model of models) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await callGemini(model, system, list, maxTokens);
      } catch (err: any) {
        lastError = err;
        const retryable = RETRYABLE_STATUS.includes(err?.status);
        if (!retryable) break; // is model par retry ka fayda nahi, agla model try karo
        console.warn(`AI busy (${model}, attempt ${attempt}/${MAX_ATTEMPTS}): ${err?.message}`);
        if (attempt < MAX_ATTEMPTS) await sleep(2000 * attempt);
      }
    }
  }

  throw lastError;
}