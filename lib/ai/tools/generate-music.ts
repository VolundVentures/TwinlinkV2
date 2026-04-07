import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber } from "./types";
import { generateMusic } from "@/lib/generation/music";
import { db } from "@/lib/db";

export const generateMusicDefinition: ToolDefinition = {
  name: "generate_music",
  description:
    "Generate instrumental background music using Suno AI. ALWAYS instrumental, no vocals. Costs 5 credits.\n\n**BPM-to-Mood Mapping:**\n- 60-80 BPM: Intimate, luxury, contemplative (ambient piano, soft strings)\n- 80-100 BPM: Warm storytelling, lifestyle (acoustic guitar, lo-fi beats)\n- 100-120 BPM: Confident, brand anthem (modern electronic, light percussion)\n- 120-140 BPM: Exciting, sports, energetic (trap beats, driving synths)\n- 140+ BPM: Aggressive, percussive (heavy bass, synth risers)\n\n**Genre-to-Brand:**\n- Luxury/automotive: ambient electronic, piano, cinematic strings\n- Sports/fitness: trap, aggressive synths, heavy percussion\n- UGC/casual: lo-fi beats, acoustic guitar, warm pads\n- Tech/SaaS: minimal electronic, glitch, future bass\n- Fashion: deep house, moody electronic, editorial\n\n**CRITICAL:** Music must start IMMEDIATELY with energy from beat one — no slow intros. Suno often adds 2-3s of silence. Include 'Starts immediately, no intro silence' in prompt.\n\nPass the returned URL as background_music_url in compose_video.",
  input_schema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "Describe the mood and feel of the music. Be specific about energy, emotion, and genre. Example: 'Warm uplifting lo-fi beats, gentle acoustic guitar with soft piano, cozy afternoon feeling, perfect for a pet product ad targeting young women'",
      },
      style: {
        type: "string",
        description:
          "Genre/style tags. Example: 'lo-fi, acoustic, warm, uplifting' or 'corporate, minimal, ambient, electronic' or 'energetic, pop, upbeat, fun'",
      },
      title: {
        type: "string",
        description: "Short title for the track. Example: 'Cozy Pet Vibes'",
      },
    },
    required: ["prompt"],
  },
};

export const generateMusicTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const prompt = input.prompt as string;
  const style = (input.style as string) || undefined;
  const title = (input.title as string) || "Ad Background Music";

  console.log(
    "[tool:generate_music]",
    "prompt:", prompt.slice(0, 60),
    "style:", style
  );

  emitter.send("tool_progress", {
    tool: "generate_music",
    generationId: context.generationId,
    status: "generating",
    message: "Generating background music with Suno AI...",
  });

  // Retry up to 2 times — Suno can be flaky
  const MAX_RETRIES = 2;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[tool:generate_music] Retry attempt ${attempt}/${MAX_RETRIES}...`);
        emitter.send("tool_progress", {
          tool: "generate_music",
          generationId: context.generationId,
          status: "generating",
          message: `Music generation retry ${attempt}/${MAX_RETRIES}...`,
        });
      }

      const result = await generateMusic({
        prompt,
        style,
        title,
        instrumental: true,
        generationId: context.generationId,
        targetDuration: 30,
      });

      emitter.send("tool_progress", {
        tool: "generate_music",
        generationId: context.generationId,
        status: "saving",
        message: "Uploading music to permanent storage...",
      });

      // Upload to Supabase Storage for a PERMANENT URL
      // Suno returns URLs from tempfile.aiquickdraw.com which expire
      let permanentUrl = result.audioUrl;
      try {
        const audioRes = await fetch(result.audioUrl);
        if (audioRes.ok) {
          const audioBuffer = await audioRes.arrayBuffer();
          const fileName = `music-${context.generationId}-${Date.now()}.mp3`;

          const { error: bucketError } = await db.storage.createBucket("music", {
            public: true,
            allowedMimeTypes: ["audio/mpeg", "audio/wav", "audio/mp3"],
          });
          if (bucketError && !bucketError.message.includes("already exists")) {
            console.warn("[tool:generate_music] Bucket creation warning:", bucketError.message);
          }

          const { error: uploadError } = await db.storage
            .from("music")
            .upload(fileName, audioBuffer, { contentType: "audio/mpeg", upsert: true });

          if (!uploadError) {
            const { data: publicUrlData } = db.storage.from("music").getPublicUrl(fileName);
            permanentUrl = publicUrlData.publicUrl;
            console.log("[tool:generate_music] Uploaded to Supabase Storage:", permanentUrl.slice(0, 80));
          } else {
            console.warn("[tool:generate_music] Supabase upload failed, using Suno URL:", uploadError.message);
          }
        }
      } catch (uploadErr) {
        console.warn("[tool:generate_music] Failed to re-upload music, using Suno URL:", uploadErr);
      }

      // Save to generation_assets
      const variantNum = await getNextVariantNumber(context.generationId);
      const { data: asset, error: saveError } = await db
        .from("generation_assets")
        .insert({
          generation_id: context.generationId,
          org_id: context.orgId,
          type: "audio",
          storage_path: permanentUrl,
          public_url: permanentUrl,
          metadata: {
            asset_category: "background_music",
            prompt,
            style,
            title: result.title,
            duration_seconds: result.duration,
            provider: "suno",
            instrumental: true,
          },
          variant_number: variantNum,
        })
        .select("id")
        .single();

      if (saveError) {
        console.warn("[tool:generate_music] Failed to save:", saveError.message);
      }

      emitter.send("tool_progress", {
        tool: "generate_music",
        generationId: context.generationId,
        status: "complete",
        message: "Background music generated",
      });

      const summary = [
        `Background music generated successfully`,
        `Title: "${result.title}"`,
        `Duration: ${result.duration}s`,
        `Audio URL: ${permanentUrl}`,
        "",
        "IMPORTANT: Pass this EXACT URL as background_music_url when calling compose_video:",
        permanentUrl,
      ].join("\n");

      return {
        success: true,
        content: summary,
        data: { ...result, audioUrl: permanentUrl },
        assets: [
          {
            assetId: asset?.id,
            type: "audio",
            url: permanentUrl,
            metadata: {
              asset_category: "background_music",
              title: result.title,
              duration_seconds: result.duration,
            },
          },
        ],
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`[tool:generate_music] Attempt ${attempt}/${MAX_RETRIES} failed:`, lastError);

      // Don't retry on config errors
      if (lastError.includes("SUNO_API_KEY")) break;
    }
  }

  // All retries exhausted
  let hint = "";
  if (lastError.includes("SUNO_API_KEY")) {
    hint = " Set SUNO_API_KEY in your .env file.";
  } else if (lastError.includes("timeout")) {
    hint = " Suno timed out after retries. The service may be overloaded.";
  }

  return {
    success: false,
    content: `Music generation failed after ${MAX_RETRIES} attempts: ${lastError}${hint}\n\nMusic generation is unreliable. Proceed to compose_video WITHOUT background_music_url — it's better to deliver a video without music than to keep retrying and waste time/credits. The user can add music later.`,
  };
};
