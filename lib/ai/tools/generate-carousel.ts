import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { generateImage } from "@/lib/generation/fal";
import { generateStructuredJSON } from "@/lib/ai/claude";
import { db } from "@/lib/db";

export const generateCarouselDefinition: ToolDefinition = {
  name: "generate_carousel",
  description:
    "Generate a multi-slide carousel post. Creates multiple coordinated images for Instagram, LinkedIn, or TikTok carousels. Each slide has its own headline and visual. Costs 3 credits per slide.",
  input_schema: {
    type: "object",
    properties: {
      platform: {
        type: "string",
        enum: ["instagram", "linkedin", "tiktok", "x"],
        description:
          "Target platform. Determines aspect ratio: Instagram (4:5), LinkedIn (1:1), TikTok (9:16), X (1:1).",
      },
      num_slides: {
        type: "number",
        description: "Number of slides to generate (3-10, default 5).",
      },
      theme: {
        type: "string",
        description:
          "Overall carousel theme/topic. Used to generate coordinated slide content.",
      },
      slide_prompts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            headline: {
              type: "string",
              description: "Headline text for this slide.",
            },
            body: {
              type: "string",
              description: "Body text / explanation for this slide.",
            },
            image_direction: {
              type: "string",
              description:
                "Visual direction for the slide image generation prompt.",
            },
          },
          required: ["headline"],
        },
        description:
          "Optional array of slide prompts. If not provided, they will be auto-generated from the theme.",
      },
    },
    required: ["platform", "theme"],
  },
};

type SlidePrompt = {
  headline: string;
  body: string;
  image_direction: string;
};

const PLATFORM_ASPECT_RATIOS: Record<string, { ratio: string; width: number; height: number }> = {
  instagram: { ratio: "4:5", width: 1080, height: 1350 },
  linkedin: { ratio: "1:1", width: 1080, height: 1080 },
  tiktok: { ratio: "9:16", width: 1080, height: 1920 },
  x: { ratio: "1:1", width: 1080, height: 1080 },
};

