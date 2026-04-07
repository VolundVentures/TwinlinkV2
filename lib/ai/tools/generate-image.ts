import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber } from "./types";
import { generateImage, editImage } from "@/lib/generation/fal";
import { db } from "@/lib/db";
import { TOOL_CREDIT_COSTS } from "./types";

export const generateImageDefinition: ToolDefinition = {
  name: "generate_image",
  description:
    "Generate an image using AI (Nano Banana 2). Costs 3 credits.\n\n**Two modes:** (1) Text-to-image for new concepts, (2) Edit mode with reference_image_urls for character/product consistency.\n\n**Image Prompt Craft (60-100 words of natural PROSE, not keyword lists):**\nStructure: Subject > Setting > Camera + Film stock > Lighting > Composition\n- Camera: 'Shot on Canon EOS R5 85mm f/1.4' or 'Hasselblad 907X medium format'\n- Film stock: 'Kodak Portra 400 tones' or 'Fuji Pro 400H warmth'\n- Lighting: 'Rembrandt lighting from upper-left' NOT 'well-lit'\n- Imperfections: 'subtle film grain ISO 400, slight vignetting'\n- Use brand hex colors directly: 'Background in #1E3A5F'\n\n**For PEOPLE (critical — avoid waxy AI look):**\n- USE: 'natural skin texture, visible pores, subtle imperfections, matte skin, slight redness'\n- NEVER use: 'photorealistic' (triggers beauty filter), 'ultra detailed', 'perfect skin'\n- End with: 'NOT airbrushed, NOT plastic, NOT CGI, NOT beauty-filtered'\n- Close-up framing > full body (reduces face distortion)\n- ONE person per image (multiple faces = artifact risk)\n\n**For PRODUCTS:** ALWAYS pass the product's image_url as reference_image_urls.\n\n**Aspect ratio:** Default 9:16 for video keyframes. MUST match the video's target aspect ratio.",
  input_schema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "Detailed image generation prompt. For edit mode, describe how to use the reference images: 'The person from the first image holding the product from the second image in a cozy home setting'. For text-only, describe the complete ad design.",
      },
      reference_image_urls: {
        type: "array",
        items: { type: "string" },
        description:
          "Reference image URLs for consistency. Use for: character reference (same person across ads), product photo (place real product in scene), style transfer (match visual DNA), or scene editing. Up to 14 images. When provided, uses the edit endpoint.",
      },
      aspect_ratio: {
        type: "string",
        enum: ["1:1", "4:5", "9:16", "16:9"],
        description: "Image aspect ratio. Default '9:16' for video ad keyframes. Use '1:1' for profile images or square formats. Use '16:9' for YouTube/landscape. MUST match the video's aspect ratio when generating keyframes.",
      },
      resolution: {
        type: "string",
        enum: ["1K", "2K"],
        description:
          "Image resolution. Use '1K' for iteration/drafts, '2K' for hero shots and finals. Default '2K'.",
      },
      num_variants: {
        type: "number",
        description:
          "Generate multiple variants (1-4) to pick the best one. Each variant costs 3 credits. Default 1.",
      },
      headline: {
        type: "string",
        description:
          "The headline text for tracking/metadata purposes (the prompt should already include this text).",
      },
      body_text: {
        type: "string",
        description: "The body text for tracking/metadata.",
      },
      cta: {
        type: "string",
        description: "The CTA text for tracking/metadata.",
      },
      concept_name: {
        type: "string",
        description:
          "Name of the creative concept this image belongs to (for organization).",
      },
    },
    required: ["prompt"],
  },
};

