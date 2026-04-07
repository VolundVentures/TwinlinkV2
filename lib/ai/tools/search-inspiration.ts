import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { searchPinterest } from "@/lib/external/pinterest";

export const searchInspirationDefinition: ToolDefinition = {
  name: "search_inspiration",
  description:
    "Search Pinterest for visual inspiration and reference images for ad design. Returns image URLs that can be passed as reference_image_urls to generate_image for style transfer. Use this when you want fresh visual ideas, mood board references, or design inspiration for a specific brand/product/style. Costs 1 credit.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Search query for visual inspiration. Be specific about the style you want. Examples: 'minimal skincare ad design', 'dark premium tech product photography', 'UGC style food ad layout', 'editorial fashion advertising'",
      },
      count: {
        type: "number",
        description: "Number of reference images to return (1-10, default 6).",
      },
    },
    required: ["query"],
  },
};

export const searchInspirationTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const query = input.query as string;
  const count = Math.min(10, Math.max(1, (input.count as number) || 6));

  console.log("[tool:search_inspiration] Searching Pinterest for:", query);

  emitter.send("tool_progress", {
    tool: "search_inspiration",
    generationId: context.generationId,
    status: "generating",
    message: `Searching Pinterest for "${query}"...`,
  });

  try {
    const pins = await searchPinterest(query, { count });

    if (pins.length === 0) {
      return {
        success: true,
        content: `No Pinterest results found for "${query}". Try a different search term or proceed with the Style Library presets in your system prompt.`,
      };
    }

    const imageUrls = pins.map((p) => p.image_url);
    const descriptions = pins
      .map((p, i) => `${i + 1}. ${p.title || "Untitled"}: ${p.description?.slice(0, 100) || "No description"}`)
      .join("\n");

    const summary = [
      `Found ${pins.length} Pinterest inspiration images for "${query}":`,
      "",
      descriptions,
      "",
      "Image URLs (use as reference_image_urls in generate_image):",
      ...imageUrls.map((url, i) => `${i + 1}. ${url}`),
      "",
      "To use: pass these URLs as reference_image_urls when calling generate_image to transfer the visual style to your ad creative.",
    ].join("\n");

    emitter.send("tool_progress", {
      tool: "search_inspiration",
      generationId: context.generationId,
      status: "complete",
      message: `Found ${pins.length} inspiration images`,
    });

    return {
      success: true,
      content: summary,
      data: { pins, imageUrls },
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[tool:search_inspiration] Error:", errMsg);

    return {
      success: false,
      content: `Inspiration search failed: ${errMsg}. Proceed with the Style Library presets instead.`,
    };
  }
};
