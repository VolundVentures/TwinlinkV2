import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SSEEmitter } from "@/lib/ai/sse-emitter";
import { runAgentLoop } from "@/lib/ai/agent-loop";
import { generateText } from "@/lib/ai/claude";
import { formatCostBreakdown, clearGenerationCosts } from "@/lib/generation/cost-tracker";
import { getPersonaById } from "@/lib/directors";
import type { AgentContext } from "@/lib/ai/tools/types";
import type { Brand } from "@/lib/database.types";
import type { DirectorPersona } from "@/lib/directors/types";

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
    durationSeconds?: number;
    aspectRatio?: string;
    leadDirectorId?: string;
    coDirectorId?: string;
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { brandId, prompt } = body;
  const conversationHistory = body.conversationHistory as
    | Array<{ role: "user" | "assistant"; content: string }>
    | undefined;

  // Language detection: if "auto" or not specified, detect from prompt
  let language = (body.language as string) || auth.preferredLanguage || "auto";
  if (language === "auto") {
    language = detectLanguageFromPrompt(prompt);
  }

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return new Response("Missing or empty prompt", { status: 400 });
  }

  // 3. Load brand(s)
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
    const { data } = await db
      .from("brands")
      .select("*")
      .eq("org_id", auth.orgId)
      .order("is_default", { ascending: false });
    allBrands = data || [];
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

  // Reuse existing generation for follow-ups, or create a new one.
  // Director IDs are persisted in generations.metadata at create time and
  // re-read on follow-ups so resumed sessions stay director-aware.
  let generationId: string;
  let leadDirectorId: string | undefined;
  let coDirectorId: string | undefined;
  const isFollowUp = !!body.generationId;

  if (body.generationId) {
    const { data: existing } = await db
      .from("generations")
      .select("id, agent_config")
      .eq("id", body.generationId)
      .eq("org_id", auth.orgId)
      .single();

    if (!existing) {
      return new Response("Generation not found", { status: 404 });
    }
    generationId = existing.id;

    // AUTEUR project state (cast, lesson_plan, whiteboard_images) lives in
    // generations.agent_config — the only jsonb column on generations. The
    // metadata column doesn't exist on this table.
    const cfg = (existing.agent_config as Record<string, unknown> | null) || {};
    leadDirectorId = (cfg.lead_director_id as string | undefined) || body.leadDirectorId;
    coDirectorId = (cfg.co_director_id as string | undefined) || body.coDirectorId;

    await db.from("generations").update({ status: "processing" }).eq("id", generationId);
  } else {
    leadDirectorId = body.leadDirectorId;
    coDirectorId = body.coDirectorId;

    const initialAgentConfig: Record<string, unknown> = {
      lead_director_id: leadDirectorId || null,
      co_director_id: coDirectorId || null,
      lesson_plan: [],
      whiteboard_images: [],
      aspect_ratio: body.aspectRatio || null,
      duration_seconds: body.durationSeconds || null,
    };

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
        agent_config: initialAgentConfig,
      })
      .select("id")
      .single();

    if (genError || !generation) {
      console.error("[agent/run] Failed to create generation:", genError?.message);
      return new Response("Failed to create generation", { status: 500 });
    }
    generationId = generation.id;
  }

  // Load director personas (server-side; they're not exposed to client raw).
  const leadDirector: DirectorPersona | null = leadDirectorId
    ? getPersonaById(leadDirectorId) || null
    : null;
  const coDirector: DirectorPersona | null = coDirectorId
    ? getPersonaById(coDirectorId) || null
    : null;

  if (leadDirectorId && !leadDirector) {
    console.warn(`[agent/run] Unknown lead director "${leadDirectorId}" — running without persona`);
  }
  if (coDirectorId && !coDirector) {
    console.warn(`[agent/run] Unknown co director "${coDirectorId}" — running without persona`);
  }

  // 5. Find existing session for this generation (follow-ups) or create new one
  let session: { id: string };

  if (isFollowUp) {
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
  const ALLOWED_ASPECTS = new Set(["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]);
  const aspectRatio =
    body.aspectRatio && ALLOWED_ASPECTS.has(body.aspectRatio) ? body.aspectRatio : undefined;
  const durationSeconds =
    typeof body.durationSeconds === "number" &&
    body.durationSeconds >= 5 &&
    body.durationSeconds <= 180
      ? Math.round(body.durationSeconds)
      : undefined;

  const context: AgentContext = {
    generationId,
    orgId: auth.orgId,
    userId: auth.id,
    brand,
    allBrands: !brand && allBrands.length > 1 ? allBrands : undefined,
    language,
    durationSeconds,
    aspectRatio,
    budget,
    creditsUsed: 0,
    leadDirector,
    coDirector,
  };

  emitter.send("session_start", {
    generationId,
    sessionId: session.id,
    brandName: brand?.name || null,
    language,
    durationSeconds,
    aspectRatio,
    leadDirectorId: leadDirector?.id || null,
    coDirectorId: coDirector?.id || null,
  });

  const loopAbort = new AbortController();
  request.signal.addEventListener(
    "abort",
    () => {
      console.log(`[agent/run] client disconnected — aborting agent loop for ${generationId}`);
      loopAbort.abort(new Error("client-aborted"));
    },
    { once: true }
  );
  context.signal = loopAbort.signal;

  // 8. Run agent loop in background
  (async () => {
    try {
      await runAgentLoop(context, prompt, emitter, session.id, conversationHistory);

      if (!isFollowUp) {
        let title = prompt.slice(0, 60);
        try {
          const titleText = await generateText({
            model: "claude-sonnet-4-6",
            maxTokens: 50,
            temperature: 0.3,
            system:
              "Generate a concise, evocative film title (2-6 words). The title should suggest the film's tone or central image, not summarize the brief. Return ONLY the title text, nothing else. No quotes, no markdown.",
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
        await db
          .from("generations")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", generationId);
      }

      await db
        .from("agent_sessions")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      const costBreakdown = formatCostBreakdown(generationId);
      console.log(`[agent/run] Cost breakdown for ${generationId}:\n${costBreakdown}`);
      clearGenerationCosts(generationId);

      emitter.send("complete", { generationId });
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "Agent execution failed";
      console.error("[agent/run] Fatal error:", errMsg);

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

  return new Response(emitter.stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function detectLanguageFromPrompt(prompt: string): string {
  const lower = prompt.toLowerCase();

  if (lower.includes("en français") || lower.includes("in french") || lower.includes("en francais")) return "fr";
  if (lower.includes("in spanish") || lower.includes("en español")) return "es";
  if (lower.includes("in german") || lower.includes("auf deutsch")) return "de";
  if (lower.includes("in japanese") || lower.includes("日本語")) return "ja";

  return "en";
}