export const generateImageTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const prompt = input.prompt as string;
  const referenceUrls = (input.reference_image_urls as string[]) || [];
  const aspectRatio = (input.aspect_ratio as string) || "9:16";
  const resolution = (input.resolution as string as "1K" | "2K") || "2K";
  const numVariants = Math.min(4, Math.max(1, (input.num_variants as number) || 1));
  const headline = (input.headline as string) || null;
  const bodyText = (input.body_text as string) || null;
  const cta = (input.cta as string) || null;
  const conceptName = (input.concept_name as string) || null;

  // Validate reference images before using edit mode
  let validRefs = referenceUrls;
  if (referenceUrls.length > 0) {
    const { validateReferenceImages } = await import("@/lib/generation/image-utils");
    const { valid, warnings } = await validateReferenceImages(referenceUrls);
    validRefs = valid;
    for (const w of warnings) console.warn("[tool:generate_image]", w);
  }
  const useEditMode = validRefs.length > 0;

  console.log(
    "[tool:generate_image]",
    useEditMode ? "Edit mode" : "Text-to-image",
    "aspect:", aspectRatio,
    "resolution:", resolution,
    "variants:", numVariants,
    "refs:", validRefs.length,
    "concept:", conceptName
  );

  emitter.send("tool_progress", {
    tool: "generate_image",
    generationId: context.generationId,
    status: "generating",
    message: useEditMode
      ? `Generating ${aspectRatio} image with ${referenceUrls.length} reference(s)...`
      : `Generating ${aspectRatio} image...`,
  });

  try {
    let imageUrls: string[];

    if (useEditMode) {
      // Use edit endpoint with reference images
      imageUrls = await editImage(prompt, {
        imageUrls: validRefs,
        aspectRatio,
        resolution,
        numImages: numVariants,
        thinkingLevel: "high",
        generationId: context.generationId,
      });
    } else {
      // Use text-to-image endpoint
      if (numVariants > 1) {
        // Generate multiple variants
        const promises = Array.from({ length: numVariants }, () =>
          generateImage(prompt, {
            aspectRatio,
            resolution,
            outputFormat: "png",
            thinking_level: "high",
            generationId: context.generationId,
          })
        );
        imageUrls = await Promise.all(promises);
      } else {
        const url = await generateImage(prompt, {
          aspectRatio,
          resolution,
          outputFormat: "png",
          thinking_level: "high",
          generationId: context.generationId,
        });
        imageUrls = [url];
      }
    }

    console.log("[tool:generate_image] Generated", imageUrls.length, "image(s)");

    emitter.send("tool_progress", {
      tool: "generate_image",
      generationId: context.generationId,
      status: "saving",
      message: `Saving ${imageUrls.length} image asset(s)...`,
    });

    // Upload to Supabase Storage for PERMANENT URLs (fal.ai URLs expire)
    const permanentUrls: string[] = [];
    for (let i = 0; i < imageUrls.length; i++) {
      let permanentUrl = imageUrls[i];
      try {
        const imgRes = await fetch(imageUrls[i]);
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer();
          const ext = imageUrls[i].includes(".png") ? "png" : "jpg";
          const fileName = `img-${context.generationId}-${Date.now()}-${i}.${ext}`;

          const { error: bucketError } = await db.storage.createBucket("images", {
            public: true,
            allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
          });
          if (bucketError && !bucketError.message.includes("already exists")) {
            console.warn("[tool:generate_image] Bucket warning:", bucketError.message);
          }

          const { error: uploadError } = await db.storage
            .from("images")
            .upload(fileName, imgBuffer, { contentType: `image/${ext}`, upsert: true });

          if (!uploadError) {
            const { data: publicUrlData } = db.storage.from("images").getPublicUrl(fileName);
            permanentUrl = publicUrlData.publicUrl;
          } else {
            console.warn("[tool:generate_image] Upload failed, using fal URL:", uploadError.message);
          }
        }
      } catch (uploadErr) {
        console.warn("[tool:generate_image] Failed to persist image:", uploadErr);
      }
      permanentUrls.push(permanentUrl);
    }

    // Save all images to generation_assets
    const assets: Array<{
      assetId?: string;
      type: "image" | "video" | "audio" | "script" | "thumbnail";
      url: string;
      metadata: Record<string, unknown>;
    }> = [];

    for (let idx = 0; idx < permanentUrls.length; idx++) {
      const imageUrl = permanentUrls[idx];
      const variantNum = await getNextVariantNumber(context.generationId);
      const { data: asset, error: saveError } = await db
        .from("generation_assets")
        .insert({
          generation_id: context.generationId,
          org_id: context.orgId,
          type: "image",
          aspect_ratio: aspectRatio,
          storage_path: imageUrl,
          public_url: imageUrl,
          metadata: {
            prompt,
            headline,
            body_text: bodyText,
            cta,
            concept_name: conceptName,
            reference_image_urls: referenceUrls.length > 0 ? referenceUrls : undefined,
            resolution,
            edit_mode: useEditMode,
          },
          variant_number: variantNum,
        })
        .select("id")
        .single();

      if (saveError) {
        console.warn("[tool:generate_image] Failed to save asset:", saveError.message);
      }

      assets.push({
        assetId: asset?.id,
        type: "image",
        url: imageUrl,
        metadata: {
          prompt,
          headline,
          body_text: bodyText,
          cta,
          concept_name: conceptName,
          aspect_ratio: aspectRatio,
          resolution,
          edit_mode: useEditMode,
        },
      });
    }

    emitter.send("tool_progress", {
      tool: "generate_image",
      generationId: context.generationId,
      status: "complete",
      message: `${imageUrls.length} image(s) generated successfully`,
    });

    const primaryUrl = imageUrls[0];
    const summary = [
      `${imageUrls.length} image(s) generated successfully (${aspectRatio}, ${resolution})`,
      useEditMode ? `Mode: Edit with ${referenceUrls.length} reference image(s)` : "Mode: Text-to-image",
      ...imageUrls.map((url, i) => `Image ${i + 1}: ${url}`),
      headline ? `Headline: "${headline}"` : null,
      cta ? `CTA: "${cta}"` : null,
      conceptName ? `Concept: ${conceptName}` : null,
      `Credits used: ${TOOL_CREDIT_COSTS.generate_image * numVariants}`,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      success: true,
      content: summary,
      data: { imageUrl: primaryUrl, imageUrls, aspectRatio, resolution },
      assets,
    };
  } catch (error) {
    console.error("[tool:generate_image] Error:", error);
    return {
      success: false,
      content: `Image generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
