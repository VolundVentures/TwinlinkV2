import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SSEEmitter } from "@/lib/ai/sse-emitter";
import { runAgentLoop } from "@/lib/ai/agent-loop";
import { generateText } from "@/lib/ai/claude";
import { formatCostBreakdown, clearGenerationCosts } from "@/lib/generation/cost-tracker";
import type { AgentContext } from "@/lib/ai/tools/types";
import type { Brand } from "@/lib/database.types";

export async function POST(request: Request) {
  // 1. Auth check
  let auth;
  try {
    auth = await requireAuth();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Parse body
  let body: {
    brandId?: string;
    language?: string;
    prompt: string;
    budget?: string;
    generationId?: string;
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { brandId, prompt } = body;
  let conversationHistory = body.conversationHistory as Array<{ role: "user" | "assistant"; content: string }> | undefined;

  // Language detection: if "auto" or not specified, detect from prompt
  let language = (body.language as string) || auth.preferredLanguage || "auto";
  if (language === "auto") {
    language = detectLanguageFromPrompt(prompt);
  }

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return new Response("Missing or empty prompt", { status: 400 });
  }

  // 3. Load brand(s) — specific brand if ID provided, otherwise ALL user brands
  let brand: Brand | null = null;
  let allBrands: Brand[] = [];
  if (brandId) {
    const { data } = await db
      .from("brands")
      .select("*")
      .eq("id", brandId)
      .eq("org_id", auth.orgId)
      .single();
    brand = data;
  } else {
    // No brand selected — load ALL brands so the agent can pick the right one
    const { data } = await db
      .from("brands")
      .select("*")
      .eq("org_id", auth.orgId)
      .order("is_default", { ascending: false });
    allBrands = data || [];
    // If only one brand, auto-select it
    if (allBrands.length === 1) {
      brand = allBrands[0];
    }
  }

  // 4. Detect generation type from prompt
  const promptLower = prompt.toLowerCase();
  let generationType: string = "campaign";
  if (promptLower.includes("video") || promptLower.includes("ugc") || promptLower.includes("reel")) {
    generationType = "ugc_video";
  } else if (promptLower.includes("static") || promptLower.includes("image") || promptLower.includes("ad")) {
    generationType = "static_ad";
  } else if (promptLower.includes("competitor") || promptLower.includes("research") || promptLower.includes("analysis")) {
    generationType = "competitor_research";
  } else if (promptLower.includes("carousel") || promptLower.includes("slide")) {
    generationType = "campaign";
  }

  // Reuse existing generation for follow-ups, or create a new one
  let generationId: string;
  const isFollowUp = !!body.generationId;

  if (body.generationId) {
    // Follow-up: verify the generation belongs to this user/org
    const { data: existing } = await db
      .from("generations")
      .select("id")
      .eq("id", body.generationId)
      .eq("org_id", auth.orgId)
      .single();

    if (!existing) {
      return new Response("Generation not found", { status: 404 });
    }
    generationId = existing.id;

    // Mark it as processing again
    await db.from("generations").update({ status: "processing" }).eq("id", generationId);

    // Load existing assets so agent can reference them in follow-ups
    const { data: existingAssets } = await db
      .from("generation_assets")
      .select("type, public_url, metadata")
      .eq("generation_id", generationId)
      .order("created_at", { ascending: true });

    if (existingAssets && existingAssets.length > 0) {
      const assetSummary = existingAssets.map((a) => {
        const meta = a.metadata as Record<string, unknown> | null;
        const label = meta?.asset_category || meta?.title || a.type;
        return `- [${label}] ${a.type}: ${a.public_url}`;
      }).join("\n");

      // Inject asset context into conversation history so agent knows what was already generated
      const assetContext = `[SYSTEM: Previously generated assets for this session — use these URLs, do NOT regenerate]\n${assetSummary}`;
      if (!conversationHistory) conversationHistory = [];
      conversationHistory.push(
        { role: "user" as const, content: assetContext },
        { role: "assistant" as const, content: "Understood. I have access to all previously generated assets and will reuse them." }
      );
    }
  } else {
    const { data: generation, error: genError } = await db
      .from("generations")
      .insert({
        org_id: auth.orgId,
        user_id: auth.id,
        brand_id: brandId || null,
        type: generationType,
        status: "processing",
        language,
        prompt,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (genError || !generation) {
      console.error("[agent/run] Failed to create generation:", genError?.message);
      return new Response("Failed to create generation", { status: 500 });
    }
    generationId = generation.id;
  }

  // 5. Find existing session for this generation (follow-ups) or create new one
  let session: { id: string };

  if (isFollowUp) {
    // Reuse the existing session for this generation
    const { data: existingSession } = await db
      .from("agent_sessions")
      .select("id")
      .eq("generation_id", generationId)
      .eq("org_id", auth.orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existingSession) {
      session = existingSession;
      await db.from("agent_sessions").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", session.id);
    } else {
      // Fallback: create new session
      const { data: newSession, error: sessionError } = await db
        .from("agent_sessions")
        .insert({ generation_id: generationId, org_id: auth.orgId, user_id: auth.id, total_steps: 0, status: "active" })
        .select("id")
        .single();
      if (sessionError || !newSession) {
        return new Response("Failed to create agent session", { status: 500 });
      }
      session = newSession;
    }
  } else {
    const { data: newSession, error: sessionError } = await db
      .from("agent_sessions")
      .insert({ generation_id: generationId, org_id: auth.orgId, user_id: auth.id, total_steps: 0, status: "active" })
      .select("id")
      .single();

    if (sessionError || !newSession) {
      console.error("[agent/run] Failed to create session:", sessionError?.message);
      await db.from("generations").delete().eq("id", generationId);
      return new Response("Failed to create agent session", { status: 500 });
    }
    session = newSession;
  }

  // 6. Create SSEEmitter
  const emitter = new SSEEmitter(15_000);

  // 7. Build AgentContext
  const budget = body.budget ? parseInt(body.budget) : undefined;
  const context: AgentContext = {
    generationId,
    orgId: auth.orgId,
    userId: auth.id,
    brand,
    allBrands: !brand && allBrands.length > 1 ? allBrands : undefined,
    language,
    budget,
    creditsUsed: 0,
  };

  // Emit initial metadata
  emitter.send("session_start", {
    generationId,
    sessionId: session.id,
    brandName: brand?.name || null,
    language,
  });

  // 8. Run agent loop in background
  (async () => {
    try {
      await runAgentLoop(context, prompt, emitter, session.id, conversationHistory);

      // Generate a smart title ONLY for the first message — never overwrite on follow-ups
      if (!isFollowUp) {
        let title = prompt.slice(0, 60);
        try {
          const titleText = await generateText({
            model: "claude-sonnet-4-6",
            maxTokens: 50,
            temperature: 0.3,
            system: "Generate a concise creative title (3-8 words) for this ad/content request. The title should describe WHAT is being created (e.g. '826 Models Product Hero', 'Peugeot 408 UGC Testimonial', 'Nike Brand Research'). Return ONLY the title text, nothing else. No quotes, no markdown, no explanation.",
            messages: [{ role: "user", content: prompt }],
          });
          title = titleText.trim().replace(/[*#"]/g, "").slice(0, 80);
        } catch {
          // Fallback to truncated prompt
        }

        await db
          .from("generations")
          .update({
            status: "completed",
            title,
            completed_at: new Date().toISOString(),
          })
          .eq("id", generationId);
      } else {
        // Follow-up: just mark completed, keep existing title
        await db
          .from("generations")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", generationId);
      }

      // Mark session completed
      await db
        .from("agent_sessions")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      // Log cost breakdown
      const costBreakdown = formatCostBreakdown(generationId);
      console.log(`[agent/run] Cost breakdown for ${generationId}:\n${costBreakdown}`);
      clearGenerationCosts(generationId);

      // Emit completion
      emitter.send("complete", { generationId });
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "Agent execution failed";
      console.error("[agent/run] Fatal error:", errMsg);

      // Mark generation failed
      try {
        await db
          .from("generations")
          .update({
            status: "failed",
            error_message: errMsg,
            completed_at: new Date().toISOString(),
          })
          .eq("id", generationId);

        await db
          .from("agent_sessions")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", session.id);
      } catch (dbErr) {
        console.error("[agent/run] Failed to update status:", dbErr);
      }

      emitter.send("error", { message: errMsg });
    } finally {
      emitter.close();
    }
  })();

  // 9. Return SSE response
  return new Response(emitter.stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * Detect language from user prompt using simple heuristics.
 * Checks for Arabic script, French patterns, and explicit language mentions.
 */
function detectLanguageFromPrompt(prompt: string): string {
  const lower = prompt.toLowerCase();

  // Explicit language requests
  if (lower.includes("darija") || lower.includes("دارجة") || lower.includes("moroccan arabic")) return "ar-MA";
  if (lower.includes("egyptian") || lower.includes("مصري")) return "ar-EG";
  if (lower.includes("gulf arabic") || lower.includes("khaleeji") || lower.includes("خليجي")) return "ar-SA";
  if (lower.includes("in arabic") || lower.includes("بالعربية") || lower.includes("arabic")) return "ar";
  if (lower.includes("en français") || lower.includes("in french") || lower.includes("en francais")) return "fr";
  if (lower.includes("in spanish") || lower.includes("en español")) return "es";

  // Detect Arabic script (Unicode range \u0600-\u06FF)
  const arabicChars = (prompt.match(/[\u0600-\u06FF]/g) || []).length;
  const totalChars = prompt.replace(/\s/g, "").length;
  if (totalChars > 0 && arabicChars / totalChars > 0.3) {
    // Predominantly Arabic script — default to Moroccan Darija for MENA focus
    return "ar-MA";
  }

  // Detect French
  const frenchWords = ["créer", "publicité", "vidéo", "marque", "produit", "pour", "avec", "une", "des"];
  const frenchCount = frenchWords.filter(w => lower.includes(w)).length;
  if (frenchCount >= 3) return "fr";

  return "en";
}
