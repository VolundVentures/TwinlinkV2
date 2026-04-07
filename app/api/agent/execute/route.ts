import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createSSEStream } from "@/lib/ai/claude";
import { generateJSON } from "@/lib/ai/claude";
import { generateImage } from "@/lib/generation/fal";
import { staticAdCreativeBriefPrompt } from "@/lib/ai/prompts/ad-creative";
import { videoScriptPrompt } from "@/lib/ai/prompts/script-writer";
import { textToSpeech } from "@/lib/generation/elevenlabs";
import { VOICE_CATALOG } from "@/lib/generation/tts";
import { fullCompetitorResearch } from "@/lib/external/meta-ads";
import { deductCredits, CREDIT_COSTS, type GenerationType } from "@/lib/credits";
import type { Brand } from "@/lib/database.types";

export async function POST(request: Request) {
  let auth;
  try {
    auth = await requireAuth();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { type, brandId, language = "en", prompt: userPrompt } = body;

  const { stream, send, close } = createSSEStream();

  // Run the agent pipeline in the background
  (async () => {
    try {
      // Check credits
      const creditResult = await deductCredits(
        auth.orgId,
        type as GenerationType,
        `${type} generation`
      );

      if (!creditResult.success) {
        send("error", { message: "Not enough credits", balance: creditResult.balance });
        close();
        return;
      }

      send("credits_deducted", {
        amount: CREDIT_COSTS[type as GenerationType] ?? 0,
        balance: creditResult.balance,
      });

      // Load brand data
      let brand: Brand | null = null;
      if (brandId) {
        const { data } = await db
          .from("brands")
          .select("*")
          .eq("id", brandId)
          .eq("org_id", auth.orgId)
          .single();
        brand = data;
      }

      // Create generation record
      const { data: generation } = await db
        .from("generations")
        .insert({
          org_id: auth.orgId,
          user_id: auth.id,
          brand_id: brandId || null,
          type,
          status: "processing",
          language,
          prompt: userPrompt,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (!generation) {
        send("error", { message: "Failed to create generation" });
        close();
        return;
      }

      const generationId = generation.id;

      // Create agent session
      await db.from("agent_sessions").insert({
        generation_id: generationId,
        org_id: auth.orgId,
        user_id: auth.id,
        total_steps: 4,
        status: "active",
      });

      if (type === "static_ad" && brand) {
        await executeStaticAdPipeline(
          brand,
          userPrompt,
          language,
          generationId,
          auth.orgId,
          send
        );
      } else if (type === "ugc_video" && brand) {
        await executeUGCVideoPipeline(
          brand,
          userPrompt,
          language,
          generationId,
          auth.orgId,
          send
        );
      } else if (type === "competitor_research") {
        await executeCompetitorResearchPipeline(
          brand,
          userPrompt,
          language,
          generationId,
          auth.orgId,
          send
        );
      } else if (type === "campaign" && brand) {
        await executeCampaignPipeline(
          brand,
          userPrompt,
          language,
          generationId,
          auth.orgId,
          send
        );
      } else {
        send("step_start", {
          step: 1,
          totalSteps: 1,
          description: "Processing your request...",
        });
        send("agent_message", {
          content: `The "${type}" generation pipeline is not yet available for brand: ${brand?.name || "none selected"}. Try a different generation type such as static ads or UGC video.`,
        });
        send("step_complete", { step: 1 });
      }

      // Mark generation complete
      await db
        .from("generations")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", generationId);

      send("generation_complete", { generationId });
    } catch (error) {
      console.error("Agent execution error:", error);
      send("error", {
        message: error instanceof Error ? error.message : "Agent execution failed",
      });
    } finally {
      close();
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function executeStaticAdPipeline(
  brand: Brand,
  userPrompt: string,
  language: string,
  generationId: string,
  orgId: string,
  send: (event: string, data: unknown) => void
) {
  // Step 1: Understand brand context
  send("step_start", {
    step: 1,
    totalSteps: 4,
    description: "Analyzing your brand...",
  });
  send("agent_message", {
    content: `Analyzing ${brand.name}... Found ${brand.products?.length || 0} products, brand voice: ${brand.brand_voice || "professional"}.`,
  });
  send("step_complete", { step: 1 });

  // Step 2: Generate creative brief
  send("step_start", {
    step: 2,
    totalSteps: 4,
    description: "Generating creative strategy...",
  });

  const briefPrompt = staticAdCreativeBriefPrompt(brand, userPrompt, language);

  let creativeBrief: {
    campaign_theme: string;
    variants: Array<{
      variant_number: number;
      concept: string;
      headline: string;
      body: string;
      cta: string;
      visual_direction: string;
      image_prompt: string;
      rationale: string;
      aspect_ratios: string[];
    }>;
  };

  try {
    creativeBrief = await generateJSON({
      model: "claude-sonnet-4-6",
      maxTokens: 16384,
      system: "You are an elite creative director. Return valid JSON only.",
      messages: [{ role: "user", content: briefPrompt }],
    });
  } catch (briefError) {
    const errMsg = briefError instanceof Error ? briefError.message : String(briefError);
    console.error("[agent] Creative brief generation failed:", errMsg);
    send("agent_message", { content: `Creative strategy failed: ${errMsg}` });
    send("error", { message: `Creative brief error: ${errMsg}` });
    close();
    return;
  }

  send("agent_message", {
    content: `Creative brief ready: "${creativeBrief.campaign_theme}" — ${creativeBrief.variants.length} variants across ${new Set(creativeBrief.variants.map((v) => v.concept)).size} concepts.`,
  });

  // Save creative brief to generation
  await db
    .from("generations")
    .update({
      creative_brief: creativeBrief,
      status: "generating",
      title: creativeBrief.campaign_theme,
    })
    .eq("id", generationId);

  send("step_complete", { step: 2 });

  // Step 3: Generate images
  send("step_start", {
    step: 3,
    totalSteps: 4,
    description: `Generating ${creativeBrief.variants.length} ad variations...`,
  });

  // Generate images sequentially to avoid rate limits
  let successCount = 0;
  let failedCount = 0;

  for (let index = 0; index < creativeBrief.variants.length; index++) {
    const variant = creativeBrief.variants[index];
    send("step_progress", {
      step: 3,
      message: `Generating variant ${index + 1}/${creativeBrief.variants.length}: "${variant.concept}"...`,
    });

    try {
      const imageUrl = await generateImage(variant.image_prompt, {
        aspectRatio: "1:1",
        resolution: "1K",
      });

      // Save asset
      const { data: asset, error: assetError } = await db
        .from("generation_assets")
        .insert({
          generation_id: generationId,
          org_id: orgId,
          type: "image",
          aspect_ratio: "1:1",
          storage_path: imageUrl,
          public_url: imageUrl,
          metadata: {
            headline: variant.headline,
            body: variant.body,
            cta: variant.cta,
            concept: variant.concept,
          },
          creative_rationale: variant.rationale,
          variant_number: variant.variant_number,
        })
        .select("id")
        .single();

      if (assetError) {
        console.error(`[agent] Asset save error for variant ${variant.variant_number}:`, assetError.message);
      }

      send("asset_ready", {
        assetId: asset?.id,
        url: imageUrl,
        variant: variant.variant_number,
        metadata: {
          headline: variant.headline,
          body: variant.body,
          cta: variant.cta,
          concept: variant.concept,
        },
        rationale: variant.rationale,
      });

      successCount++;
    } catch (imgError) {
      const errMsg = imgError instanceof Error ? imgError.message : String(imgError);
      console.error(`[agent] Image generation failed for variant ${variant.variant_number}:`, errMsg);
      send("agent_message", {
        content: `⚠ Variant ${variant.variant_number} ("${variant.concept}") failed: ${errMsg}`,
      });
      failedCount++;
    }
  }

  if (successCount > 0) {
    send("agent_message", {
      content: `Generated ${successCount}/${creativeBrief.variants.length} ad creatives successfully.${failedCount > 0 ? ` ${failedCount} variant(s) failed — see errors above.` : ""}`,
    });
  } else {
    send("agent_message", {
      content: `All ${creativeBrief.variants.length} image generations failed. Check your Replicate API token and try again.`,
    });
  }
  send("step_complete", { step: 3 });

  // Step 4: Review
  send("step_start", {
    step: 4,
    totalSteps: 4,
    description: "Finalizing your creatives...",
  });
  send("agent_message", {
    content:
      "Your ad creatives are ready! You can preview them in different formats, download individually, or save to your library. Chat with me to refine any variant.",
  });
  send("step_complete", { step: 4 });
}

// ============================================
// UGC Video Pipeline
// ============================================

type VideoScript = {
  title: string;
  duration_seconds: number;
  hook_type: string;
  sections: Array<{
    label: string;
    start_time: number;
    end_time: number;
    text: string;
    emotion: string;
    direction: string;
  }>;
  full_script: string;
  visual_notes: string;
};

async function executeUGCVideoPipeline(
  brand: Brand,
  userPrompt: string,
  language: string,
  generationId: string,
  orgId: string,
  send: (event: string, data: unknown) => void
) {
  const totalSteps = 4;

  // Step 1: Script Generation
  send("step_start", {
    step: 1,
    totalSteps,
    description: "Writing UGC video script...",
  });

  send("agent_message", {
    content: `Analyzing ${brand.name} to craft a 30-second UGC-style video script. Brand voice: ${brand.brand_voice || "professional"}, target audience: ${brand.target_audience || "general"}.`,
  });

  let script: VideoScript;

  try {
    const scriptPrompt = videoScriptPrompt(brand, userPrompt, language, 30);
    script = await generateJSON<VideoScript>({
      model: "claude-sonnet-4-6",
      maxTokens: 8192,
      system: "You are an expert UGC ad scriptwriter. Return valid JSON only.",
      messages: [{ role: "user", content: scriptPrompt }],
    });
  } catch (scriptError) {
    const errMsg = scriptError instanceof Error ? scriptError.message : String(scriptError);
    console.error("[agent] Script generation failed:", errMsg);
    send("agent_message", { content: `Script generation failed: ${errMsg}` });
    send("error", { message: `Script generation error: ${errMsg}` });
    return;
  }

  send("agent_message", {
    content: `Script ready: "${script.title}" — ${script.sections.length} sections, ${script.duration_seconds}s duration, hook type: ${script.hook_type}.`,
  });

  // Save script to generation record
  await db
    .from("generations")
    .update({
      creative_brief: script as unknown as Record<string, unknown>,
      status: "generating",
      title: script.title,
    })
    .eq("id", generationId);

  // Save script as a generation asset
  const { data: scriptAsset } = await db
    .from("generation_assets")
    .insert({
      generation_id: generationId,
      org_id: orgId,
      type: "script" as const,
      storage_path: `scripts/${generationId}/script.json`,
      metadata: {
        title: script.title,
        duration_seconds: script.duration_seconds,
        hook_type: script.hook_type,
        sections: script.sections,
        full_script: script.full_script,
        visual_notes: script.visual_notes,
      },
      variant_number: 1,
    })
    .select("id")
    .single();

  send("asset_ready", {
    assetId: scriptAsset?.id,
    type: "script",
    metadata: {
      title: script.title,
      duration_seconds: script.duration_seconds,
      sections: script.sections,
      full_script: script.full_script,
    },
  });

  send("step_complete", { step: 1 });

  // Step 2: Voice Generation (ElevenLabs)
  send("step_start", {
    step: 2,
    totalSteps,
    description: "Generating voiceover with ElevenLabs...",
  });

  // Pick voice based on language
  const voiceId =
    language === "ar"
      ? VOICE_CATALOG.camille.id
      : "EXAVITQu4vr4xnSDxMaL"; // Default English voice (Rachel)

  send("step_progress", {
    step: 2,
    message: `Using ${language === "ar" ? "Arabic" : "English"} voice for script narration...`,
  });

  let audioDataUri: string | null = null;

  try {
    const audioBuffer = await textToSpeech(script.full_script, voiceId, {
      model: "eleven_multilingual_v2",
      stability: 0.5,
      similarityBoost: 0.75,
    });

    // Convert ArrayBuffer to base64 data URI for storage
    const uint8Array = new Uint8Array(audioBuffer);
    let binaryString = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binaryString);
    audioDataUri = `data:audio/mpeg;base64,${base64}`;

    // Save audio as a generation asset
    const { data: audioAsset } = await db
      .from("generation_assets")
      .insert({
        generation_id: generationId,
        org_id: orgId,
        type: "audio" as const,
        storage_path: `audio/${generationId}/voiceover.mp3`,
        public_url: audioDataUri,
        duration_seconds: script.duration_seconds,
        metadata: {
          voice_id: voiceId,
          language,
          script_length: script.full_script.length,
        },
        variant_number: 1,
      })
      .select("id")
      .single();

    send("asset_ready", {
      assetId: audioAsset?.id,
      type: "audio",
      url: audioDataUri,
      metadata: {
        voice_id: voiceId,
        language,
        duration_seconds: script.duration_seconds,
      },
    });

    send("agent_message", {
      content: `Voiceover generated successfully (${script.duration_seconds}s, ${language === "ar" ? "Arabic" : "English"} voice).`,
    });
  } catch (audioError) {
    const errMsg = audioError instanceof Error ? audioError.message : String(audioError);
    console.error("[agent] Voice generation failed:", errMsg);
    send("agent_message", {
      content: `Voiceover generation failed: ${errMsg}. Continuing without audio.`,
    });
  }

  send("step_complete", { step: 2 });

  // Step 3: Character Image Generation
  send("step_start", {
    step: 3,
    totalSteps,
    description: "Generating character visual...",
  });

  send("step_progress", {
    step: 3,
    message: "Creating character/avatar image based on script visual direction...",
  });

  const characterPrompt = `UGC-style content creator portrait for a video ad. ${script.visual_notes}. Brand: ${brand.name}, industry: ${brand.industry || "lifestyle"}. Natural lighting, authentic feel, shot on iPhone aesthetic. The person should look relatable and trustworthy. No text or logos in the image.`;

  try {
    const characterImageUrl = await generateImage(characterPrompt, {
      aspectRatio: "9:16",
      resolution: "1K",
    });

    // Save character image as generation asset
    const { data: imageAsset } = await db
      .from("generation_assets")
      .insert({
        generation_id: generationId,
        org_id: orgId,
        type: "thumbnail" as const,
        aspect_ratio: "9:16",
        storage_path: characterImageUrl,
        public_url: characterImageUrl,
        metadata: {
          purpose: "character_visual",
          visual_notes: script.visual_notes,
          prompt: characterPrompt,
        },
        variant_number: 1,
      })
      .select("id")
      .single();

    send("asset_ready", {
      assetId: imageAsset?.id,
      type: "thumbnail",
      url: characterImageUrl,
      metadata: {
        purpose: "character_visual",
        visual_notes: script.visual_notes,
      },
    });

    send("agent_message", {
      content: "Character visual generated. This serves as the video thumbnail and reference for the UGC creator.",
    });
  } catch (imgError) {
    const errMsg = imgError instanceof Error ? imgError.message : String(imgError);
    console.error("[agent] Character image generation failed:", errMsg);
    send("agent_message", {
      content: `Character image generation failed: ${errMsg}. The script and voiceover are still available.`,
    });
  }

  send("step_complete", { step: 3 });

  // Step 4: Finalization
  send("step_start", {
    step: 4,
    totalSteps,
    description: "Finalizing your UGC video package...",
  });

  const summary = [
    `Your UGC video ad package for "${script.title}" is ready!`,
    `- Script: ${script.sections.length} sections, ${script.duration_seconds}s`,
    audioDataUri ? "- Voiceover: Generated successfully" : "- Voiceover: Skipped (generation failed)",
    "- Character visual: Available as thumbnail",
    "",
    "You can download the script, preview the voiceover, and use the character visual as a reference for production.",
  ].join("\n");

  send("agent_message", { content: summary });
  send("step_complete", { step: 4 });
}

// ============================================
// Competitor Research Pipeline
// ============================================

async function executeCompetitorResearchPipeline(
  brand: Brand | null,
  userPrompt: string,
  language: string,
  generationId: string,
  orgId: string,
  send: (event: string, data: unknown) => void
) {
  const totalSteps = 3;

  // Step 1: Identify competitor
  send("step_start", {
    step: 1,
    totalSteps,
    description: "Identifying competitor...",
  });

  // Extract competitor name: use the userPrompt if it seems like a name, otherwise fall back to brand name
  const competitorName = userPrompt?.trim() || brand?.name || "Unknown";
  const industry = brand?.industry || "general";

  send("agent_message", {
    content: `Researching competitor: "${competitorName}" in the ${industry} industry. Scanning Meta Ad Library, Google Ads Transparency Center, and running AI analysis...`,
  });

  send("step_complete", { step: 1 });

  // Step 2: Run full competitor research
  send("step_start", {
    step: 2,
    totalSteps,
    description: "Analyzing competitor ads and strategy...",
  });

  send("step_progress", {
    step: 2,
    message: "Scraping public ad libraries and running Claude intelligence analysis...",
  });

  let analysis;

  try {
    analysis = await fullCompetitorResearch(competitorName, industry);
  } catch (researchError) {
    const errMsg = researchError instanceof Error ? researchError.message : String(researchError);
    console.error("[agent] Competitor research failed:", errMsg);
    send("agent_message", { content: `Competitor research failed: ${errMsg}` });
    send("error", { message: `Research error: ${errMsg}` });
    return;
  }

  // Send detailed results as agent messages
  send("agent_message", {
    content: `Found ${analysis.ad_count} ads for "${analysis.competitor_name}". Strategy score: ${analysis.score}/100.`,
  });

  if (analysis.insights.messaging_themes.length > 0) {
    send("agent_message", {
      content: `Messaging themes: ${analysis.insights.messaging_themes.join(", ")}`,
    });
  }

  if (analysis.insights.visual_patterns.length > 0) {
    send("agent_message", {
      content: `Visual patterns: ${analysis.insights.visual_patterns.join(", ")}`,
    });
  }

  if (analysis.insights.cta_patterns.length > 0) {
    send("agent_message", {
      content: `CTA patterns: ${analysis.insights.cta_patterns.join(", ")}`,
    });
  }

  if (analysis.insights.strengths.length > 0) {
    send("agent_message", {
      content: `Strengths: ${analysis.insights.strengths.join("; ")}`,
    });
  }

  if (analysis.insights.weaknesses.length > 0) {
    send("agent_message", {
      content: `Weaknesses/Opportunities: ${analysis.insights.weaknesses.join("; ")}`,
    });
  }

  send("step_complete", { step: 2 });

  // Step 3: Save results and finalize
  send("step_start", {
    step: 3,
    totalSteps,
    description: "Saving research results...",
  });

  // Save analysis to generation record
  await db
    .from("generations")
    .update({
      creative_brief: analysis as unknown as Record<string, unknown>,
      title: `Competitor Research: ${analysis.competitor_name}`,
    })
    .eq("id", generationId);

  // Save competitor profile to competitor_profiles table
  try {
    const { data: existingProfile } = await db
      .from("competitor_profiles")
      .select("id")
      .eq("org_id", orgId)
      .eq("name", analysis.competitor_name)
      .single();

    if (existingProfile) {
      // Update existing profile
      await db
        .from("competitor_profiles")
        .update({
          industry: analysis.industry,
          analysis: analysis.insights as unknown as Record<string, unknown>,
          ad_count: analysis.ad_count,
          avg_score: analysis.score,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProfile.id);
    } else {
      // Insert new profile
      await db.from("competitor_profiles").insert({
        org_id: orgId,
        name: analysis.competitor_name,
        industry: analysis.industry,
        analysis: analysis.insights as unknown as Record<string, unknown>,
        ad_count: analysis.ad_count,
        avg_score: analysis.score,
      });
    }
  } catch (dbError) {
    console.error("[agent] Failed to save competitor profile:", dbError);
  }

  // Save individual ads to competitor_ads if we have a profile
  if (analysis.ads.length > 0) {
    try {
      const { data: profile } = await db
        .from("competitor_profiles")
        .select("id")
        .eq("org_id", orgId)
        .eq("name", analysis.competitor_name)
        .single();

      if (profile) {
        const adRows = analysis.ads.slice(0, 20).map((ad) => ({
          competitor_id: profile.id,
          org_id: orgId,
          ad_type: ad.media_type || "unknown",
          body_text: ad.ad_text,
          headline: ad.headline || null,
          cta: ad.cta || null,
          creative_url: ad.snapshot_url || null,
          started_running: ad.started_running || null,
          analysis: { platform: ad.platform, page_name: ad.page_name },
        }));

        await db.from("competitor_ads").insert(adRows);
      }
    } catch (adSaveError) {
      console.error("[agent] Failed to save competitor ads:", adSaveError);
    }
  }

  send("agent_message", {
    content: `Research complete! Analysis saved to your competitor library. Use these insights to craft better-performing ads that exploit their weaknesses.`,
  });

  send("step_complete", { step: 3 });
}

// ============================================
// Campaign Pipeline (combines static ad + script)
// ============================================

async function executeCampaignPipeline(
  brand: Brand,
  userPrompt: string,
  language: string,
  generationId: string,
  orgId: string,
  send: (event: string, data: unknown) => void
) {
  const totalSteps = 6;

  // Step 1: Analyze brand
  send("step_start", {
    step: 1,
    totalSteps,
    description: "Analyzing brand for full campaign...",
  });

  send("agent_message", {
    content: `Building a full campaign package for ${brand.name}. This includes static ad creatives and a UGC video script with voiceover.`,
  });

  send("step_complete", { step: 1 });

  // Step 2: Generate static ad creative brief
  send("step_start", {
    step: 2,
    totalSteps,
    description: "Generating static ad creative brief...",
  });

  const briefPrompt = staticAdCreativeBriefPrompt(brand, userPrompt, language);

  let creativeBrief: {
    campaign_theme: string;
    variants: Array<{
      variant_number: number;
      concept: string;
      headline: string;
      body: string;
      cta: string;
      visual_direction: string;
      image_prompt: string;
      rationale: string;
      aspect_ratios: string[];
    }>;
  };

  try {
    creativeBrief = await generateJSON({
      model: "claude-sonnet-4-6",
      maxTokens: 16384,
      system: "You are an elite creative director. Return valid JSON only.",
      messages: [{ role: "user", content: briefPrompt }],
    });
  } catch (briefError) {
    const errMsg = briefError instanceof Error ? briefError.message : String(briefError);
    console.error("[agent] Campaign creative brief failed:", errMsg);
    send("agent_message", { content: `Creative brief generation failed: ${errMsg}` });
    send("error", { message: `Creative brief error: ${errMsg}` });
    return;
  }

  send("agent_message", {
    content: `Creative brief ready: "${creativeBrief.campaign_theme}" — ${creativeBrief.variants.length} static ad variants.`,
  });

  // Save creative brief to generation
  await db
    .from("generations")
    .update({
      creative_brief: creativeBrief,
      status: "generating",
      title: `Campaign: ${creativeBrief.campaign_theme}`,
    })
    .eq("id", generationId);

  send("step_complete", { step: 2 });

  // Step 3: Generate static ad images
  send("step_start", {
    step: 3,
    totalSteps,
    description: `Generating ${creativeBrief.variants.length} static ad creatives...`,
  });

  let staticSuccessCount = 0;
  let staticFailedCount = 0;

  for (let index = 0; index < creativeBrief.variants.length; index++) {
    const variant = creativeBrief.variants[index];
    send("step_progress", {
      step: 3,
      message: `Generating static ad ${index + 1}/${creativeBrief.variants.length}: "${variant.concept}"...`,
    });

    try {
      const imageUrl = await generateImage(variant.image_prompt, {
        aspectRatio: "1:1",
        resolution: "1K",
      });

      const { data: asset } = await db
        .from("generation_assets")
        .insert({
          generation_id: generationId,
          org_id: orgId,
          type: "image",
          aspect_ratio: "1:1",
          storage_path: imageUrl,
          public_url: imageUrl,
          metadata: {
            headline: variant.headline,
            body: variant.body,
            cta: variant.cta,
            concept: variant.concept,
            campaign_component: "static_ad",
          },
          creative_rationale: variant.rationale,
          variant_number: variant.variant_number,
        })
        .select("id")
        .single();

      send("asset_ready", {
        assetId: asset?.id,
        url: imageUrl,
        variant: variant.variant_number,
        type: "image",
        metadata: {
          headline: variant.headline,
          body: variant.body,
          cta: variant.cta,
          concept: variant.concept,
        },
        rationale: variant.rationale,
      });

      staticSuccessCount++;
    } catch (imgError) {
      const errMsg = imgError instanceof Error ? imgError.message : String(imgError);
      console.error(`[agent] Campaign image failed for variant ${variant.variant_number}:`, errMsg);
      send("agent_message", {
        content: `Static ad variant ${variant.variant_number} ("${variant.concept}") failed: ${errMsg}`,
      });
      staticFailedCount++;
    }
  }

  send("agent_message", {
    content: `Static ads: ${staticSuccessCount}/${creativeBrief.variants.length} generated.${staticFailedCount > 0 ? ` ${staticFailedCount} failed.` : ""}`,
  });

  send("step_complete", { step: 3 });

  // Step 4: Generate UGC video script
  send("step_start", {
    step: 4,
    totalSteps,
    description: "Writing UGC video script...",
  });

  let script: VideoScript;

  try {
    const scriptPrompt = videoScriptPrompt(brand, userPrompt, language, 30);
    script = await generateJSON<VideoScript>({
      model: "claude-sonnet-4-6",
      maxTokens: 8192,
      system: "You are an expert UGC ad scriptwriter. Return valid JSON only.",
      messages: [{ role: "user", content: scriptPrompt }],
    });
  } catch (scriptError) {
    const errMsg = scriptError instanceof Error ? scriptError.message : String(scriptError);
    console.error("[agent] Campaign script generation failed:", errMsg);
    send("agent_message", { content: `Script generation failed: ${errMsg}. Campaign will continue without video script.` });
    send("step_complete", { step: 4 });

    // Skip to finalization
    send("step_start", { step: 5, totalSteps, description: "Skipping voiceover..." });
    send("step_complete", { step: 5 });
    send("step_start", { step: 6, totalSteps, description: "Finalizing campaign..." });
    send("agent_message", {
      content: `Campaign partially complete with ${staticSuccessCount} static ads. Video script generation failed.`,
    });
    send("step_complete", { step: 6 });
    return;
  }

  send("agent_message", {
    content: `Video script ready: "${script.title}" — ${script.sections.length} sections, ${script.duration_seconds}s.`,
  });

  // Save script as asset
  const { data: scriptAsset } = await db
    .from("generation_assets")
    .insert({
      generation_id: generationId,
      org_id: orgId,
      type: "script" as const,
      storage_path: `scripts/${generationId}/campaign-script.json`,
      metadata: {
        title: script.title,
        duration_seconds: script.duration_seconds,
        hook_type: script.hook_type,
        sections: script.sections,
        full_script: script.full_script,
        visual_notes: script.visual_notes,
        campaign_component: "ugc_video",
      },
      variant_number: 1,
    })
    .select("id")
    .single();

  send("asset_ready", {
    assetId: scriptAsset?.id,
    type: "script",
    metadata: {
      title: script.title,
      duration_seconds: script.duration_seconds,
      sections: script.sections,
      full_script: script.full_script,
    },
  });

  send("step_complete", { step: 4 });

  // Step 5: Generate voiceover for the video script
  send("step_start", {
    step: 5,
    totalSteps,
    description: "Generating voiceover...",
  });

  const voiceId =
    language === "ar"
      ? VOICE_CATALOG.camille.id
      : "EXAVITQu4vr4xnSDxMaL";

  let audioGenerated = false;

  try {
    const audioBuffer = await textToSpeech(script.full_script, voiceId, {
      model: "eleven_multilingual_v2",
      stability: 0.5,
      similarityBoost: 0.75,
    });

    const uint8Array = new Uint8Array(audioBuffer);
    let binaryString = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binaryString);
    const audioDataUri = `data:audio/mpeg;base64,${base64}`;

    const { data: audioAsset } = await db
      .from("generation_assets")
      .insert({
        generation_id: generationId,
        org_id: orgId,
        type: "audio" as const,
        storage_path: `audio/${generationId}/campaign-voiceover.mp3`,
        public_url: audioDataUri,
        duration_seconds: script.duration_seconds,
        metadata: {
          voice_id: voiceId,
          language,
          script_length: script.full_script.length,
          campaign_component: "ugc_video",
        },
        variant_number: 1,
      })
      .select("id")
      .single();

    send("asset_ready", {
      assetId: audioAsset?.id,
      type: "audio",
      url: audioDataUri,
      metadata: {
        voice_id: voiceId,
        language,
        duration_seconds: script.duration_seconds,
      },
    });

    send("agent_message", {
      content: `Voiceover generated (${script.duration_seconds}s, ${language === "ar" ? "Arabic" : "English"}).`,
    });

    audioGenerated = true;
  } catch (audioError) {
    const errMsg = audioError instanceof Error ? audioError.message : String(audioError);
    console.error("[agent] Campaign voiceover failed:", errMsg);
    send("agent_message", {
      content: `Voiceover generation failed: ${errMsg}. Campaign will proceed without audio.`,
    });
  }

  send("step_complete", { step: 5 });

  // Step 6: Campaign summary / finalization
  send("step_start", {
    step: 6,
    totalSteps,
    description: "Finalizing campaign package...",
  });

  const campaignSummary = [
    `Full campaign package for "${creativeBrief.campaign_theme}" is ready!`,
    "",
    `Static Ads:`,
    `- ${staticSuccessCount} creatives generated across ${new Set(creativeBrief.variants.map((v) => v.concept)).size} concepts`,
    staticFailedCount > 0 ? `- ${staticFailedCount} variant(s) failed` : "",
    "",
    `UGC Video:`,
    `- Script: "${script.title}" (${script.duration_seconds}s, ${script.sections.length} sections)`,
    audioGenerated ? `- Voiceover: Ready` : `- Voiceover: Not available`,
    "",
    "You can preview all assets, download them, or refine individual pieces by chatting with me.",
  ]
    .filter(Boolean)
    .join("\n");

  send("agent_message", { content: campaignSummary });
  send("step_complete", { step: 6 });
}
