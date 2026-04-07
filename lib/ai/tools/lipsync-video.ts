import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber } from "./types";
import { lipsyncVideo } from "@/lib/generation/fal-video";
import { db } from "@/lib/db";

export const lipsyncVideoDefinition: ToolDefinition = {
  name: "lipsync_video",
  description:
    "Apply lip-sync to a video. Takes a Veo video + ElevenLabs audio → produces video with lips synced to the voice. Costs 5 credits.\n\n**UGC Pipeline:** generate_video(veo_ugc) → generate_voiceover(section text) → lipsync_video → result is a talking clip with brand voice.\n\n**CRITICAL QUALITY RULES:**\n- Source video must have the person's MOUTH FULLY VISIBLE throughout\n- Hands must stay BELOW SHOULDERS during dialogue — hands near face cause severe mouth distortion artifacts\n- NO face touching, chin-resting-on-hand, or objects near mouth\n- ONE person per clip (multiple faces = lipsync confusion)\n- Close-up framing works best (eyes-to-chin visible)\n\n**SEQUENTIAL PROCESSING:** Call lipsync_video ONE AT A TIME. Do NOT call multiple in parallel — ElevenLabs returns 409 rate limit errors. Process each talking clip sequentially: voiceover → lipsync → next clip.",
  input_schema: {
    type: "object",
    properties: {
      video_url: {
        type: "string",
        description:
          "URL of the source video. Typically a Veo 3.1 video that was generated WITH dialogue in the prompt (so it has natural lip/mouth movements to re-sync).",
      },
      audio_url: {
        type: "string",
        description:
          "URL of the audio to sync lips to. Typically from generate_voiceover (ElevenLabs) for brand-consistent voice.",
      },
      label: {
        type: "string",
        description:
          "Label for this clip in the final composition. Use 'hook' for the opening shot, 'cta' for the call-to-action, or a descriptive label like 'testimonial', 'problem', 'solution'.",
      },
    },
    required: ["video_url", "audio_url"],
  },
};

export const lipsyncVideoTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const videoUrl = input.video_url as string;
  const audioUrl = input.audio_url as string;
  const label = (input.label as string) || undefined;

  if (!videoUrl || !videoUrl.startsWith("http")) {
    return { success: false, content: "Invalid video_url. Must be a valid HTTP URL." };
  }
  if (!audioUrl || !audioUrl.startsWith("http")) {
    return { success: false, content: "Invalid audio_url. Must be a valid HTTP URL." };
  }

  try {
    emitter.send("tool_progress", {
      tool: "lipsync_video",
      generationId: context.generationId,
      status: "generating",
      message: "Applying lip-sync with Sync Lipsync 2.0 Pro...",
    });

    const resultUrl = await lipsyncVideo({
      videoUrl,
      audioUrl,
      model: "sync-lipsync-2.0-pro",
      generationId: context.generationId,
      onProgress: (msg) => {
        emitter.send("tool_progress", {
          tool: "lipsync_video",
          generationId: context.generationId,
          status: "generating",
          message: msg,
        });
      },
    });

    // Save to generation_assets
    const variantNum = await getNextVariantNumber(context.generationId);
    const { data: asset } = await db
      .from("generation_assets")
      .insert({
        generation_id: context.generationId,
        org_id: context.orgId,
        type: "video",
        public_url: resultUrl,
        storage_path: resultUrl,
        metadata: {
          type: "lipsync_ugc",
          model: "sync-lipsync-2.0-pro",
          source_video_url: videoUrl,
          source_audio_url: audioUrl,
          label,
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    return {
      success: true,
      content: `Lip-synced video generated. The video now has the brand voice perfectly synced to the character's lip movements.${label ? ` Label: ${label}.` : ""} URL: ${resultUrl}`,
      assets: [
        {
          assetId: asset?.id,
          type: "video",
          url: resultUrl,
          metadata: {
            type: "lipsync_ugc",
            label,
            source_video_url: videoUrl,
            source_audio_url: audioUrl,
          },
        },
      ],
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[tool:lipsync_video] Error:", errMsg);

    let hint = "";
    if (errMsg.includes("timeout")) {
      hint = " Hint: The video may be too long. Try with shorter clips (under 10s).";
    } else if (errMsg.includes("422") || errMsg.includes("validation")) {
      hint = " Hint: Check that both video_url and audio_url are accessible and valid media files.";
    }

    return {
      success: false,
      content: `Lip-sync failed: ${errMsg}${hint}`,
    };
  }
};
