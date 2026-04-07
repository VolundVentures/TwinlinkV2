import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber } from "./types";
import { generateSpeech } from "@/lib/generation/tts";
import { uploadToFal } from "@/lib/generation/fal-video";
import { db } from "@/lib/db";
import { TOOL_CREDIT_COSTS } from "./types";

export const generateVoiceoverDefinition: ToolDefinition = {
  name: "generate_voiceover",
  description:
    "Generate voiceover audio from text. Returns a hosted audio URL. Costs 3 credits.\n\n**Voice-Emotion Mapping (choose based on creative direction):**\n- 'ugc'/'casual' → Camille (F) — content creator energy, confessional, relatable\n- 'warm'/'friendly' → Sophie (F) — social media warmth, trustworthy friend\n- 'promo'/'polished' → Koraly (F) — launch energy, polished confidence\n- 'educator'/'tutorial' → Kat (F) — sharp, smart, authoritative\n- 'premium'/'luxury' → Christopher (M) — smooth deep voice, late-night confession intimacy\n- 'storytelling'/'emotional' → Hale (M) — expressive, atmospheric, makes you lean in\n- 'energetic'/'hype' → Clemens (M) — loud, attention-grabbing, sports energy\n- 'professional'/'corporate' → B.Giffen (M) — steady narration, trust\n- 'darija'/'moroccan' → Ghizlane (F) — Moroccan Darija via ElevenLabs\n\n**When to use which voice:**\n- Luxury/cinematic product ad → Christopher or Hale (slow, intimate)\n- UGC testimonial → Camille or Sophie (casual, authentic)\n- Sports/aggressive → Clemens (fast, punchy)\n- Arabic → Gemini TTS used automatically (best quality)\n\n**For UGC:** Generate SEPARATE voiceover for each talking section's dialogue text. These get lipsync'd individually. Do NOT generate one continuous VO for UGC.\n**For Product Hero:** Generate ONE continuous voiceover covering the full script.\n\n**Use the SAME voice_style across ALL calls in one ad** for consistency.",
  input_schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description:
          "The text to convert to speech. Can be any length — longer scripts generate longer audio.",
      },
      voice_style: {
        type: "string",
        description:
          "Style keywords to select the best voice: 'ugc', 'casual', 'premium', 'energetic', 'storytelling', 'warm', 'promo', 'educator', 'professional', 'darija'. Can combine with gender: 'female_casual', 'male_premium'. See description for full catalog.",
      },
      voice_id: {
        type: "string",
        description:
          "Direct ElevenLabs voice ID — bypasses style-based selection. Use this when you want a specific voice from the catalog or a custom voice.",
      },
      language: {
        type: "string",
        description:
          "Language code (e.g. 'en', 'fr', 'ar', 'ar-MA'). Arabic uses Gemini TTS unless voice_id is provided.",
      },
    },
    required: ["text"],
  },
};

