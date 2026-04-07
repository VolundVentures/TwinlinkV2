import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { scrapeUrl, scrapeUrlFallback } from "@/lib/external/firecrawl";
import { generateJSON } from "@/lib/ai/claude";
import {
  brandAnalysisPrompt,
  brandAnalysisFromKnowledgePrompt,
} from "@/lib/ai/prompts/brand-analysis";

export const analyzeBrandDefinition: ToolDefinition = {
  name: "analyze_brand",
  description:
    "Analyze a brand by scraping its website and extracting brand identity, colors, voice, target audience, and products. Use this when you need to understand a brand before creating ads.",
  input_schema: {
    type: "object",
    properties: {
      website_url: {
        type: "string",
        description:
          "The brand website URL to scrape and analyze. If not provided, uses the brand URL from context.",
      },
      focus_areas: {
        type: "array",
        items: { type: "string" },
        description:
          "Specific areas to focus the analysis on, e.g. ['visual identity', 'messaging', 'competitors'].",
      },
    },
  },
};

export const analyzeBrand: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const url =
    (input.website_url as string) || context.brand?.website_url || null;
  const focusAreas = (input.focus_areas as string[]) || [];

  console.log("[tool:analyze_brand] Starting brand analysis for:", url);

  if (!url) {
    return {
      success: false,
      content:
        "No website URL provided and no brand website found in context. Please provide a website_url.",
    };
  }

  emitter.send("tool_progress", {
    tool: "analyze_brand",
    generationId: context.generationId,
    status: "scraping",
    message: `Scraping ${url}...`,
  });

  try {
    // Step 1: Scrape the website
    let websiteContent: string | null = null;

    const scrapeResult = await scrapeUrl(url);
    if (scrapeResult.success && scrapeResult.data?.markdown) {
      websiteContent = scrapeResult.data.markdown;
    }

    // Fallback to Jina Reader
    if (!websiteContent) {
      console.log("[tool:analyze_brand] Primary scrape failed, trying fallback");
      websiteContent = await scrapeUrlFallback(url);
    }

    emitter.send("tool_progress", {
      tool: "analyze_brand",
      generationId: context.generationId,
      status: "analyzing",
      message: "Analyzing brand identity...",
    });

    // Step 2: Generate brand analysis
    let prompt: string;

    if (websiteContent) {
      // Truncate to stay within reasonable limits
      const truncated = websiteContent.slice(0, 15000);
      prompt = brandAnalysisPrompt(truncated, url);
    } else {
      // Fallback: use Claude's knowledge
      console.log(
        "[tool:analyze_brand] No website content, using knowledge-based analysis"
      );
      const brandName = context.brand?.name || new URL(url).hostname;
      prompt = brandAnalysisFromKnowledgePrompt(brandName, url);
    }

    // Append focus areas if provided
    const focusInstruction =
      focusAreas.length > 0
        ? `\n\nPay special attention to these areas: ${focusAreas.join(", ")}`
        : "";

    const analysis = await generateJSON<Record<string, unknown>>({
      model: "claude-opus-4-6",
      system:
        "You are a brand analyst. Return comprehensive brand analysis as JSON.",
      messages: [
        {
          role: "user",
          content: prompt + focusInstruction,
        },
      ],
    });

    console.log("[tool:analyze_brand] Analysis complete for:", analysis.name);

    emitter.send("tool_progress", {
      tool: "analyze_brand",
      generationId: context.generationId,
      status: "complete",
      message: "Brand analysis complete",
    });

    // Build a readable summary for Claude
    const summary = [
      `Brand Analysis for ${analysis.name || url}:`,
      `- Industry: ${analysis.industry || "Unknown"}`,
      `- Description: ${analysis.description || "N/A"}`,
      `- Brand Voice: ${analysis.brand_voice || "N/A"}`,
      `- Target Audience: ${analysis.target_audience || "N/A"}`,
      `- Primary Color: ${analysis.primary_color || "N/A"}`,
      `- Accent Color: ${analysis.accent_color || "N/A"}`,
      `- Tagline: ${analysis.tagline || "N/A"}`,
      `- Products: ${
        Array.isArray(analysis.products)
          ? (analysis.products as Array<{ name: string }>)
              .map((p) => p.name)
              .join(", ")
          : "N/A"
      }`,
      `- Key Messages: ${
        Array.isArray(analysis.key_messages)
          ? (analysis.key_messages as string[]).join("; ")
          : "N/A"
      }`,
    ].join("\n");

    return {
      success: true,
      content: summary,
      data: analysis,
    };
  } catch (error) {
    console.error("[tool:analyze_brand] Error:", error);
    return {
      success: false,
      content: `Brand analysis failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
