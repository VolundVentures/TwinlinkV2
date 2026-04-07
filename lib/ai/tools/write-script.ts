import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber } from "./types";
import { videoScriptPrompt } from "@/lib/ai/prompts/script-writer";
import { generateJSON } from "@/lib/ai/claude";
import { generateJSONWithGemini, isArabicLanguage, getArabicDialectInstructions } from "@/lib/ai/gemini";
import { db } from "@/lib/db";
import type { Brand } from "@/lib/database.types";

type ScriptSection = {
  label: string;
  start_time: number;
  end_time: number;
  text: string;
  scene_type: string;
  visual_description: string;
  image_prompt: string | null;
  camera_motion: string | null;
  suggested_model: string;
};

type VideoScript = {
  title: string;
  duration_seconds: number;
  hook_type: string;
  tone: string;
  sections: ScriptSection[];
  full_script: string;
  voiceover_direction: string;
  visual_style: string;
};

export const writeScriptDefinition: ToolDefinition = {
  name: "write_script",
  description:
    "Write a cinematic video ad script with timed shots, camera motion, and voiceover. Costs 1 credit.\n\n**Pass your creative direction** including: concept, emotion, paradigm (cinematic_product/ugc_testimonial/deconstructed/aggressive_sports/atmospheric_story), visual style, and duration.\n\n**The script writer produces:**\n- Timestamped sections with visual descriptions and Seedance camera motion prompts\n- Voiceover text with emotional rhythm and counterpoint\n- Image generation prompts for each keyframe\n- Suggested video model per section\n\n**For UGC:** Script should have 3 talking sections + 2-3 B-roll sections. Talking sections include dialogue text. B-roll sections have empty text (music only).\n\n**For Product Hero:** Script should have 2-4 sections with continuous voiceover, Seedance timestamped camera motion.\n\n**Voiceover minimum:** At least 50% of video duration covered by speech (~1.3 words per second minimum).",
  input_schema: {
    type: "object",
    properties: {
      duration_seconds: {
        type: "number",
        description: "Target video duration in seconds (default 30).",
      },
      creative_direction: {
        type: "string",
        description:
          "Your creative vision for this ad — the format, visual style, emotional arc, what makes this ad unique. This is the MOST IMPORTANT input. Be specific about the mood, the story, the feeling you want. The more vivid your direction, the better the script.",
      },
      style: {
        type: "string",
        description:
          "Visual/tonal style: 'cinematic luxury', 'raw UGC', 'dark premium', 'warm lifestyle', 'energetic pop'.",
      },
      key_points: {
        type: "array",
        items: { type: "string" },
        description:
          "Specific messages, features, or moments that must appear in the script.",
      },
    },
  },
};

