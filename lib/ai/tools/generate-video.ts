import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber } from "./types";
import {
  generateUGCVideo,
  generateBRoll,
  animateStaticAd,
  generateSoraI2V,
  generateSoraRemix,
  generateVeo31,
  generateKlingStandard,
  generateVeoReferenceToVideo,
  generateVeoFirstLastFrame,
  generateKlingMultiShot,
  generateSeedanceI2V,
  generateSeedanceRef,
  type BRollElement,
  type KlingMultiShotPrompt,
} from "@/lib/generation/fal-video";
import { db } from "@/lib/db";

export const generateVideoDefinition: ToolDefinition = {
  name: "generate_video",
  description:
    "Generate a video clip from a keyframe image. ALWAYS generate an image FIRST, then animate it.\n\n**Model Selection:**\n- PRODUCTS: 'seedance_i2v' (PRIMARY — timestamped camera control, 4-15s, FLF chaining via source_image_url + last_frame_url). Rejects faces.\n- PRODUCT FALLBACK: 'kling_flf' (one simple camera move, 5-15s). 'broll' (quick product detail, 3-5s).\n- PEOPLE/UGC: 'veo_flf' (person transitions, 4-8s, FLF chain), 'veo_ugc' (talking scene WITH audio for lipsync), 'veo_ref' (character consistency via reference images).\n- SPEED: 'kling_multi' (3-5 shots in one call, 3-15s total).\n\n**Prompt Craft:**\nThe prompt describes MOTION and TRANSFORMATION — not appearance. The keyframe image handles looks; the prompt handles movement.\n- Seedance: Use timestamped multi-phase prompts (camera simulation header + phases with speed %, camera move, visual changes)\n- Kling: ONE camera move, 2-3 sentences, NO timestamps\n- Veo UGC: Describe ACTIONS ('she leans forward, hands resting on desk') not dialogue. Keep hands below shoulders for lipsync.\n\n**B-roll in UGC: generate_audio must be FALSE.** B-roll clips should be silent — only music plays during B-roll.\n\n**FLF Chaining:** Generate keyframe images A→B→C, then: clip1(A→B) + clip2(B→C). Each clip interpolates between its pair.\n\nCosts 15 credits.",
  input_schema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["veo_ref", "veo_flf", "veo_ugc", "kling_flf", "kling_multi", "seedance_i2v", "seedance_ref", "ugc", "sora_i2v", "sora_remix", "broll", "broll_fast", "animate", "veo", "veo_fast"],
        description:
          "Generation mode. PRODUCT/COMMERCIAL (PRIMARY): 'seedance_i2v' (Seedance 2.0 I2V with FLF support — 5/10/15s, timestamped camera control, BEST for product hero. Pass source_image_url + last_frame_url for FLF chaining. PRODUCTS ONLY — rejects human faces), 'seedance_ref' (Seedance 2.0 reference-to-video, PRODUCTS ONLY). PRODUCT FALLBACK: 'kling_flf' (Kling first-last-frame, 5-15s, simple one-move prompts), 'kling_multi' (multi-shot in one call), 'broll' (Kling I2V product B-roll). UGC/PEOPLE: 'veo_ref' (Veo reference-to-video, character consistency), 'veo_flf' (Veo first-last-frame, 4-8s, UGC transitions with audio), 'veo_ugc' (Veo with dialogue for lip-sync).",
      },
      prompt: {
        type: "string",
        description:
          "Detailed prompt describing the desired video. For 'animate' mode, describes the motion effect (optional, defaults to subtle zoom + parallax).",
      },
      source_image_url: {
        type: "string",
        description:
          "URL of a source image. Required for 'animate' mode. Optional for 'broll' mode (enables image-to-video).",
      },
      duration: {
        type: "string",
        description:
          "Video duration. UGC: '4'|'8'|'12'|'16'|'20' seconds. B-roll: '3'-'15' seconds. Animate: '3'-'15' seconds (default '5').",
      },
      aspect_ratio: {
        type: "string",
        enum: ["16:9", "9:16", "1:1"],
        description:
          "Video aspect ratio. UGC supports 16:9 and 9:16. B-roll supports all three. (default '9:16')",
      },
      elements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            image_url: {
              type: "string",
              description: "URL of a reference image for character consistency.",
            },
            description: {
              type: "string",
              description: "Description of the element.",
            },
          },
          required: ["image_url", "description"],
        },
        description:
          "Elements for character/product consistency in B-roll mode (Kling v3 Pro). When generating B-roll for a product, include the product image as an element to maintain visual accuracy. If source_image_url is provided and elements is empty, an element is auto-created.",
      },
      negative_prompt: {
        type: "string",
        description:
          "Negative prompt. Describes what to avoid. Auto-filled with sensible defaults.",
      },
      reference_image_urls: {
        type: "array",
        items: { type: "string" },
        description:
          "For 'veo_ref' mode: 1-3 reference images to preserve character/product identity across shots. Pass character sheet images or product photos.",
      },
      first_frame_url: {
        type: "string",
        description:
          "For 'veo_flf' mode: URL of the first frame image. The video starts from this exact image.",
      },
      last_frame_url: {
        type: "string",
        description:
          "For 'veo_flf' mode: URL of the last frame image. The video transitions TO this image. Also works with 'broll' mode (Kling end_image_url).",
      },
      generate_audio: {
        type: "boolean",
        description:
          "Whether to generate native audio (ambient sounds, SFX) for this clip. TRUE for scenes with action/movement/environment (car driving, rain, crowds). FALSE for quiet scenes where voiceover is primary. Default: true for veo modes, false for kling modes.",
      },
      shots: {
        type: "array",
        items: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Prompt for this shot. Reference characters as @Element1, @Element2." },
            duration: { type: "string", description: "Duration for this shot: '3' to '5' seconds. Keep shots SHORT (3-5s) for dynamic pacing." },
          },
          required: ["prompt"],
        },
        description:
          "For 'kling_multi' mode: array of shot prompts. Each shot gets its own prompt and duration. Total max 15s. Use 3-5s per shot for dynamic ad pacing.",
      },
    },
    required: ["mode", "prompt"],
  },
};

