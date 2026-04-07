import type {
  ToolDefinition,
  ToolHandler,
  ToolResult,
  AssetOutput,
} from "./types";
import { generateJSON } from "@/lib/ai/claude";
import { staticAdCreativeBriefPrompt } from "@/lib/ai/prompts/ad-creative";
import { db } from "@/lib/db";
import type { Brand } from "@/lib/database.types";

type Variant = {
  variant_number: number;
  concept: string;
  headline: string;
  body: string;
  cta: string;
  visual_direction: string;
  image_prompt: string;
  rationale: string;
  aspect_ratios: string[];
};

type CreativeBrief = {
  campaign_theme: string;
  variants: Variant[];
};

export const generateCreativeBriefDefinition: ToolDefinition = {
  name: "generate_creative_brief",
  description:
    "Generate a creative brief with multiple ad concepts and copy variants. Uses brand context to produce campaign themes, headlines, body copy, CTAs, and detailed image prompts for each variant. This is the planning step before generating images.",
  input_schema: {
    type: "object",
    properties: {
      campaign_goal: {
        type: "string",
        description:
          "The marketing objective or campaign goal (e.g. 'increase app downloads', 'promote summer sale', 'launch new product').",
      },
      num_concepts: {
        type: "number",
        description:
          "Number of distinct creative concepts to generate (default 3).",
      },
      num_variants_per_concept: {
        type: "number",
        description:
          "Number of copy/layout variations per concept (default 3).",
      },
      style_references: {
        type: "array",
        items: { type: "string" },
        description:
          "Style references or mood descriptions (e.g. 'minimalist', 'bold typography', 'lifestyle photography').",
      },
    },
    required: ["campaign_goal"],
  },
};

export const generateCreativeBrief: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const campaignGoal = input.campaign_goal as string;
  const numConcepts = (input.num_concepts as number) || 2;
  const numVariants = (input.num_variants_per_concept as number) || 1;
  const styleRefs = (input.style_references as string[]) || [];

  console.log(
    "[tool:generate_creative_brief] Goal:",
    campaignGoal,
    "concepts:",
    numConcepts,
    "variants:",
    numVariants
  );

  // Build a brand object for the prompt (use context brand or a fallback)
  const brand: Brand = context.brand || {
    id: "",
    org_id: context.orgId,
    name: "Brand",
    logo_url: null,
    website_url: null,
    description: null,
    primary_color: null,
    secondary_color: null,
    accent_color: null,
    font_family: null,
    industry: null,
    target_audience: null,
    brand_voice: null,
    products: [],
    scraped_data: {},
    is_default: false,
    created_at: "",
    updated_at: "",
  };

  emitter.send("tool_progress", {
    tool: "generate_creative_brief",
    generationId: context.generationId,
    status: "generating",
    message: `Creating ${numConcepts * numVariants} ad variants...`,
  });

  try {
    // Build the user prompt with campaign goal and style references
    let userPrompt = campaignGoal;
    if (styleRefs.length > 0) {
      userPrompt += `\n\nStyle references: ${styleRefs.join(", ")}`;
    }
    if (numConcepts !== 3 || numVariants !== 3) {
      userPrompt += `\n\nGenerate ${numConcepts} concepts with ${numVariants} variants each (${numConcepts * numVariants} total variants).`;
    }

    const totalVariants = numConcepts * numVariants;
    const prompt = staticAdCreativeBriefPrompt(
      brand,
      userPrompt,
      context.language,
      totalVariants
    );

    const brief = await generateJSON<CreativeBrief>({
      model: "claude-opus-4-6",
      maxTokens: 16384,
      system:
        "You are an award-winning creative director who thinks in visual stories, not marketing frameworks. Your concepts are surprising, culturally relevant, and emotionally resonant. You create ads people would actually share — not skip.",
      messages: [{ role: "user", content: prompt }],
    });

    console.log(
      "[tool:generate_creative_brief] Generated brief:",
      brief.campaign_theme,
      "with",
      brief.variants.length,
      "variants"
    );

    // Save the creative brief to the generation record
    const { error: updateError } = await db
      .from("generations")
      .update({
        creative_brief: brief as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.generationId);

    if (updateError) {
      console.warn(
        "[tool:generate_creative_brief] Failed to save brief:",
        updateError.message
      );
    }

    emitter.send("tool_progress", {
      tool: "generate_creative_brief",
      generationId: context.generationId,
      status: "complete",
      message: `Creative brief ready: ${brief.variants.length} variants`,
    });

    // Build summary for Claude
    const variantSummaries = brief.variants.map(
      (v) =>
        `  ${v.variant_number}. [${v.concept}] "${v.headline}" — CTA: "${v.cta}"`
    );

    const summary = [
      `Creative Brief Generated: "${brief.campaign_theme}"`,
      `Total Variants: ${brief.variants.length}`,
      "",
      "Variants:",
      ...variantSummaries,
    ].join("\n");

    // Build asset outputs so subsequent tools can reference the variants
    const assets: AssetOutput[] = brief.variants.map((v) => ({
      type: "script" as const,
      metadata: {
        variant_number: v.variant_number,
        concept: v.concept,
        headline: v.headline,
        body: v.body,
        cta: v.cta,
        image_prompt: v.image_prompt,
        aspect_ratios: v.aspect_ratios,
      },
    }));

    return {
      success: true,
      content: summary,
      data: brief,
      assets,
    };
  } catch (error) {
    console.error("[tool:generate_creative_brief] Error:", error);
    return {
      success: false,
      content: `Creative brief generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
