import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber } from "./types";
import { generateAvatarVideo } from "@/lib/generation/fal-video";
import { db } from "@/lib/db";

export const generateAvatarVideoDefinition: ToolDefinition = {
  name: "generate_avatar_video",
  description:
    "Generate a UGC-style talking head video using HeyGen Avatar4. Takes a character image and produces a realistic video of the character speaking with lip sync. TWO MODES: (1) Pass audio_url from a previous generate_voiceover call — HeyGen lip-syncs to that audio. This is PREFERRED because it keeps the same voice across avatar and voiceover sections. (2) Pass script_text only — HeyGen uses its own TTS (different voice from ElevenLabs). Best for UGC ads, testimonials, and creator-style content. Costs 20 credits.",
  input_schema: {
    type: "object",
    properties: {
      character_image_url: {
        type: "string",
        description:
          "URL of the character/avatar image. Should show a person facing the camera, preferably upper body or face.",
      },
      script_text: {
        type: "string",
        description:
          "The text the avatar will speak. Keep it SHORT — under 25 words for a ~10 second video. Required even when using audio_url (used for metadata tracking).",
      },
      audio_url: {
        type: "string",
        description:
          "PREFERRED: URL of a pre-generated voiceover audio (from generate_voiceover). When provided, HeyGen lip-syncs to this audio instead of generating its own TTS. This ensures the SAME voice is used for avatar speech and B-roll voiceover. Always prefer this over letting HeyGen generate its own voice.",
      },
      voice_name: {
        type: "string",
        description:
          "Only used when audio_url is NOT provided. Voice name for HeyGen's built-in TTS. Available: 'Melissa' (English female, default), 'Matt' (English male), 'Sara' (Arabic female), 'Mark' (English male deep).",
      },
      talking_style: {
        type: "string",
        enum: ["stable", "expressive"],
        description:
          "Talking style: 'stable' for professional, 'expressive' for casual/UGC (default 'expressive').",
      },
      aspect_ratio: {
        type: "string",
        enum: ["9:16", "16:9", "1:1"],
        description: "Video aspect ratio (default '9:16' for social media).",
      },
      expressiveness: {
        type: "string",
        enum: ["low", "normal", "high"],
        description:
          "Energy level: 'low' for corporate, 'normal' for balanced, 'high' for UGC energy. Default 'expressive' maps to 'high'.",
      },
    },
    required: ["character_image_url", "script_text"],
  },
};

export const generateAvatarVideoTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const characterImageUrl = input.character_image_url as string;
  const scriptText = input.script_text as string;
  const audioUrl = input.audio_url as string | undefined;
  const voiceName = (input.voice_name as string) || "Melissa";

  // Log word count — no longer hard-truncating. Agent controls script length.
  const words = scriptText.split(/\s+/);
  if (words.length > 50) {
    console.warn(`[tool:generate_avatar_video] Long script: ${words.length} words (~${Math.round(words.length / 2.5)}s). HeyGen may struggle with very long scripts.`);
  }
  const talkingStyle =
    (input.talking_style as "stable" | "expressive") || "expressive";
  const aspectRatio = (input.aspect_ratio as string) || "9:16";
  // HeyGen's expression field only accepts 'happy' — don't pass arbitrary values
  // Use talking_style (stable/expressive) for energy control instead
  const rawExpressiveness = input.expressiveness as string | undefined;
  // Only map to a valid HeyGen expression value
  const expression = rawExpressiveness === "high" ? "happy" : undefined;

  console.log("[tool:generate_avatar_video] Generating avatar video with HeyGen Avatar4");

  try {
    emitter.send("tool_progress", {
      tool: "generate_avatar_video",
      generationId: context.generationId,
      status: "generating",
      message: `Generating talking head (${voiceName}, ${talkingStyle})...`,
    });

    // Validate inputs before calling fal.ai
    if (!characterImageUrl || !characterImageUrl.startsWith("http")) {
      throw new Error(`Invalid character image URL: "${characterImageUrl}". Must be a valid HTTP URL.`);
    }
    if (!scriptText || scriptText.trim().length < 3) {
      throw new Error(`Script text too short or empty: "${scriptText}". Provide at least a short sentence.`);
    }

    console.log("[tool:generate_avatar_video]", audioUrl ? "audio_url mode" : "prompt+voice mode", "voice:", voiceName, "style:", talkingStyle, "script:", scriptText.slice(0, 60), "image:", characterImageUrl.slice(0, 80));

    const videoUrl = await generateAvatarVideo({
      imageUrl: characterImageUrl,
      prompt: scriptText,
      voice: voiceName,
      audioUrl,
      talkingStyle,
      expression,
      aspectRatio: aspectRatio as "9:16" | "16:9" | "1:1",
      generationId: context.generationId,
      onProgress: (msg) => {
        emitter.send("tool_progress", {
          tool: "generate_avatar_video",
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
        aspect_ratio: aspectRatio,
        public_url: videoUrl,
        storage_path: videoUrl,
        metadata: {
          type: "avatar_ugc",
          character_image_url: characterImageUrl,
          script_text: scriptText,
          talking_style: talkingStyle,
          model: "heygen-avatar4",
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    return {
      success: true,
      content: `Avatar talking head video generated (${aspectRatio}). ${audioUrl ? "Lip-synced to pre-generated ElevenLabs audio (voice-consistent with voiceover)." : "Used HeyGen built-in TTS."} URL: ${videoUrl}`,
      assets: [
        {
          assetId: asset?.id,
          type: "video",
          url: videoUrl,
          metadata: {
            type: "avatar_ugc",
            aspect_ratio: aspectRatio,
            character_image_url: characterImageUrl,
            talking_style: talkingStyle,
          },
        },
      ],
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[tool:generate_avatar_video] Error:", errMsg);

    // Provide actionable error context
    let hint = "";
    if (errMsg.includes("voice")) {
      hint = " Hint: Try voice_name='Melissa' (English) or 'Sara' (Arabic).";
    } else if (errMsg.includes("image") || errMsg.includes("url")) {
      hint = " Hint: The character_image_url may be expired or inaccessible. Try generating a new character first.";
    } else if (errMsg.includes("timeout")) {
      hint = " Hint: HeyGen took too long. Try a shorter script (under 15 words).";
    } else if (errMsg.includes("422") || errMsg.includes("validation")) {
      hint = " Hint: HeyGen rejected the input. Check that character_image_url shows a clear face and script_text is not empty.";
    }

    return {
      success: false,
      content: `Avatar video generation failed: ${errMsg}${hint}`,
    };
  }
};
