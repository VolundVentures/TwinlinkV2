import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { db } from "@/lib/db";

export const createStoryboardDefinition: ToolDefinition = {
  name: "create_storyboard",
  description:
    "Create a visual storyboard for a video ad BEFORE rendering. Returns a structured storyboard with scenes that the user can review, reorder, and edit before final render. Each scene includes: description, suggested image prompt, duration, audio notes, and text overlay. The user will see a visual editor to approve or modify the storyboard before compose_video is called. Use this instead of directly calling compose_video when creating video ads. Costs 0 credits (planning only).",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Title of the video ad",
      },
      scenes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            scene_number: { type: "number", description: "Scene order (1-based)" },
            scene_type: {
              type: "string",
              enum: ["hook", "talking_head", "product_broll", "lifestyle", "testimonial", "cta", "transition"],
              description: "Type of scene",
            },
            description: { type: "string", description: "What happens in this scene" },
            image_prompt: { type: "string", description: "Detailed prompt to generate the scene's key image" },
            duration_seconds: { type: "number", description: "Scene duration in seconds" },
            audio_notes: { type: "string", description: "What audio plays during this scene (voiceover text, music cue, silence)" },
            text_overlay: { type: "string", description: "Any text to display on screen" },
            suggested_model: {
              type: "string",
              enum: ["sora_ugc", "sora_i2v", "kling_pro", "kling_standard", "veo", "veo_fast", "heygen_avatar", "remotion"],
              description: "Recommended video model for this scene",
            },
            has_own_audio: { type: "boolean", description: "True if this scene has its own audio (avatar/talking head)" },
          },
          required: ["scene_number", "scene_type", "description", "duration_seconds"],
        },
        description: "Array of scenes in order",
      },
      total_duration_seconds: {
        type: "number",
        description: "Total video duration",
      },
      voiceover_text: {
        type: "string",
        description: "Full voiceover script (for B-roll sections only, NOT hook/CTA)",
      },
      music_mood: {
        type: "string",
        description: "Mood description for background music generation",
      },
      aspect_ratio: {
        type: "string",
        enum: ["9:16", "16:9", "1:1"],
        description: "Output aspect ratio",
      },
    },
    required: ["title", "scenes"],
  },
};

export const createStoryboardTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const title = input.title as string;
  const scenes = input.scenes as Array<{
    scene_number: number;
    scene_type: string;
    description: string;
    image_prompt?: string;
    duration_seconds: number;
    audio_notes?: string;
    text_overlay?: string;
    suggested_model?: string;
    has_own_audio?: boolean;
  }>;
  const totalDuration = (input.total_duration_seconds as number) || scenes.reduce((s, sc) => s + sc.duration_seconds, 0);
  const voiceoverText = input.voiceover_text as string | undefined;
  const musicMood = input.music_mood as string | undefined;
  const aspectRatio = (input.aspect_ratio as string) || "9:16";

  console.log("[tool:create_storyboard]", title, scenes.length, "scenes,", totalDuration + "s");

  emitter.send("tool_progress", {
    tool: "create_storyboard",
    generationId: context.generationId,
    status: "generating",
    message: "Building storyboard...",
  });

  // Save storyboard data to generation metadata
  const storyboardData = {
    title,
    scenes: scenes.map((s, i) => ({
      ...s,
      scene_number: s.scene_number || i + 1,
      status: "pending" as const,
    })),
    total_duration_seconds: totalDuration,
    voiceover_text: voiceoverText,
    music_mood: musicMood,
    aspect_ratio: aspectRatio,
    created_at: new Date().toISOString(),
  };

  // Store in the generation's metadata
  await db
    .from("generations")
    .update({
      creative_brief: storyboardData,
    })
    .eq("id", context.generationId);

  emitter.send("tool_progress", {
    tool: "create_storyboard",
    generationId: context.generationId,
    status: "complete",
    message: "Storyboard ready for review",
  });

  // Emit storyboard event so the UI can show the editor
  emitter.send("storyboard_ready", {
    generationId: context.generationId,
    storyboard: storyboardData,
  });

  const sceneSummary = scenes
    .map((s) => `${s.scene_number}. [${s.scene_type}] ${s.description} (${s.duration_seconds}s)`)
    .join("\n");

  return {
    success: true,
    content: `Storyboard created with ${scenes.length} scenes (${totalDuration}s total):\n\n${sceneSummary}\n\nThe storyboard is now available for the user to review and edit. Once approved, I will generate the visual assets and compose the final video.`,
    data: storyboardData,
  };
};