export const generateCarouselTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const platform = input.platform as string;
  const numSlides = Math.min(10, Math.max(3, (input.num_slides as number) || 5));
  const theme = input.theme as string;
  const inputSlidePrompts = input.slide_prompts as SlidePrompt[] | undefined;

  const aspectConfig = PLATFORM_ASPECT_RATIOS[platform] || PLATFORM_ASPECT_RATIOS.instagram;

  console.log(
    `[tool:generate_carousel] Generating ${numSlides} slides for ${platform}, theme: "${theme}"`
  );

  emitter.send("tool_progress", {
    tool: "generate_carousel",
    generationId: context.generationId,
    status: "planning",
    message: `Planning ${numSlides}-slide carousel for ${platform}...`,
  });

  // Step 1: Generate slide prompts if not provided
  let slidePrompts: SlidePrompt[];

  if (inputSlidePrompts && inputSlidePrompts.length >= 3) {
    slidePrompts = inputSlidePrompts.slice(0, numSlides);
  } else {
    try {
      const brandContext = context.brand
        ? `Brand: ${context.brand.name}. Industry: ${context.brand.industry || "general"}. Voice: ${context.brand.brand_voice || "professional"}.`
        : "";

      const generated = await generateStructuredJSON<{ slides: SlidePrompt[] }>({
        system: `You are a social media content strategist. Generate carousel slide content that is engaging, educational, and visually coherent. ${brandContext}`,
        messages: [
          {
            role: "user",
            content: `Generate exactly ${numSlides} slides for a ${platform} carousel about: "${theme}".

For each slide provide:
- headline: Short, punchy headline (max 8 words)
- body: Brief explanation or key point (1-2 sentences)
- image_direction: Detailed visual direction for AI image generation, describing colors, composition, style, and elements

The first slide should be an attention-grabbing cover. The last slide should be a call-to-action or summary.`,
          },
        ],
        schema: {
          type: "object",
          properties: {
            slides: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  headline: { type: "string" },
                  body: { type: "string" },
                  image_direction: { type: "string" },
                },
                required: ["headline", "body", "image_direction"],
              },
            },
          },
          required: ["slides"],
        },
        schemaName: "carousel_slides",
      });

      slidePrompts = generated.slides.slice(0, numSlides);
    } catch (error) {
      console.error("[tool:generate_carousel] Failed to generate slide prompts:", error);
      return {
        success: false,
        content: `Failed to generate slide content: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // Step 2: Generate images for each slide
  const slideResults: Array<{
    index: number;
    url: string;
    headline: string;
    body: string;
    assetId?: string;
  }> = [];

  for (let i = 0; i < slidePrompts.length; i++) {
    const slide = slidePrompts[i];

    emitter.send("tool_progress", {
      tool: "generate_carousel",
      generationId: context.generationId,
      status: "generating",
      message: `Generating slide ${i + 1}/${slidePrompts.length}: "${slide.headline}"`,
      slideIndex: i,
      totalSlides: slidePrompts.length,
    });

    try {
      const imagePrompt = `${slide.image_direction}. The image should include the text "${slide.headline}" prominently. Designed for a ${platform} carousel post. Clean, modern design. Slide ${i + 1} of ${slidePrompts.length}.`;

      const imageUrl = await generateImage(imagePrompt, {
        aspectRatio: aspectConfig.ratio,
        resolution: "1K",
        outputFormat: "png",
      });

      // Save as generation_asset with carousel metadata
      const { data: asset, error: saveError } = await db
        .from("generation_assets")
        .insert({
          generation_id: context.generationId,
          org_id: context.orgId,
          type: "image",
          aspect_ratio: aspectConfig.ratio,
          storage_path: imageUrl,
          public_url: imageUrl,
          metadata: {
            carousel_index: i,
            carousel_total: slidePrompts.length,
            carousel_platform: platform,
            carousel_theme: theme,
            headline: slide.headline,
            body: slide.body,
            image_direction: slide.image_direction,
          },
          variant_number: i,
        })
        .select("id")
        .single();

      if (saveError) {
        console.warn(`[tool:generate_carousel] Failed to save slide ${i} asset:`, saveError.message);
      }

      slideResults.push({
        index: i,
        url: imageUrl,
        headline: slide.headline,
        body: slide.body,
        assetId: asset?.id,
      });

      // Emit asset_ready for each slide
      emitter.send("asset_ready", {
        assetId: asset?.id,
        type: "image",
        url: imageUrl,
        metadata: {
          carousel_index: i,
          headline: slide.headline,
        },
      });
    } catch (error) {
      console.error(`[tool:generate_carousel] Failed to generate slide ${i}:`, error);
      // Continue with other slides even if one fails
      slideResults.push({
        index: i,
        url: "",
        headline: slide.headline,
        body: slide.body,
      });
    }
  }

  const successfulSlides = slideResults.filter((s) => s.url);

  emitter.send("tool_progress", {
    tool: "generate_carousel",
    generationId: context.generationId,
    status: "complete",
    message: `Carousel generated: ${successfulSlides.length}/${slidePrompts.length} slides`,
  });

  const summary = [
    `Carousel generated for ${platform} (${aspectConfig.ratio})`,
    `Theme: "${theme}"`,
    `Slides: ${successfulSlides.length}/${slidePrompts.length} successful`,
    "",
    ...slideResults.map((s) =>
      s.url
        ? `Slide ${s.index + 1}: "${s.headline}" - ${s.url}`
        : `Slide ${s.index + 1}: "${s.headline}" - FAILED`
    ),
    "",
    `Slides generated: ${successfulSlides.length}`,
  ].join("\n");

  return {
    success: successfulSlides.length > 0,
    content: summary,
    data: {
      platform,
      aspectRatio: aspectConfig.ratio,
      theme,
      slides: slideResults,
    },
    assets: successfulSlides.map((s) => ({
      assetId: s.assetId,
      type: "image" as const,
      url: s.url,
      metadata: {
        carousel_index: s.index,
        headline: s.headline,
        body: s.body,
        platform,
        theme,
      },
    })),
  };
};
