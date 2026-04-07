import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber } from "./types";
import { generateImage, editImage } from "@/lib/generation/fal";
import { db } from "@/lib/db";

export const generateCharacterDefinition: ToolDefinition = {
  name: "generate_character",
  description:
    "Generate a realistic, attractive AI character for UGC video ads. The character must look like a REAL person — not an AI model. Optimized for the Veo 3.1 + lipsync pipeline.\n\n**Character Quality Rules:**\n- MUST be specific: exact age, ethnicity, hair (color/length/style), clothing (specific items), expression (specific emotion)\n- GOOD: '26-year-old Black woman, natural coily hair in loose bun, oversized vintage band tee, thin gold chain, knowing half-smile, small mole near left eyebrow'\n- BAD: 'Young attractive woman, casual clothing, friendly expression' (produces same generic person every time)\n- Vary characters across ads: mix ages (20s-40s), ethnicities, body types, styles\n- If brand has a product, the character should HOLD IT, WEAR IT, or USE IT — show interaction\n- For lipsync: keep hands below shoulders, mouth fully visible, no face touching\n- Always include 'natural skin texture, visible pores' to avoid waxy AI look\n- End prompt with 'NOT airbrushed, NOT plastic, NOT CGI'\n\nCosts 3 credits.",
  input_schema: {
    type: "object",
    properties: {
      description: {
        type: "string",
        description:
          "Detailed character description: age range, gender, ethnicity, hair style/color, clothing, facial expression, body type. Be specific for consistency. Example: '28-year-old South Asian woman, shoulder-length dark hair, warm brown eyes, wearing a cream knit sweater, friendly confident smile'.",
      },
      style: {
        type: "string",
        enum: ["ugc_casual", "professional", "lifestyle", "fitness", "tech"],
        description:
          "Character style. ugc_casual: relatable everyday person. professional: business attire. lifestyle: aspirational but approachable. fitness: athletic wear. tech: startup/developer aesthetic.",
      },
      product_image_url: {
        type: "string",
        description:
          "URL of the product image. When provided, the character will be shown holding or using this product. The edit endpoint combines character + product references for natural placement.",
      },
      pose: {
        type: "string",
        enum: [
          "headshot",
          "upper_body",
          "holding_product",
          "using_product",
          "full_body",
        ],
        description:
          "Character pose. 'headshot' and 'upper_body' are optimized for HeyGen Avatar4 animation. 'holding_product' and 'using_product' require product_image_url.",
      },
      environment: {
        type: "string",
        enum: ["clean_bg", "home", "office", "outdoor", "studio", "cafe"],
        description:
          "Background setting. 'clean_bg' for versatile reuse and HeyGen. 'home'/'office'/'outdoor' for lifestyle context.",
      },
      aspect_ratio: {
        type: "string",
        enum: ["9:16", "1:1", "4:5"],
        description:
          "Aspect ratio. '9:16' for video-ready vertical. '1:1' for profile/square. '4:5' for Instagram feed. Default '9:16'.",
      },
    },
    required: ["description"],
  },
};

const STYLE_PROMPTS: Record<string, string> = {
  ugc_casual:
    "Candid phone snapshot aesthetic, natural imperfections, shot on iPhone 15 Pro, natural light, authentic everyday person, slightly asymmetric pose",
  professional:
    "Professional headshot, clean studio lighting, business casual attire, confident posture, shot on Canon EOS R5 85mm f/1.4",
  lifestyle:
    "Lifestyle editorial photography, natural golden hour light, warm Kodak Portra 400 tones, aspirational but approachable, slight film grain",
  fitness:
    "Athletic lifestyle photography, dynamic natural light, energetic expression, activewear, shot on Sony A7IV 35mm f/1.8",
  tech:
    "Modern startup aesthetic, clean minimalist environment, casual tech-industry clothing, natural window light, approachable confidence",
};

const ENVIRONMENT_PROMPTS: Record<string, string> = {
  clean_bg:
    "clean neutral background, soft gradient, studio-like setting",
  home:
    "cozy home interior, natural window light, lived-in warmth, plants and soft textures visible",
  office:
    "modern office environment, clean desk, natural daylight from large windows",
  outdoor:
    "outdoor natural setting, soft diffused daylight, green foliage background with bokeh",
  studio:
    "professional photography studio, controlled lighting, seamless backdrop",
  cafe:
    "warm cafe setting, ambient lighting, wooden surfaces, coffee shop atmosphere",
};

const POSE_PROMPTS: Record<string, string> = {
  headshot:
    "portrait from shoulders up, front-facing with slight angle, direct eye contact, natural expression, sharp focus on face, shallow depth of field",
  upper_body:
    "upper body portrait from waist up, natural relaxed posture, slight head tilt, engaging expression, hands visible and relaxed",
  holding_product:
    "upper body, naturally holding the product from the reference image in their hands, looking at camera with genuine enthusiasm, product clearly visible",
  using_product:
    "candid moment of actively using the product from the reference image, natural interaction, genuine engagement with the product",
  full_body:
    "full body shot, natural standing pose, relaxed confident posture, environmental context visible",
};

