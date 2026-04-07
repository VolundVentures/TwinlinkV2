import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber } from "./types";
import { renderComposition } from "@/lib/generation/remotion-render";
import { transcribeAudio } from "@/lib/generation/transcription";
import { db } from "@/lib/db";
import type { AdCompositionProps, CaptionWord } from "@/remotion/lib/types";

export const composeVideoDefinition: ToolDefinition = {
  name: "compose_video",
  description:
    "Compose multiple video/image clips into a finished video ad with professional audio mixing.\n\n**Audio Architecture (CRITICAL — gets this wrong = bad video):**\n\n*Product Hero (Model A — voiceover-only):*\n- ONE continuous voiceover plays over ALL clips from start to finish\n- ALL clips: has_own_audio=false, is_lipsync=false\n- Music plays throughout at 0.15 volume\n- Voiceover at 0.85 volume\n\n*UGC Testimonial (Model B — talking + B-roll):*\n- Talking clips: is_lipsync=true, has_own_audio=true (lipsync audio at full volume)\n- B-roll clips: has_own_audio=false (SILENT — only music plays during B-roll)\n- NO continuous voiceover track — the lipsync IS the voice\n- Music: 0.12 during talking, 0.25 during B-roll\n- Typical: 3 talking + 2-3 B-roll clips intercut\n\n**Pacing & Transitions:**\n- UGC: hard cuts (\"cut\") — raw, authentic energy\n- Luxury/cinematic: crossfade — smooth, premium feel\n- Crossfade duration: 0.5s standard, up to 1.0s for luxury\n\n**Captions: OFF by default.** Never enable unless user explicitly requests.\n\nCosts 5 credits.",
  input_schema: {
    type: "object",
    properties: {
      clips: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "URL of the video or image asset.",
            },
            type: {
              type: "string",
              enum: ["video", "image"],
              description: "Asset type.",
            },
            label: {
              type: "string",
              description:
                "Descriptive label: 'hook', 'talking_head', 'product_broll', 'cta', etc.",
            },
            duration_seconds: {
              type: "number",
              description:
                "Duration in seconds for this clip. For images, how long to show them. Default 5s.",
            },
            has_own_audio: {
              type: "boolean",
              description:
                "Set to true for clips that have ANY audio (ambient SFX from generate_audio=true, or lipsync). Set to false for silent B-roll/images. When true, the clip's native audio plays at LOW ambient volume (0.06) under the voiceover — unless is_lipsync is also true.",
            },
            is_lipsync: {
              type: "boolean",
              description:
                "Set to true ONLY for lip-synced clips (from lipsync_video or HeyGen avatar). These play at FULL volume and MUTE the voiceover during their duration. Default false.",
            },
          },
          required: ["url", "type", "has_own_audio"],
        },
        description:
          "Array of clips to compose. Arranged on timeline in order.",
      },
      voiceover_url: {
        type: "string",
        description:
          "URL of the voiceover audio track. This is the AUDIO BACKBONE of the ad — it plays continuously across all visual cuts. Generate this with generate_voiceover BEFORE composing. Volume: -6 to -3 dB (~0.85).",
      },
      background_music_url: {
        type: "string",
        description:
          "Optional background music URL. Plays underneath the voiceover at low volume (-18 to -12 dB, ~0.12). Should be instrumental only.",
      },
      text_overlays: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            position: {
              type: "string",
              enum: ["top", "center", "bottom"],
            },
            start_seconds: { type: "number" },
            end_seconds: { type: "number" },
            font_size: { type: "number", description: "Default 48" },
            color: { type: "string", description: "Text color hex. Default #FFFFFF" },
          },
          required: ["text", "position"],
        },
        description: "Text overlays (headlines, CTAs) to render on the video.",
      },
      captions: {
        type: "boolean",
        description:
          "Enable animated captions. Default FALSE — do NOT enable unless explicitly requested.",
      },
      caption_segments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: "The caption text for this segment." },
            start_seconds: { type: "number", description: "When this caption appears (seconds from video start)." },
            end_seconds: { type: "number", description: "When this caption disappears." },
          },
          required: ["text", "start_seconds", "end_seconds"],
        },
        description:
          "PREFERRED over Whisper transcription. Provide timed caption segments from the script. Each segment becomes a caption group. The agent already has the script text — use it directly instead of relying on audio transcription which introduces errors.",
      },
      transition: {
        type: "string",
        enum: ["cut", "crossfade", "fade_to_black"],
        description: "Transition between clips. Default 'crossfade'.",
      },
      aspect_ratio: {
        type: "string",
        enum: ["16:9", "9:16", "1:1"],
        description: "Output aspect ratio. Default '9:16'.",
      },
      brand_watermark: {
        type: "boolean",
        description:
          "Add brand name/logo watermark. Uses brand context. Default false.",
      },
      voiceover_duration_seconds: {
        type: "number",
        description:
          "Estimated duration of the voiceover in seconds (from generate_voiceover output). Used to detect clip/VO duration mismatches and avoid black screens at the end.",
      },
    },
    required: ["clips"],
  },
};

