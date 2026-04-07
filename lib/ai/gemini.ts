/**
 * Gemini API integration for Arabic content generation.
 * Claude is not strong in Arabic dialects — Gemini handles Arabic natively.
 * Used for: script writing, voiceover text, ad copy in Arabic dialects.
 */

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiMessage = {
  role: "user" | "model";
  parts: Array<{ text: string }>;
};

/**
 * Generate structured JSON using Gemini 2.5 Pro.
 * Used when the target language is Arabic (any dialect).
 */
export async function generateJSONWithGemini<T>(options: {
  model?: string;
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
}): Promise<T> {
  const {
    model = "gemini-2.5-pro-preview-05-06",
    system,
    messages,
    maxTokens = 16384,
  } = options;

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY not set. Required for Arabic content generation.");
  }

  // Convert messages to Gemini format
  const geminiMessages: GeminiMessage[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents: geminiMessages,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
      responseMimeType: "application/json",
    },
  };

  if (system) {
    body.systemInstruction = { parts: [{ text: system }] };
  }

  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

  console.log("[gemini] generateJSON model:", model, "messages:", messages.length);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[gemini] API error:", response.status, errorText);
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Extract text from Gemini response
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error("[gemini] No text in response:", JSON.stringify(data).slice(0, 500));
    throw new Error("Gemini returned no text content");
  }

  console.log("[gemini] Response length:", text.length);

  // Parse JSON from the response
  try {
    return JSON.parse(text) as T;
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim()) as T;
    }
    console.error("[gemini] Failed to parse JSON:", text.slice(0, 500));
    throw new Error("Gemini response is not valid JSON");
  }
}

/**
 * Detect if a language code is Arabic (any dialect).
 */
export function isArabicLanguage(language: string): boolean {
  const lower = language.toLowerCase();
  return lower === "ar" || lower.startsWith("ar-") || lower === "arabic" || lower.includes("darija");
}

/**
 * Get dialect-specific instructions for Arabic content.
 */
export function getArabicDialectInstructions(language: string): string {
  const lower = language.toLowerCase();

  if (lower === "ar-ma" || lower.includes("darija") || lower.includes("morocc")) {
    return `LANGUAGE: Moroccan Darija (الدارجة المغربية)
Write EXACTLY how a young Moroccan from Casablanca/Rabat speaks in daily life. This is NOT Modern Standard Arabic. This is NOT Gulf Arabic.

Rules:
- Use Darija vocabulary: "بزاف" (a lot), "مزيان" (good), "واخا" (ok/although), "ديالي" (my/mine), "كنت" (I was), "كنقول" (I say)
- Mix in French words naturally as Moroccans do: "normal", "parfait", "du coup", "en fait", "franchement"
- Short, punchy sentences. Moroccans speak in rhythm, not formal paragraphs.
- Conversational tone: like talking to a friend at a café, not reading news.
- NO فصحى (Modern Standard Arabic). NO "أنا أعتقد أن". Say "أنا كنظن" instead.
- Sound like a real person from Derb Sultan or Maarif, not a TV anchor.`;
  }

  if (lower === "ar-eg" || lower.includes("egypt")) {
    return `LANGUAGE: Egyptian Arabic (العامية المصرية)
Write EXACTLY how a young Egyptian from Cairo speaks. NOT Modern Standard Arabic.

Rules:
- Use Egyptian vocab: "كده" (like this), "عايز" (want), "حلو" (nice), "يعني" (I mean), "بجد" (seriously)
- Conversational, warm, with Egyptian humor
- Short sentences with natural rhythm
- NO فصحى. Say "أنا عايز" not "أنا أريد".`;
  }

  if (lower === "ar-sa" || lower === "ar-ae" || lower.includes("gulf") || lower.includes("khaleeji")) {
    return `LANGUAGE: Gulf Arabic (اللهجة الخليجية)
Write as a young professional from Dubai/Riyadh speaks. NOT Modern Standard Arabic.

Rules:
- Use Gulf vocab: "وايد" (a lot), "يالله" (let's go), "حيل" (very), "شلونك" (how are you)
- Professional but warm tone
- Short, confident sentences
- NO فصحى. Natural Gulf conversation.`;
  }

  // Default: Modern Standard Arabic with conversational tone
  return `LANGUAGE: Arabic (العربية)
Write in conversational Arabic that sounds natural, not like a news broadcast.
- Prefer simple, direct language over complex literary constructions
- Short sentences with rhythm
- If the audience is from a specific region, adapt to their dialect naturally.`;
}