export const generateCharacterTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const description = input.description as string;
  const style = (input.style as string) || "ugc_casual";
  const productImageUrl = (input.product_image_url as string) || null;
  const pose = (input.pose as string) || (productImageUrl ? "holding_product" : "upper_body");
  const environment = (input.environment as string) || "clean_bg";
  const aspectRatio = (input.aspect_ratio as string) || "9:16";

  // Use edit endpoint whenever a product image is provided, regardless of pose
  const needsProduct = !!productImageUrl;

  console.log(
    "[tool:generate_character]",
    "style:", style,
    "pose:", pose,
    "env:", environment,
    "product:", !!productImageUrl,
    "aspect:", aspectRatio
  );

  emitter.send("tool_progress", {
    tool: "generate_character",
    generationId: context.generationId,
    status: "generating",
    message: productImageUrl
      ? "Generating character with product..."
      : "Generating character...",
  });

  try {
    // Build the prompt from components
    // NEVER use "photorealistic" — it triggers AI beauty-filter making faces look plastic
    const promptParts = [
      `Natural photograph of ${description}. This person looks like someone you'd see in real life — attractive but not impossibly perfect, the kind of face that feels trustworthy and relatable on social media.`,
      POSE_PROMPTS[pose] || POSE_PROMPTS.upper_body,
      ENVIRONMENT_PROMPTS[environment] || ENVIRONMENT_PROMPTS.clean_bg,
      STYLE_PROMPTS[style] || STYLE_PROMPTS.ugc_casual,
      "Natural skin texture with visible pores, subtle imperfections, natural hair with flyaways, realistic fabric wrinkles. Well-groomed and stylish but real. Exactly two hands, exactly five fingers per hand.",
      "NOT stock photography, NOT CGI, NOT oversaturated, NOT perfectly symmetrical, NOT airbrushed skin, NO extra limbs, NO extra hands, NO extra fingers, NO deformed hands, NO three arms, NO mutation.",
    ];

    const prompt = promptParts.join(" ");

    let imageUrl: string;

    if (needsProduct) {
      // Validate product image before using as reference
      const { validateReferenceImages } = await import("@/lib/generation/image-utils");
      const { valid, warnings } = await validateReferenceImages([productImageUrl]);
      for (const w of warnings) console.warn("[tool:generate_character]", w);

      if (valid.length === 0) {
        // Product image too small/large — fall back to text-to-image
        console.warn("[tool:generate_character] Product image failed validation, using text-to-image instead");
        const fallbackUrl = await generateImage(prompt, {
          aspectRatio,
          resolution: "2K",
          outputFormat: "png",
          thinking_level: "high",
          generationId: context.generationId,
        });
        imageUrl = fallbackUrl;
      } else {
        // Use edit endpoint with validated product reference
        const urls = await editImage(prompt, {
          imageUrls: valid,
          aspectRatio,
          resolution: "2K",
          numImages: 1,
          thinkingLevel: "high",
          generationId: context.generationId,
        });
        imageUrl = urls[0];
      }
    } else {
      // Text-to-image for standalone character
      imageUrl = await generateImage(prompt, {
        aspectRatio,
        resolution: "2K",
        outputFormat: "png",
        thinking_level: "high",
        generationId: context.generationId,
      });
    }

    console.log("[tool:generate_character] Character generated:", imageUrl.slice(0, 80));

    emitter.send("tool_progress", {
      tool: "generate_character",
      generationId: context.generationId,
      status: "saving",
      message: "Saving character asset...",
    });

    // Save to generation_assets with reusable character metadata
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
          asset_category: "character",
          reusable: true,
          character_description: description,
          style,
          pose,
          environment,
          product_image_url: productImageUrl,
          prompt,
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    if (saveError) {
      console.warn("[tool:generate_character] Failed to save:", saveError.message);
    }

    emitter.send("tool_progress", {
      tool: "generate_character",
      generationId: context.generationId,
      status: "complete",
      message: "Character generated successfully",
    });

    const summary = [
      `Character generated successfully (${aspectRatio}, 2K)`,
      `URL: ${imageUrl}`,
      `Description: ${description}`,
      `Style: ${style}, Pose: ${pose}, Environment: ${environment}`,
      productImageUrl ? `Product integrated from: ${productImageUrl}` : null,
      "",
      "This character image can be reused for:",
      "- generate_avatar_video: Pass as character_image_url for talking head video",
      "- generate_image: Pass as reference_image_urls for consistent character across scenes",
      "- generate_video mode=broll: Pass via elements for Kling character consistency",
    ]
      .filter((s) => s !== null)
      .join("\n");

    return {
      success: true,
      content: summary,
      data: {
        imageUrl,
        characterDescription: description,
        style,
        pose,
        reusable: true,
      },
      assets: [
        {
          assetId: asset?.id,
          type: "image",
          url: imageUrl,
          metadata: {
            asset_category: "character",
            reusable: true,
            character_description: description,
            style,
            pose,
            environment,
          },
        },
      ],
    };
  } catch (error) {
    console.error("[tool:generate_character] Error:", error);
    return {
      success: false,
      content: `Character generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
