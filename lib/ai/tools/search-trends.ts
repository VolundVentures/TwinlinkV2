import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { scrapeUrl, scrapeUrlFallback } from "@/lib/external/firecrawl";

export const searchTrendsDefinition: ToolDefinition = {
  name: "search_trends",
  description:
    "Search for current marketing trends, industry insights, and popular content topics. Scrapes relevant sources to gather trend data that can inform ad creative decisions. Costs 1 credit.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Search query for trends (e.g. 'fitness app marketing trends 2024', 'beauty industry social media ads').",
      },
      industry: {
        type: "string",
        description:
          "Industry context to refine the search (e.g. 'health', 'fashion', 'tech', 'food').",
      },
    },
    required: ["query"],
  },
};

export const searchTrends: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const query = input.query as string;
  const industry =
    (input.industry as string) || context.brand?.industry || "";

  console.log(
    "[tool:search_trends] Query:",
    query,
    "industry:",
    industry
  );

  emitter.send("tool_progress", {
    tool: "search_trends",
    generationId: context.generationId,
    status: "searching",
    message: `Searching trends: "${query}"...`,
  });

  try {
    // Build a search URL to scrape
    const searchQuery = industry
      ? `${query} ${industry} marketing trends`
      : `${query} marketing trends`;
    const encodedQuery = encodeURIComponent(searchQuery);
    const searchUrl = `https://www.google.com/search?q=${encodedQuery}`;

    // Try primary scraper
    let content: string | null = null;

    const scrapeResult = await scrapeUrl(searchUrl);
    if (scrapeResult.success && scrapeResult.data?.markdown) {
      content = scrapeResult.data.markdown;
    }

    // Fallback to Jina Reader
    if (!content) {
      console.log(
        "[tool:search_trends] Primary scrape failed, trying fallback"
      );
      content = await scrapeUrlFallback(searchUrl);
    }

    if (!content) {
      console.log(
        "[tool:search_trends] All scrapers failed, returning unavailable message"
      );

      emitter.send("tool_progress", {
        tool: "search_trends",
        generationId: context.generationId,
        status: "complete",
        message: "Trends search completed with limited results",
      });

      return {
        success: false,
        content:
          "Trends search is not available right now. The scraping service could not retrieve results. You can proceed with your existing knowledge about the industry and brand.",
      };
    }

    // Truncate content to a reasonable size
    const truncated = content.slice(0, 10000);

    console.log(
      "[tool:search_trends] Content retrieved, length:",
      truncated.length
    );

    emitter.send("tool_progress", {
      tool: "search_trends",
      generationId: context.generationId,
      status: "complete",
      message: "Trends research complete",
    });

    const summary = [
      `Trends Research: "${query}"${industry ? ` (${industry})` : ""}`,
      "",
      "Findings:",
      truncated,
    ].join("\n");

    return {
      success: true,
      content: summary,
      data: {
        query,
        industry,
        raw_content_length: content.length,
      },
    };
  } catch (error) {
    console.error("[tool:search_trends] Error:", error);
    return {
      success: false,
      content: `Trends search failed: ${error instanceof Error ? error.message : String(error)}. You can proceed with your existing knowledge about the industry.`,
    };
  }
};