export const writeScript: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const durationSeconds = (input.duration_seconds as number) || 30;
  const creativeDirection = (input.creative_direction as string) || "";
  const style = (input.style as string) || "";
  const keyPoints = (input.key_points as string[]) || [];

  console.log(
    "[tool:write_script] Duration:",
    durationSeconds,
    "style:",
    style,
    "direction:",
    creativeDirection?.slice(0, 60)
  );

  // Build a brand object for the prompt (use context brand or a fallback)
  const brand: Brand = context.brand || {
    id: "",
    org_id: context.orgId,
    name: "Brand",
    logo_url: null,
    website_url: null,
    description: null,
    primary_color: null,
    secondary_color: null,
    accent_color: null,
    font_family: null,
    industry: null,
    target_audience: null,
    brand_voice: null,
    products: [],
    scraped_data: {},
    is_default: false,
    created_at: "",
    updated_at: "",
  };

  emitter.send("tool_progress", {
    tool: "write_script",
    generationId: context.generationId,
    status: "generating",
    message: `Writing ${durationSeconds}s video script...`,
  });

  // Build user prompt with creative direction
  const parts: string[] = [];
  if (creativeDirection) parts.push(creativeDirection);
  if (style) parts.push(`Visual style: ${style}`);
  if (keyPoints.length > 0) parts.push(`Must include: ${keyPoints.join("; ")}`);
  const userPrompt = parts.length > 0 ? parts.join("\n\n") : "Create a compelling video ad";

  const prompt = videoScriptPrompt(
    brand,
    userPrompt,
    context.language,
    durationSeconds
  );

  // Retry up to 2 times — JSON generation can fail on first attempt
  const MAX_RETRIES = 2;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[tool:write_script] Retry attempt ${attempt}/${MAX_RETRIES}...`);
        emitter.send("tool_progress", {
          tool: "write_script",
          generationId: context.generationId,
          status: "generating",
          message: `Script writing retry ${attempt}/${MAX_RETRIES}...`,
        });
      }

      const useArabic = isArabicLanguage(context.language);
      const baseSystem = "You are a world-class creative director who has made award-winning ads for Nike, Apple, and Mercedes. You think in images and emotions. Every shot is a painting. Every word is chosen for rhythm and feeling. You never write generic marketing copy — you write moments that make people stop scrolling and feel something.";

      let script: VideoScript;

      if (useArabic) {
        // Use Gemini for Arabic — Claude is weak in Arabic dialects
        const dialectInstructions = getArabicDialectInstructions(context.language);
        const arabicSystem = `${baseSystem}\n\n${dialectInstructions}\n\nALL voiceover text (the "text" and "full_script" fields) MUST be written in the specified Arabic dialect by a native speaker. The visual descriptions, image prompts, and camera directions stay in English. You are a native speaker of this dialect — write exactly how real people talk, not textbook Arabic.`;

        console.log("[tool:write_script] Using Gemini for Arabic dialect:", context.language);
        script = await generateJSONWithGemini<VideoScript>({
          system: arabicSystem,
          messages: [{ role: "user", content: prompt }],
        });
      } else {
        script = await generateJSON<VideoScript>({
          model: "claude-opus-4-6",
          system: baseSystem,
          messages: [{ role: "user", content: prompt }],
        });
      }

    console.log(
      "[tool:write_script] Script generated:",
      script.title,
      "sections:",
      script.sections.length
    );

    // Validate voiceover word count — reject scripts that are too short
    const fullScriptWords = (script.full_script || "").split(/\s+/).filter((w: string) => w.length > 0).length;
    const minWords = Math.max(25, Math.floor(durationSeconds * 1.5)); // 1.5 words/sec = 60% coverage
    if (fullScriptWords < minWords) {
      console.warn(`[tool:write_script] REJECTED: full_script only ${fullScriptWords} words (need ${minWords}+) for ${durationSeconds}s video`);
      return {
        success: false,
        content: `Script voiceover is only ${fullScriptWords} words for a ${durationSeconds}s video. Need at least ${minWords} words (50% coverage at 2.5 words/sec). Rewrite with more voiceover text — the voiceover must cover at least half the video duration.`,
      };
    }

    emitter.send("tool_progress", {
      tool: "write_script",
      generationId: context.generationId,
      status: "saving",
      message: "Saving script...",
    });

    // Save to generation_assets
    const variantNum = await getNextVariantNumber(context.generationId);
    const { data: asset, error: saveError } = await db
      .from("generation_assets")
      .insert({
        generation_id: context.generationId,
        org_id: context.orgId,
        type: "script",
        storage_path: `script://${context.generationId}`,
        public_url: `script://${context.generationId}`,
        metadata: {
          title: script.title,
          duration_seconds: script.duration_seconds,
          hook_type: script.hook_type,
          tone: script.tone,
          sections: script.sections,
          full_script: script.full_script,
          voiceover_direction: script.voiceover_direction,
          visual_style: script.visual_style,
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    if (saveError) {
      console.warn(
        "[tool:write_script] Failed to save asset:",
        saveError.message
      );
    }

    emitter.send("tool_progress", {
      tool: "write_script",
      generationId: context.generationId,
      status: "complete",
      message: "Script written successfully",
    });

    // Build summary for Claude — include shot list for pipeline execution
    const sectionSummaries = script.sections.map(
      (s) =>
        `  [${s.label}] (${s.start_time}-${s.end_time}s) ${s.scene_type} → ${s.suggested_model}\n` +
        `    Says: "${s.text}"\n` +
        `    Sees: ${s.visual_description}\n` +
        (s.image_prompt ? `    Image prompt: ${s.image_prompt}\n` : "") +
        (s.camera_motion ? `    Camera: ${s.camera_motion}` : "")
    );

    const summary = [
      `Script: "${script.title}" (${script.duration_seconds}s, ${script.hook_type} hook, tone: ${script.tone})`,
      "",
      "Shot List:",
      ...sectionSummaries,
      "",
      `Full Voiceover: "${script.full_script}"`,
      `Voiceover Direction: ${script.voiceover_direction}`,
      `Visual Style: ${script.visual_style}`,
      "",
      "NEXT STEPS — Execute the pipeline for each shot using the suggested_model.",
    ].join("\n");

    return {
      success: true,
      content: summary,
      data: script,
      assets: [
        {
          assetId: asset?.id,
          type: "script",
          metadata: {
            title: script.title,
            duration_seconds: script.duration_seconds,
            hook_type: script.hook_type,
            full_script: script.full_script,
          },
        },
      ],
    };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`[tool:write_script] Attempt ${attempt}/${MAX_RETRIES} failed:`, lastError);
    }
  }

  // All retries exhausted
  return {
    success: false,
    content: `Script writing failed after ${MAX_RETRIES} attempts: ${lastError}`,
  };
};
