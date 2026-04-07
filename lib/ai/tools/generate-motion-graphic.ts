import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getNextVariantNumber } from "./types";
import { renderComposition } from "@/lib/generation/remotion-render";
import { db } from "@/lib/db";
import type { MotionGraphicProps } from "@/remotion/lib/types";

export const generateMotionGraphicDefinition: ToolDefinition = {
  name: "generate_motion_graphic",
  description:
    "Generate a motion design video using Remotion. Perfect for tech/SaaS brands: animated statistics with count-up effects, product feature highlights with staggered entrance, kinetic typography for bold messaging, data visualization animations. No AI video model needed — renders deterministically from code. Ideal for LinkedIn, YouTube, and product launch content. Costs 5 credits.",
  input_schema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: [
          "stat_counter",
          "feature_highlight",
          "kinetic_type",
          "product_launch",
          "pitch_deck",
        ],
        description:
          "Type of motion graphic. stat_counter: animated number count-ups. feature_highlight: animated feature cards with staggered entrance. kinetic_type: bold text animations line by line. product_launch: product stats + features combined. pitch_deck: animated slides.",
      },
      title: {
        type: "string",
        description: "Main title/headline for the motion graphic.",
      },
      subtitle: {
        type: "string",
        description: "Optional subtitle below the title.",
      },
      stats: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Stat label, e.g. 'Active Users'" },
            value: { type: "number", description: "Numeric value, e.g. 50000" },
            prefix: { type: "string", description: "Prefix like '$' or '+'" },
            suffix: { type: "string", description: "Suffix like '%' or '+' or 'K'" },
          },
          required: ["label", "value"],
        },
        description: "Stats for stat_counter and product_launch types.",
      },
      features: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
          },
          required: ["title", "description"],
        },
        description: "Features for feature_highlight and pitch_deck types.",
      },
      text_lines: {
        type: "array",
        items: { type: "string" },
        description:
          "Text lines for kinetic_type. Each line appears sequentially with bold animation.",
      },
      aspect_ratio: {
        type: "string",
        enum: ["1:1", "9:16", "16:9"],
        description: "Output aspect ratio. Default '1:1'.",
      },
      style: {
        type: "string",
        enum: ["minimal", "bold", "tech", "startup", "corporate"],
        description:
          "Visual style. Affects colors and typography weight. Default uses brand colors.",
      },
    },
    required: ["type", "title"],
  },
};

export const generateMotionGraphicTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const type = input.type as MotionGraphicProps["type"];
  const title = input.title as string;
  const subtitle = (input.subtitle as string) || undefined;
  const stats = (input.stats as MotionGraphicProps["stats"]) || [];
  const features = (input.features as MotionGraphicProps["features"]) || [];
  const textLines = (input.text_lines as string[]) || [];
  const aspectRatio = (input.aspect_ratio as string) || "1:1";
  const style = (input.style as string) || "minimal";

  const brand = context.brand;
  const fps = 30;

  // Derive colors from brand or style
  const brandColor = brand?.primary_color || "#1a1a2e";
  const accentColor = brand?.accent_color || "#e94560";
  const backgroundColor =
    style === "bold" || style === "tech"
      ? "#0a0a0a"
      : style === "corporate"
        ? "#f8f9fa"
        : "#ffffff";

  console.log(
    "[tool:generate_motion_graphic]",
    "type:", type,
    "aspect:", aspectRatio,
    "style:", style,
    "stats:", stats.length,
    "features:", features.length
  );

  emitter.send("tool_progress", {
    tool: "generate_motion_graphic",
    generationId: context.generationId,
    status: "generating",
    message: `Creating ${type} motion graphic...`,
  });

  try {
    const compositionProps: MotionGraphicProps = {
      type,
      title,
      subtitle,
      stats,
      features,
      textLines,
      brandColor,
      accentColor,
      backgroundColor,
      fontFamily: brand?.font_family || "Inter",
      fps,
    };

    // Choose composition based on aspect ratio
    const compositionId =
      aspectRatio === "9:16" ? "MotionGraphic-Vertical" : "MotionGraphic";

    emitter.send("tool_progress", {
      tool: "generate_motion_graphic",
      generationId: context.generationId,
      status: "generating",
      message: "Rendering motion graphic via Remotion...",
    });

    const result = await renderComposition({
      compositionId,
      inputProps: compositionProps as unknown as Record<string, unknown>,
      format: "mp4",
      generationId: context.generationId,
    });

    console.log(
      "[tool:generate_motion_graphic] Render complete:",
      result.url.slice(0, 80)
    );

    emitter.send("tool_progress", {
      tool: "generate_motion_graphic",
      generationId: context.generationId,
      status: "saving",
      message: "Saving motion graphic...",
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
          asset_category: "motion_graphic",
          motion_type: type,
          title,
          style,
          stats_count: stats.length,
          features_count: features.length,
          render_duration_ms: result.durationMs,
        },
        variant_number: variantNum,
      })
      .select("id")
      .single();

    if (saveError) {
      console.warn(
        "[tool:generate_motion_graphic] Failed to save:",
        saveError.message
      );
    }

    emitter.send("tool_progress", {
      tool: "generate_motion_graphic",
      generationId: context.generationId,
      status: "complete",
      message: "Motion graphic generated successfully",
    });

    const summary = [
      `Motion graphic created successfully (${type}, ${aspectRatio})`,
      `URL: ${result.url}`,
      `Title: "${title}"`,
      stats.length > 0
        ? `Stats: ${stats.map((s) => `${s.label}: ${s.prefix || ""}${s.value}${s.suffix || ""}`).join(", ")}`
        : null,
      features.length > 0
        ? `Features: ${features.map((f) => f.title).join(", ")}`
        : null,
      textLines.length > 0
        ? `Text lines: ${textLines.length}`
        : null,
      `Style: ${style}, Colors: ${brandColor} / ${accentColor}`,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      success: true,
      content: summary,
      data: { url: result.url, type, aspectRatio },
      assets: [
        {
          assetId: asset?.id,
          type: "video",
          url: result.url,
          metadata: {
            asset_category: "motion_graphic",
            motion_type: type,
            aspect_ratio: aspectRatio,
          },
        },
      ],
    };
  } catch (error) {
    console.error("[tool:generate_motion_graphic] Error:", error);
    return {
      success: false,
      content: `Motion graphic generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
