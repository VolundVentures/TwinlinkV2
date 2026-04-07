import type { ToolDefinition, ToolHandler, ToolResult } from "./types";

export const replicateAdDefinition: ToolDefinition = {
  name: "replicate_ad",
  description:
    "Replicate a competitor's ad creative using the user's brand identity. Takes a competitor ad's composition type, copy structure, and visual description, then generates a brand-matched version. This is a PLANNING tool — it returns a creative strategy that should be followed by calling generate_image or generate_video to produce the actual creative. Costs 0 credits (planning only).",
  input_schema: {
    type: "object",
    properties: {
      competitor_ad: {
        type: "object",
        properties: {
          headline: { type: "string", description: "Original ad headline" },
          body_text: { type: "string", description: "Original ad body copy" },
          cta: { type: "string", description: "Original call to action" },
          composition_type: {
            type: "string",
            description: "Visual composition type (social_proof_grid, ugc_testimonial, product_hero, etc.)",
          },
          visual_description: { type: "string", description: "Description of the original ad's visual layout" },
          media_type: { type: "string", enum: ["image", "video"], description: "Whether the original is image or video" },
        },
        required: ["composition_type"],
        description: "The competitor ad to replicate",
      },
      adaptation_notes: {
        type: "string",
        description: "How to adapt the ad for the user's brand (e.g., 'Make it more casual', 'Focus on our price advantage')",
      },
    },
    required: ["competitor_ad"],
  },
};

export const replicateAdTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const competitorAd = input.competitor_ad as {
    headline?: string;
    body_text?: string;
    cta?: string;
    composition_type: string;
    visual_description?: string;
    media_type?: string;
  };
  const adaptationNotes = (input.adaptation_notes as string) || "";

  const brandName = context.brand?.name || "your brand";
  const brandVoice = context.brand?.brand_voice || "professional";
  const brandIndustry = context.brand?.industry || "general";

  console.log("[tool:replicate_ad]", competitorAd.composition_type, "for", brandName);

  emitter.send("tool_progress", {
    tool: "replicate_ad",
    generationId: context.generationId,
    status: "generating",
    message: "Reverse-engineering competitor ad structure...",
  });

  // Build the replication strategy
  const strategy = [
    `## Ad Replication Strategy for ${brandName}`,
    "",
    `**Original Composition:** ${competitorAd.composition_type.replace(/_/g, " ")}`,
    competitorAd.visual_description ? `**Original Visual:** ${competitorAd.visual_description}` : null,
    competitorAd.headline ? `**Original Headline:** "${competitorAd.headline}"` : null,
    competitorAd.body_text ? `**Original Copy:** "${competitorAd.body_text.slice(0, 200)}"` : null,
    competitorAd.cta ? `**Original CTA:** "${competitorAd.cta}"` : null,
    "",
    "### Replication Plan",
    `1. **Keep the composition type:** ${competitorAd.composition_type.replace(/_/g, " ")} — this layout is proven to work`,
    `2. **Adapt messaging:** Rewrite headlines and copy in ${brandName}'s voice (${brandVoice}) for ${brandIndustry}`,
    `3. **Use brand visual identity:** Apply ${brandName}'s colors, typography, and product imagery`,
    `4. **Match media type:** Generate ${competitorAd.media_type === "video" ? "a video ad" : "a static image ad"}`,
    adaptationNotes ? `5. **Special adaptation:** ${adaptationNotes}` : null,
    "",
    "### Next Steps",
    `Now generate the ${competitorAd.media_type === "video" ? "video" : "image"} creative following this composition structure. Use the brand's products and identity.`,
  ].filter(Boolean).join("\n");

  emitter.send("tool_progress", {
    tool: "replicate_ad",
    generationId: context.generationId,
    status: "complete",
    message: "Replication strategy ready",
  });

  return {
    success: true,
    content: strategy,
    data: {
      composition_type: competitorAd.composition_type,
      media_type: competitorAd.media_type || "image",
      original: competitorAd,
      adaptation_notes: adaptationNotes,
    },
  };
};
