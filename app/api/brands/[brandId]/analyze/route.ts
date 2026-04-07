import { NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai/claude";
import { scrapeUrl, scrapeUrlFallback } from "@/lib/external/firecrawl";
import {
  brandAnalysisPrompt,
  brandAnalysisFromKnowledgePrompt,
} from "@/lib/ai/prompts/brand-analysis";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    let websiteContent: string | null = null;

    // Try Firecrawl first
    const scrapeResult = await scrapeUrl(url);
    if (scrapeResult.success && scrapeResult.data?.markdown) {
      websiteContent = scrapeResult.data.markdown;
    }

    // Fallback to Jina Reader
    if (!websiteContent) {
      websiteContent = await scrapeUrlFallback(url);
    }

    let prompt: string;
    if (websiteContent) {
      // Truncate to avoid token limits
      const truncated = websiteContent.slice(0, 8000);
      prompt = brandAnalysisPrompt(truncated, url);
    } else {
      // Fallback to Claude's knowledge
      const brandName = new URL(url).hostname.replace("www.", "").split(".")[0];
      prompt = brandAnalysisFromKnowledgePrompt(brandName, url);
    }

    const brand = await generateJSON<{
      name: string;
      description: string;
      industry: string;
      primary_color: string | null;
      secondary_color: string | null;
      accent_color: string | null;
      brand_voice: string;
      target_audience: string;
      products: Array<{ name: string; description: string; type: string }>;
      tagline: string | null;
      key_messages: string[];
    }>({
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: prompt }],
      system:
        "You are a brand analyst AI. Always respond with valid JSON only.",
    });

    return NextResponse.json({
      brand,
      scraped: !!websiteContent,
    });
  } catch (error) {
    console.error("Brand analysis error:", error);
    return NextResponse.json(
      { error: "Brand analysis failed" },
      { status: 500 }
    );
  }
}