export const generateVideoTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const mode = input.mode as "veo_ref" | "veo_flf" | "veo_ugc" | "kling_flf" | "kling_multi" | "seedance_i2v" | "seedance_ref" | "ugc" | "sora_i2v" | "sora_remix" | "broll" | "broll_fast" | "animate" | "veo" | "veo_fast";
  const prompt = input.prompt as string;
  const sourceImageUrl = (input.source_image_url as string) || undefined;
  const duration = (input.duration as string) || undefined;
  const aspectRatio = (input.aspect_ratio as string) || "9:16";
  const elements = (input.elements as Array<{ image_url: string; description: string }>) || undefined;
  // ALWAYS include negative prompt for quality — agent can add more on top
  const DEFAULT_NEGATIVE = "motion blur, face distortion, warping, morphing, temporal flickering, jitter, text rendering, watermark, inconsistent physics, floating objects, unnatural movements, extra limbs, background shifting";
  const userNegative = (input.negative_prompt as string) || "";
  const negativePrompt = userNegative ? `${DEFAULT_NEGATIVE}, ${userNegative}` : DEFAULT_NEGATIVE;
  const referenceImageUrls = (input.reference_image_urls as string[]) || undefined;
  const firstFrameUrl = (input.first_frame_url as string) || undefined;
  const lastFrameUrl = (input.last_frame_url as string) || undefined;
  const shots = (input.shots as KlingMultiShotPrompt[]) || undefined;

  console.log(
    "[tool:generate_video] Mode:",
    mode,
    "duration:",
    duration,
    "aspect:",
    aspectRatio
  );

  // Validate mode-specific inputs
  if (mode === "animate" && !sourceImageUrl) {
    return {
      success: false,
      content: "'animate' mode requires a source_image_url.",
    };
  }

  try {
    let videoUrl: string;
    let modelUsed: string;

    switch (mode) {
      case "veo_ref": {
        if (!referenceImageUrls || referenceImageUrls.length === 0) {
          return { success: false, content: "'veo_ref' mode requires reference_image_urls (1-3 images for character/product consistency)." };
        }
        emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: `Generating with Veo 3.1 Reference-to-Video (${referenceImageUrls.length} refs)...` });
        videoUrl = await generateVeoReferenceToVideo({
          prompt,
          referenceImageUrls,
          duration: parseInt(duration || "6") || 6,
          aspectRatio: (aspectRatio as "16:9" | "9:16") || "9:16",
          generateAudio: true,
          negativePrompt: negativePrompt || "morphing, distortion, different person, different clothing, waxy skin, plastic look",
          generationId: context.generationId,
          onProgress: (msg) => { emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: msg }); },
        });
        modelUsed = "veo-3.1-ref";
        break;
      }

      case "veo_flf": {
        if (!firstFrameUrl || !lastFrameUrl) {
          return { success: false, content: "'veo_flf' mode requires both first_frame_url and last_frame_url. Generate keyframe images FIRST with generate_image, then use image URLs as first_frame_url and last_frame_url." };
        }
        const flfAudio = input.generate_audio !== undefined ? input.generate_audio === true : true;
        emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: "Generating transition with Veo 3.1 First-Last-Frame..." });
        videoUrl = await generateVeoFirstLastFrame({
          prompt,
          firstFrameUrl,
          lastFrameUrl,
          duration: parseInt(duration || "8") || 8,
          aspectRatio: (aspectRatio as "16:9" | "9:16") || "9:16",
          generateAudio: flfAudio,
          fast: false,
          negativePrompt,
          generationId: context.generationId,
          onProgress: (msg) => { emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: msg }); },
        });
        modelUsed = "veo-3.1-flf";
        break;
      }

      case "kling_flf": {
        if (!firstFrameUrl || !lastFrameUrl) {
          return { success: false, content: "'kling_flf' mode requires both first_frame_url (start image) and last_frame_url (end image). Generate keyframe images FIRST." };
        }
        const klingFlfAudio = input.generate_audio === true;
        emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: "Generating Kling first-last-frame transition..." });
        videoUrl = await generateBRoll({
          prompt,
          imageUrl: firstFrameUrl,
          endImageUrl: lastFrameUrl,
          duration: parseInt(duration || "5") || 5,
          aspectRatio: (aspectRatio as "16:9" | "9:16" | "1:1") || "9:16",
          negativePrompt,
          elements,
          enableAudio: klingFlfAudio,
          generationId: context.generationId,
          onProgress: (msg) => { emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: msg }); },
        });
        modelUsed = "kling-v3-flf";
        break;
      }

      case "kling_multi": {
        if (!shots || shots.length === 0) {
          return { success: false, content: "'kling_multi' mode requires shots array with at least one shot prompt." };
        }
        emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: `Generating ${shots.length}-shot video with Kling v3 Pro Multi-Shot...` });
        videoUrl = await generateKlingMultiShot({
          shots,
          startImageUrl: sourceImageUrl || firstFrameUrl,
          endImageUrl: lastFrameUrl,
          elements,
          aspectRatio: (aspectRatio as "16:9" | "9:16" | "1:1") || "9:16",
          negativePrompt,
          generateAudio: false,
          generationId: context.generationId,
          onProgress: (msg) => { emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: msg }); },
        });
        modelUsed = "kling-v3-multi-shot";
        break;
      }

      case "ugc": {
        emitter.send("tool_progress", {
          tool: "generate_video", generationId: context.generationId, status: "generating",
          message: "Generating UGC video with Sora 2...",
        });

        videoUrl = await generateUGCVideo({
          prompt,
          duration: (parseInt(duration || "8") || 8) as 4 | 8 | 12 | 16 | 20,
          aspectRatio: (aspectRatio as "16:9" | "9:16") || "9:16",
          generationId: context.generationId,
          onProgress: (msg) => {
            emitter.send("tool_progress", {
              tool: "generate_video", generationId: context.generationId, status: "generating",
              message: msg,
            });
          },
        });
        modelUsed = "sora-2";
        break;
      }

      case "broll": {
        emitter.send("tool_progress", {
          tool: "generate_video", generationId: context.generationId, status: "generating",
          message: `Generating B-roll with Kling v3 Pro (${sourceImageUrl ? "I2V" : "T2V"})...`,
        });

        // Auto-create element from source_image_url for product consistency
        // if the agent provided a source image but no elements
        let effectiveElements = elements;
        if (sourceImageUrl && (!elements || elements.length === 0)) {
          effectiveElements = [{
            image_url: sourceImageUrl,
            description: "Main subject/product — maintain visual consistency",
          }];
          console.log("[tool:generate_video] Auto-created element from source_image_url for product consistency");
        }

        videoUrl = await generateBRoll({
          prompt,
          imageUrl: sourceImageUrl,
          duration: parseInt(duration || "5") || 5,
          aspectRatio: (aspectRatio as "16:9" | "9:16" | "1:1") || "9:16",
          negativePrompt,
          elements: effectiveElements,
          enableAudio: input.generate_audio === true, // Agent decides: true for atmospheric scenes, false for VO-driven
          generationId: context.generationId,
          onProgress: (msg) => {
            emitter.send("tool_progress", {
              tool: "generate_video", generationId: context.generationId, status: "generating",
              message: msg,
            });
          },
        });
        modelUsed = "kling-v3-pro";
        break;
      }

      case "animate": {
        emitter.send("tool_progress", {
          tool: "generate_video", generationId: context.generationId, status: "generating",
          message: "Animating static ad with Kling v3 Pro...",
        });

        videoUrl = await animateStaticAd({
          imageUrl: sourceImageUrl!,
          motionPrompt: prompt || undefined,
          duration: parseInt(duration || "5") || 5,
          aspectRatio: (aspectRatio as "16:9" | "9:16" | "1:1") || "1:1",
          negativePrompt,
          generationId: context.generationId,
          onProgress: (msg) => {
            emitter.send("tool_progress", {
              tool: "generate_video", generationId: context.generationId, status: "generating",
              message: msg,
            });
          },
        });
        modelUsed = "kling-v3-pro-i2v";
        break;
      }

      case "sora_i2v": {
        if (!sourceImageUrl) return { success: false, content: "'sora_i2v' mode requires source_image_url." };
        emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: "Generating with Sora 2 Pro Image-to-Video..." });
        videoUrl = await generateSoraI2V({
          prompt,
          imageUrl: sourceImageUrl,
          duration: (parseInt(duration || "8") || 8) as 4 | 8 | 12 | 16 | 20,
          aspectRatio: (aspectRatio as "16:9" | "9:16") || "16:9",
          generationId: context.generationId,
          onProgress: (msg) => { emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: msg }); },
        });
        modelUsed = "sora-2-pro-i2v";
        break;
      }

      case "sora_remix": {
        if (!sourceImageUrl) return { success: false, content: "'sora_remix' mode requires source_image_url (video URL to remix)." };
        emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: "Remixing video with Sora 2..." });
        videoUrl = await generateSoraRemix({
          prompt,
          videoUrl: sourceImageUrl,
          duration: (parseInt(duration || "8") || 8) as 4 | 8 | 12,
          aspectRatio: (aspectRatio as "16:9" | "9:16") || "16:9",
          generationId: context.generationId,
          onProgress: (msg) => { emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: msg }); },
        });
        modelUsed = "sora-2-remix";
        break;
      }

      case "broll_fast": {
        emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: "Generating B-roll with Kling v3 Standard (fast)..." });
        videoUrl = await generateKlingStandard({
          prompt,
          imageUrl: sourceImageUrl,
          duration: parseInt(duration || "5") || 5,
          aspectRatio: (aspectRatio as "16:9" | "9:16" | "1:1") || "16:9",
          negativePrompt,
          generationId: context.generationId,
          onProgress: (msg) => { emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: msg }); },
        });
        modelUsed = "kling-v3-standard";
        break;
      }

      case "veo_ugc": {
        // veo_ugc MUST have an image reference for character consistency
        const ugcImageUrl = sourceImageUrl || referenceImageUrls?.[0];
        if (!ugcImageUrl) {
          return {
            success: false,
            content: "veo_ugc REQUIRES a source_image_url or reference_image_urls for character consistency. Generate a character image first with generate_character, then pass its URL.",
          };
        }
        // Enhanced negative prompt for UGC — prevents impossible physics and lipsync issues
        const UGC_NEGATIVE_ADDITIONS = "phone disconnected from hand, object floating unsupported, hand passes through face, fingers warping, griping inconsistency, hands changing position between frames, object teleporting, hand occlusion on mouth, three hands, extra fingers on hand";
        const ugcNegative = negativePrompt ? `${negativePrompt}, ${UGC_NEGATIVE_ADDITIONS}` : `${DEFAULT_NEGATIVE}, ${UGC_NEGATIVE_ADDITIONS}`;
        emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: "Generating UGC scene with Veo 3.1 (character reference + audio)..." });
        videoUrl = await generateVeo31({
          prompt,
          imageUrl: ugcImageUrl,
          duration: parseInt(duration || "6") || 6,
          aspectRatio: (aspectRatio as "16:9" | "9:16") || "9:16",
          generateAudio: true,
          fast: false,
          negativePrompt: ugcNegative,
          generationId: context.generationId,
          onProgress: (msg) => { emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: msg }); },
        });
        modelUsed = "veo-3.1-ugc";
        break;
      }

      case "veo": {
        emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: "Generating cinematic video with Veo 3.1..." });
        videoUrl = await generateVeo31({
          prompt,
          imageUrl: sourceImageUrl,
          duration: parseInt(duration || "8") || 8,
          aspectRatio: (aspectRatio as "16:9" | "9:16") || "16:9",
          generateAudio: true,
          fast: false,
          negativePrompt,
          generationId: context.generationId,
          onProgress: (msg) => { emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: msg }); },
        });
        modelUsed = "veo-3.1";
        break;
      }

      case "veo_fast": {
        emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: "Generating with Veo 3.1 Fast..." });
        videoUrl = await generateVeo31({
          prompt,
          imageUrl: sourceImageUrl,
          duration: parseInt(duration || "8") || 8,
          aspectRatio: (aspectRatio as "16:9" | "9:16") || "16:9",
          generateAudio: false,
          fast: true,
          negativePrompt,
          generationId: context.generationId,
          onProgress: (msg) => { emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: msg }); },
        });
        modelUsed = "veo-3.1-fast";
        break;
      }

      case "seedance_i2v": {
        if (!sourceImageUrl && !firstFrameUrl) {
          return { success: false, content: "'seedance_i2v' requires source_image_url or first_frame_url. Generate a keyframe image first." };
        }
        const seedImageUrl = sourceImageUrl || firstFrameUrl!;
        const seedDuration = parseInt(duration || "10") || 10;
        const seedAudio = input.generate_audio === true;
        emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: `Generating ${seedDuration}s video with Seedance 2.0...` });
        try {
          videoUrl = await generateSeedanceI2V({
            prompt,
            imageUrl: seedImageUrl,
            endImageUrl: lastFrameUrl,
            duration: seedDuration,
            aspectRatio: (aspectRatio as string) || "9:16",
            generateAudio: seedAudio,
            negativePrompt,
            generationId: context.generationId,
            onProgress: (msg) => { emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: msg }); },
          });
        } catch (seedErr) {
          // Provide explicit fallback guidance
          const errMsg = seedErr instanceof Error ? seedErr.message : String(seedErr);
          return {
            success: false,
            content: `Seedance 2.0 failed: ${errMsg}\n\n**FALLBACK:** Retry with mode='kling_flf' and REWRITE the prompt — remove ALL timestamps, speed percentages, and phase labels. Kling needs ONE simple camera move in 2-3 plain sentences. Example: "Slow orbital sweep 45 degrees around the car. Rim light traces the body. Chrome reflections shift smoothly."`,
          };
        }
        modelUsed = "seedance-2.0-i2v";
        break;
      }

      case "seedance_ref": {
        const seedRefUrl = referenceImageUrls?.[0] || sourceImageUrl;
        if (!seedRefUrl) {
          return { success: false, content: "'seedance_ref' requires reference_image_urls or source_image_url." };
        }
        emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: "Generating video with Seedance 2.0 Reference..." });
        videoUrl = await generateSeedanceRef({
          prompt,
          referenceImageUrl: seedRefUrl,
          duration: parseInt(duration || "5") || 5,
          aspectRatio: (aspectRatio as string) || "9:16",
          negativePrompt,
          generationId: context.generationId,
          onProgress: (msg) => { emitter.send("tool_progress", { tool: "generate_video", generationId: context.generationId, status: "generating", message: msg }); },
        });
        modelUsed = "seedance-2.0-ref";
        break;
      }
    }

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
          prompt,
          mode,
          model: modelUsed,
          duration: duration || (mode === "animate" ? "5" : undefined),
          source_image_url: sourceImageUrl || null,
          elements: elements || null,
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    const durationLabel = duration || (mode === "animate" ? "5" : "default");
    return {
      success: true,
      content: `Video generated (${mode}, ${modelUsed}, ${aspectRatio}, ${durationLabel}s). URL: ${videoUrl}`,
      assets: [
        {
          assetId: asset?.id,
          type: "video",
          url: videoUrl,
          metadata: {
            prompt,
            mode,
            model: modelUsed,
            duration: durationLabel,
            aspect_ratio: aspectRatio,
          },
        },
      ],
    };
  } catch (error) {
    console.error("[tool:generate_video] Error:", error);
    return {
      success: false,
      content: `Video generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