export const composeVideoTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const clips = input.clips as Array<{
    url: string;
    type: "video" | "image";
    label?: string;
    duration_seconds?: number;
    has_own_audio?: boolean;
    is_lipsync?: boolean;
  }>;
  const voiceoverUrl = input.voiceover_url as string | undefined;
  const backgroundMusicUrl = input.background_music_url as string | undefined;
  const textOverlays = input.text_overlays as Array<{
    text: string;
    position: string;
    start_seconds?: number;
    end_seconds?: number;
    font_size?: number;
    color?: string;
  }> | undefined;
  const captionSegments = input.caption_segments as Array<{
    text: string;
    start_seconds: number;
    end_seconds: number;
  }> | undefined;
  // Captions OFF by default — agent must explicitly enable for UGC
  const addCaptions = input.captions === true;
  const transition = (input.transition as string) || "crossfade";
  const aspectRatio = (input.aspect_ratio as string) || "9:16";
  const addWatermark = (input.brand_watermark as boolean) || false;
  const voiceoverDurationSeconds = input.voiceover_duration_seconds as number | undefined;

  const fps = 30;

  console.log(
    "[tool:compose_video]",
    "clips:", clips.length,
    "transition:", transition,
    "aspect:", aspectRatio,
    "captions:", addCaptions,
    "watermark:", addWatermark,
    "voiceover:", voiceoverUrl ? voiceoverUrl.slice(0, 60) : "NONE",
    "music:", backgroundMusicUrl ? backgroundMusicUrl.slice(0, 60) : "NONE"
  );

  // Validate inputs early
  if (!clips || clips.length === 0) {
    return {
      success: false,
      content: "compose_video requires at least one clip. Generate video or image assets first, then pass their URLs.",
    };
  }

  const invalidClips = clips.filter((c) => !c.url || !c.url.startsWith("http"));
  if (invalidClips.length > 0) {
    return {
      success: false,
      content: `${invalidClips.length} clip(s) have invalid URLs. All clips must have valid HTTP URLs. Check that previous generation steps completed successfully.`,
    };
  }

  // Pre-compose validation — WARN on missing music but don't block
  // Blocking caused deadlocks when Suno was down — better to have video without music than no video
  if (!backgroundMusicUrl) {
    console.warn("[tool:compose_video] WARNING: No background_music_url. Video will have no background music.");
  }

  if (!voiceoverUrl && clips.every(c => !c.has_own_audio)) {
    console.error("[tool:compose_video] BLOCKED: No audio source at all.");
    return {
      success: false,
      content: "compose_video BLOCKED: No voiceover_url and no clips with own audio. The video would be completely silent. Call generate_voiceover first.",
    };
  }

  // Validate clip durations exist
  const clipsWithoutDuration = clips.filter(c => !c.duration_seconds);
  if (clipsWithoutDuration.length > 0) {
    return {
      success: false,
      content: `${clipsWithoutDuration.length} clip(s) missing duration_seconds. ALL clips MUST have explicit duration_seconds to prevent audio sync issues. Set each clip's duration to match its actual video length.`,
    };
  }

  // Validate voiceover/clip duration alignment
  const totalClipSeconds = clips.reduce((sum, c) => sum + (c.duration_seconds || 5), 0);
  if (voiceoverUrl && voiceoverDurationSeconds) {
    if (voiceoverDurationSeconds > totalClipSeconds + 3) {
      console.warn(`[tool:compose_video] DURATION MISMATCH: VO=${voiceoverDurationSeconds}s but clips=${totalClipSeconds}s. Voiceover will be cut off.`);
    }
  }

  emitter.send("tool_progress", {
    tool: "compose_video",
    generationId: context.generationId,
    status: "generating",
    message: `Composing ${clips.length} clips into a finished video...`,
  });

  try {
    // Build Remotion inputProps
    const compositionClips = clips.map((clip) => {
      return {
        url: clip.url,
        type: clip.type,
        durationFrames: Math.round((clip.duration_seconds || 5) * fps),
        label: clip.label || "clip",
        hasOwnAudio: clip.has_own_audio === true,
        isLipsync: clip.is_lipsync === true, // Only lipsync clips play at full volume and mute VO
      };
    });

    // CLIP ORDER: Respect the agent's order. The agent is the creative director.
    // No automatic reordering — clips play in the exact order provided.
    console.log("[tool:compose_video] Clip order (agent-defined):", compositionClips.map((c) => `${c.label}(${c.hasOwnAudio ? "talk" : "broll"})`).join(" → "));

    // VOICEOVER START: Always frame 0.
    // The Remotion composition already mutes voiceover during has_own_audio clips
    // via the avatarFrameRanges volume function. No need to delay the start.
    const voiceoverStartFrame = 0;

    // Log audio routing for debugging
    const avatarClipCount = compositionClips.filter(c => c.hasOwnAudio).length;
    const brollClipCount = compositionClips.filter(c => !c.hasOwnAudio).length;
    console.log(`[tool:compose_video] Audio routing: ${avatarClipCount} avatar clips, ${brollClipCount} B-roll clips, VO starts at frame ${voiceoverStartFrame}`);

    const compositionProps: AdCompositionProps = {
      clips: compositionClips,
      transition: transition as AdCompositionProps["transition"],
      fps,
    };

    // Voiceover — starts at frame 0, plays continuously.
    // Remotion's voiceoverVolume function automatically mutes during has_own_audio clips.
    if (voiceoverUrl) {
      const voDurationFrames = voiceoverDurationSeconds ? Math.round(voiceoverDurationSeconds * fps) : undefined;
      compositionProps.audio = {
        url: voiceoverUrl,
        volume: 0.85,
        startFrame: 0,
        durationFrames: voDurationFrames,
      };

      // Warn about duration mismatch
      const totalClipSeconds = clips.reduce((sum, c) => sum + (c.duration_seconds || 5), 0);
      if (voiceoverDurationSeconds && Math.abs(totalClipSeconds - voiceoverDurationSeconds) > 3) {
        console.warn(
          `[tool:compose_video] DURATION MISMATCH: clips=${totalClipSeconds}s, VO=${voiceoverDurationSeconds}s (diff=${Math.abs(totalClipSeconds - voiceoverDurationSeconds).toFixed(1)}s)`
        );
      }
    }

    // Background music — professional ratio: voice at -12 LUFS, music at -20 LUFS (8 LU gap)
    // In linear scale: voice=0.85 (~-1.4dB), music=0.15 (~-16dB)
    // Music volume relative to voice should be ~6-8x quieter
    if (backgroundMusicUrl) {
      compositionProps.backgroundMusic = {
        url: backgroundMusicUrl,
        volume: 0.15, // Professional broadcast ratio: ~8 LU below voiceover
      };
    }

    // Text overlays
    if (textOverlays && textOverlays.length > 0) {
      const totalDurationSeconds = clips.reduce(
        (sum, c) => sum + (c.duration_seconds || 5),
        0
      );
      compositionProps.textOverlays = textOverlays.map((overlay) => ({
        text: overlay.text,
        position: overlay.position as "top" | "center" | "bottom",
        startFrame: Math.round((overlay.start_seconds || 0) * fps),
        endFrame: Math.round(
          (overlay.end_seconds || totalDurationSeconds) * fps
        ),
        style: {
          fontSize: overlay.font_size || 48,
          color: overlay.color || "#FFFFFF",
          fontFamily: context.brand?.font_family || "Inter",
          fontWeight: "700",
        },
      }));
    }

    // Generate captions — prefer script segments over Whisper transcription
    let captionWords: CaptionWord[] | undefined;
    if (addCaptions) {
      if (captionSegments && captionSegments.length > 0) {
        // PREFERRED: Use script-based captions (no Whisper needed)
        // Convert script segments into word-level captions
        emitter.send("tool_progress", {
          tool: "compose_video",
          generationId: context.generationId,
          status: "generating",
          message: "Building captions from script...",
        });

        captionWords = [];
        for (const segment of captionSegments) {
          const words = segment.text.split(/\s+/).filter(w => w.length > 0);
          if (words.length === 0) continue;
          const segmentDurationMs = (segment.end_seconds - segment.start_seconds) * 1000;
          const wordDurationMs = segmentDurationMs / words.length;

          for (let i = 0; i < words.length; i++) {
            captionWords.push({
              word: words[i],
              startMs: Math.round(segment.start_seconds * 1000 + i * wordDurationMs),
              endMs: Math.round(segment.start_seconds * 1000 + (i + 1) * wordDurationMs),
            });
          }
        }
        compositionProps.captions = captionWords;
        console.log(`[tool:compose_video] Script-based captions: ${captionWords.length} words from ${captionSegments.length} segments`);
      } else if (voiceoverUrl) {
        // FALLBACK: Whisper transcription
        emitter.send("tool_progress", {
          tool: "compose_video",
          generationId: context.generationId,
          status: "generating",
          message: "Transcribing speech for captions...",
        });

        try {
          const transcription = await transcribeAudio(voiceoverUrl, {
            generationId: context.generationId,
          });
          captionWords = transcription.words.map((w) => ({
            ...w,
            startMs: w.startMs,
            endMs: w.endMs,
          }));
          compositionProps.captions = captionWords;
        } catch (err) {
          console.warn("[tool:compose_video] Caption transcription failed:", err);
        }
      }
    }

    // Brand watermark
    if (addWatermark && context.brand) {
      compositionProps.brandWatermark = {
        text: context.brand.name,
        logoUrl: context.brand.logo_url || undefined,
        color: "#FFFFFF",
        position: "bottom-right",
      };
    }

    // Choose composition based on aspect ratio
    const compositionId =
      aspectRatio === "16:9"
        ? "AdComposition-Landscape"
        : aspectRatio === "1:1"
          ? "AdComposition-Square"
          : "AdComposition";

    emitter.send("tool_progress", {
      tool: "compose_video",
      generationId: context.generationId,
      status: "generating",
      message: "Rendering composed video via Remotion...",
    });

    // Render via Remotion Lambda
    const result = await renderComposition({
      compositionId,
      inputProps: compositionProps as unknown as Record<string, unknown>,
      format: "mp4",
      generationId: context.generationId,
    });

    console.log("[tool:compose_video] Render complete:", result.url.slice(0, 80));

    emitter.send("tool_progress", {
      tool: "compose_video",
      generationId: context.generationId,
      status: "saving",
      message: "Saving composed video...",
    });

    // Save to generation_assets
    const variantNum = await getNextVariantNumber(context.generationId);
    const { data: asset, error: saveError } = await db
      .from("generation_assets")
      .insert({
        generation_id: context.generationId,
        org_id: context.orgId,
        type: "video",
        aspect_ratio: aspectRatio,
        storage_path: result.url,
        public_url: result.url,
        metadata: {
          asset_category: "composed_video",
          source_clips: clips.map((c) => ({
            url: c.url,
            type: c.type,
            label: c.label,
          })),
          transition,
          has_captions: !!captionWords,
          has_watermark: addWatermark,
          has_voiceover: !!voiceoverUrl,
          has_music: !!backgroundMusicUrl,
          text_overlay_count: textOverlays?.length || 0,
          render_duration_ms: result.durationMs,
          composition_id: compositionId,
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    if (saveError) {
      console.warn("[tool:compose_video] Failed to save:", saveError.message);
    }

    emitter.send("tool_progress", {
      tool: "compose_video",
      generationId: context.generationId,
      status: "complete",
      message: "Video composed successfully",
    });

    const totalDuration = clips.reduce(
      (sum, c) => sum + (c.duration_seconds || 5),
      0
    );

    const summary = [
      `Composed video created successfully (${aspectRatio}, ~${totalDuration}s)`,
      `URL: ${result.url}`,
      `Clips: ${clips.length} (${clips.map((c) => c.label || c.type).join(", ")})`,
      `Transition: ${transition}`,
      addCaptions && captionWords
        ? `Captions: ${captionWords.length} words transcribed`
        : null,
      addWatermark ? `Watermark: ${context.brand?.name}` : null,
      textOverlays?.length
        ? `Text overlays: ${textOverlays.length}`
        : null,
      voiceoverUrl ? `Voiceover: ${voiceoverUrl.slice(0, 60)}...` : null,
      backgroundMusicUrl ? `Background music: ${backgroundMusicUrl.slice(0, 60)}...` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      success: true,
      content: summary,
      data: { url: result.url, aspectRatio, durationSeconds: totalDuration },
      assets: [
        {
          assetId: asset?.id,
          type: "video",
          url: result.url,
          metadata: {
            asset_category: "composed_video",
            aspect_ratio: aspectRatio,
            duration_seconds: totalDuration,
            transition,
          },
        },
      ],
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[tool:compose_video] Error:", errMsg);

    // Provide actionable context
    let hint = "";
    if (errMsg.includes("REMOTION_FUNCTION_NAME") || errMsg.includes("REMOTION_SERVE_URL")) {
      hint = " Hint: Remotion Lambda is not configured. Set REMOTION_FUNCTION_NAME and REMOTION_SERVE_URL in .env.";
    } else if (errMsg.includes("timeout")) {
      hint = " Hint: Remotion render timed out. Try fewer clips or shorter duration.";
    } else if (errMsg.includes("render failed")) {
      hint = " Hint: The Remotion composition crashed during rendering. Check that all clip URLs are accessible and valid.";
    }

    // Log clip details for debugging
    console.error("[tool:compose_video] Clip details:", JSON.stringify(clips.map(c => ({
      url: c.url?.slice(0, 60),
      type: c.type,
      duration: c.duration_seconds,
    }))));

    return {
      success: false,
      content: `Video composition failed: ${errMsg}${hint}`,
    };
  }
};