export const generateVoiceoverTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const text = input.text as string;
  const voiceStyle = (input.voice_style as string) || undefined;
  const voiceId = (input.voice_id as string) || undefined;
  const language = (input.language as string) || context.language || "en";

  // Reject text that's too short for the video duration
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const estimatedAudioSec = Math.round(wordCount / 2.5);

  // Hard reject: less than 25 words is too short for any ad voiceover
  if (wordCount < 25) {
    return {
      success: false,
      content: `Voiceover text is only ${wordCount} words (~${estimatedAudioSec}s of audio). This is too short — the voiceover must cover at least 60% of the video. For a 25-30s ad, write at least 40-50 words. Did you pass only one section's text instead of the full script? Pass the FULL voiceover text.`,
    };
  }

  // No aggressive truncation — let the agent control script length.
  // The agent knows the video duration and should write appropriately.
  if (wordCount > 200) {
    console.warn(`[tool:generate_voiceover] Very long text: ${wordCount} words (~${Math.round(wordCount / 2.5)}s). This may exceed video duration.`);
  }

  console.log(
    "[tool:generate_voiceover] Text length:",
    text.length,
    "words:",
    text.split(/\s+/).length,
    "language:",
    language,
    "style:",
    voiceStyle
  );

  const isArabic = language === "ar" || language === "arabic";

  emitter.send("tool_progress", {
    tool: "generate_voiceover",
    generationId: context.generationId,
    status: "generating",
    message: `Generating voiceover (${language}) with ${isArabic ? "Gemini TTS" : "ElevenLabs"}...`,
  });

  try {
    // Generate speech using the TTS router
    const { audioBuffer, format, durationEstimate } = await generateSpeech({
      text,
      language,
      style: voiceStyle,
      voice_id: voiceId,
    });

    console.log(
      "[tool:generate_voiceover] Audio generated, size:",
      audioBuffer.byteLength,
      "format:",
      format
    );

    emitter.send("tool_progress", {
      tool: "generate_voiceover",
      generationId: context.generationId,
      status: "uploading",
      message: "Uploading voiceover to storage...",
    });

    // Upload audio to Supabase Storage for a PERMANENT URL
    // (fal.ai storage URLs expire after ~5 minutes, causing Remotion render failures)
    const contentType = format === "wav" ? "audio/wav" : "audio/mpeg";
    const extension = format === "wav" ? "wav" : "mp3";
    const fileName = `voiceover-${context.generationId}-${Date.now()}.${extension}`;
    let audioUrl: string;

    try {
      const { db: supabase } = await import("@/lib/db");

      // Ensure the bucket exists (create if first time)
      const { error: bucketError } = await supabase.storage.createBucket("voiceovers", {
        public: true,
        allowedMimeTypes: ["audio/mpeg", "audio/wav", "audio/mp3"],
      });
      // Ignore "already exists" errors
      if (bucketError && !bucketError.message.includes("already exists")) {
        console.warn("[tool:generate_voiceover] Bucket creation warning:", bucketError.message);
      }

      const { error: uploadError } = await supabase.storage
        .from("voiceovers")
        .upload(fileName, audioBuffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from("voiceovers")
        .getPublicUrl(fileName);

      audioUrl = publicUrlData.publicUrl;
      console.log("[tool:generate_voiceover] Uploaded to Supabase Storage:", audioUrl.slice(0, 80));
    } catch (uploadErr) {
      // Retry Supabase once before falling back
      console.warn("[tool:generate_voiceover] Supabase upload failed, retrying:", uploadErr);
      try {
        const { db: supabase2 } = await import("@/lib/db");
        const retryName = `voiceover-${context.generationId}-retry-${Date.now()}.${extension}`;
        const { error: retryError } = await supabase2.storage.from("voiceovers").upload(retryName, audioBuffer, { contentType, upsert: true });
        if (retryError) throw retryError;
        const { data: retryUrl } = supabase2.storage.from("voiceovers").getPublicUrl(retryName);
        audioUrl = retryUrl.publicUrl;
        console.log("[tool:generate_voiceover] Supabase retry succeeded:", audioUrl.slice(0, 80));
      } catch {
        // Fallback to fal.ai (TEMPORARY — will expire, risky for long pipelines)
        console.error("[tool:generate_voiceover] CRITICAL: Supabase failed twice. Using fal.ai temporary URL — may expire during render.");
        try {
          audioUrl = await uploadToFal(audioBuffer, contentType, fileName);
        } catch {
          throw new Error("Failed to upload voiceover audio to any storage. Cannot proceed.");
        }
      }
    }

    // Save to generation_assets
    const variantNum = await getNextVariantNumber(context.generationId);
    const { data: asset, error: saveError } = await db
      .from("generation_assets")
      .insert({
        generation_id: context.generationId,
        org_id: context.orgId,
        type: "audio",
        metadata: {
          text,
          voice_style: voiceStyle || "male_professional",
          language,
          format,
          provider: isArabic ? "gemini" : "elevenlabs",
          size_bytes: audioBuffer.byteLength,
        },
        storage_path: audioUrl,
        public_url: audioUrl,
        variant_number: variantNum,
      })
      .select("id")
      .single();

    if (saveError) {
      console.warn(
        "[tool:generate_voiceover] Failed to save asset:",
        saveError.message
      );
    }

    emitter.send("tool_progress", {
      tool: "generate_voiceover",
      generationId: context.generationId,
      status: "complete",
      message: "Voiceover generated successfully",
    });

    const summary = [
      `Voiceover generated successfully`,
      `Audio URL: ${audioUrl}`,
      `Language: ${language}`,
      `Provider: ${isArabic ? "Gemini 2.5 Pro TTS" : "ElevenLabs"}`,
      `Voice: ${voiceStyle || "male_professional"}`,
      `Format: ${format}`,
      `Text length: ${text.length} characters`,
      `Estimated duration: ~${durationEstimate}s`,
      `Audio size: ${(audioBuffer.byteLength / 1024).toFixed(1)} KB`,
      `Credits used: ${TOOL_CREDIT_COSTS.generate_voiceover}`,
    ].join("\n");

    return {
      success: true,
      content: summary,
      data: {
        language,
        voiceStyle,
        format,
        provider: isArabic ? "gemini" : "elevenlabs",
        sizeBytes: audioBuffer.byteLength,
      },
      assets: [
        {
          assetId: asset?.id,
          type: "audio",
          url: audioUrl,
          metadata: {
            text,
            voice_style: voiceStyle || "male_professional",
            language,
            format,
            size_bytes: audioBuffer.byteLength,
          },
        },
      ],
    };
  } catch (error) {
    console.error("[tool:generate_voiceover] Error:", error);
    return {
      success: false,
      content: `Voiceover generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
