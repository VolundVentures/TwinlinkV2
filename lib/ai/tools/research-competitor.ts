import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { fullCompetitorResearch, type CompetitorAd } from "@/lib/external/meta-ads";
import { generateJSON } from "@/lib/ai/claude";
import { db } from "@/lib/db";

export const researchCompetitorDefinition: ToolDefinition = {
  name: "research_competitor",
  description:
    "Research a competitor's advertising strategy. Scrapes Meta Ad Library and Google Ads Transparency Center, scores each ad (0-100), detects visual composition types (social proof grid, UGC testimonial, product hero, etc.), and returns actionable competitive insights. Use this to build an ad library of competitor creatives that can be replicated. Costs 3 credits.",
  input_schema: {
    type: "object",
    properties: {
      competitor_name: {
        type: "string",
        description: "The name of the competitor brand to research.",
      },
      industry: {
        type: "string",
        description: "The industry the competitor operates in.",
      },
      country: {
        type: "string",
        description: "ISO country code to filter ads by region (e.g. 'US', 'SA', 'AE').",
      },
    },
    required: ["competitor_name"],
  },
};

/**
 * Score an ad based on longevity and content quality.
 * Longer-running ads score higher (they're working).
 */
function scoreAd(ad: CompetitorAd): number {
  let score = 50; // base

  // Longevity bonus: longer run = higher score
  if (ad.started_running) {
    const startDate = new Date(ad.started_running);
    const daysSinceStart = Math.max(0, (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceStart > 180) score += 30;      // 6+ months = excellent
    else if (daysSinceStart > 90) score += 25;   // 3-6 months = great
    else if (daysSinceStart > 30) score += 15;   // 1-3 months = good
    else if (daysSinceStart > 7) score += 5;     // 1+ week = decent
    ad.run_duration_days = Math.round(daysSinceStart);
  }

  // Content quality bonus
  if (ad.headline && ad.headline.length > 5) score += 5;
  if (ad.cta) score += 5;
  if (ad.ad_text && ad.ad_text.length > 50) score += 5;
  if (ad.media_type === "video") score += 5;

  return Math.min(100, score);
}

export const researchCompetitor: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const competitorName = input.competitor_name as string;
  const industry = (input.industry as string) || context.brand?.industry || "general";
  const country = (input.country as string) || undefined;

  console.log("[tool:research_competitor] Researching:", competitorName, "in", industry);

  emitter.send("tool_progress", {
    tool: "research_competitor",
    generationId: context.generationId,
    status: "scraping",
    message: `Finding ${competitorName} ads across Meta and Google...`,
  });

  try {
    const analysis = await fullCompetitorResearch(competitorName, industry, { country });

    emitter.send("tool_progress", {
      tool: "research_competitor",
      generationId: context.generationId,
      status: "analyzing",
      message: `Scoring ${analysis.ad_count} ads and detecting compositions...`,
    });

    // Score each ad
    const scoredAds = analysis.ads.map((ad) => ({
      ...ad,
      score: scoreAd(ad),
    }));

    // Sort by score descending
    scoredAds.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Detect composition types via Claude
    if (scoredAds.length > 0) {
      try {
        const compositions = await generateJSON<{ ads: Array<{ index: number; composition_type: string; visual_description: string }> }>({
          model: "claude-opus-4-6",
          maxTokens: 4096,
          system: "You analyze ad creatives and detect their visual composition type. Be specific about the layout pattern.",
          messages: [{
            role: "user",
            content: `Analyze these ${Math.min(scoredAds.length, 15)} ads and classify their visual composition type.

For each ad, assign one composition_type from this list:
- "social_proof_grid" (testimonials, reviews, star ratings)
- "ugc_testimonial" (person speaking to camera / selfie style)
- "product_hero" (product front-and-center, clean background)
- "lifestyle_scene" (product in real-life context)
- "before_after" (transformation comparison)
- "data_driven" (stats, numbers, charts featured)
- "text_heavy" (bold text/headlines as the main creative)
- "carousel_story" (multi-slide narrative)
- "video_montage" (fast cuts, multiple scenes)
- "meme_native" (meme format, relatable humor)
- "editorial" (magazine/editorial aesthetic)
- "other"

Also provide a brief visual_description of each ad's layout.

Ads:
${scoredAds.slice(0, 15).map((ad, i) => `[${i}] "${ad.headline || ad.ad_text?.slice(0, 80)}" (${ad.media_type || "image"}, ${ad.page_name})`).join("\n")}

Return: {"ads": [{"index": 0, "composition_type": "...", "visual_description": "..."}]}`,
          }],
        });

        // Merge composition types back into scored ads
        for (const comp of compositions.ads) {
          if (scoredAds[comp.index]) {
            scoredAds[comp.index].composition_type = comp.composition_type;
            scoredAds[comp.index].visual_description = comp.visual_description;
          }
        }
      } catch (err) {
        console.warn("[tool:research_competitor] Composition detection failed:", err);
      }
    }

    emitter.send("tool_progress", {
      tool: "research_competitor",
      generationId: context.generationId,
      status: "saving",
      message: "Saving competitor profile and ads...",
    });

    // Save competitor profile
    const { data: savedProfile } = await db
      .from("competitor_profiles")
      .upsert(
        {
          org_id: context.orgId,
          name: competitorName,
          industry,
          analysis: analysis.insights,
          ad_count: scoredAds.length || analysis.ad_count,
          avg_score: scoredAds.length > 0
            ? Math.round(scoredAds.reduce((s, a) => s + (a.score || 0), 0) / scoredAds.length)
            : analysis.score,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,name" }
      )
      .select("id")
      .single();

    // Save individual ads to competitor_ads table
    if (savedProfile?.id && scoredAds.length > 0) {
      const adRows = scoredAds.slice(0, 30).map((ad) => ({
        competitor_profile_id: savedProfile.id,
        org_id: context.orgId,
        page_name: ad.page_name,
        headline: ad.headline || null,
        body_text: ad.ad_text || null,
        cta: ad.cta || null,
        platform: ad.platform,
        media_type: ad.media_type || "image",
        creative_url: ad.snapshot_url || null,
        score: ad.score || 50,
        started_running: ad.started_running || null,
        analysis: {
          composition_type: ad.composition_type || "other",
          visual_description: ad.visual_description || "",
          run_duration_days: ad.run_duration_days || 0,
        },
      }));

      try {
        await db.from("competitor_ads").insert(adRows);
      } catch (err) {
        console.warn("[tool:research_competitor] Failed to save ads:", err);
      }
    }

    emitter.send("tool_progress", {
      tool: "research_competitor",
      generationId: context.generationId,
      status: "complete",
      message: `Found ${scoredAds.length} ads, avg score: ${Math.round(scoredAds.reduce((s, a) => s + (a.score || 0), 0) / Math.max(scoredAds.length, 1))}`,
    });

    // Build rich summary
    const topAds = scoredAds.slice(0, 5);
    const compositionBreakdown: Record<string, number> = {};
    scoredAds.forEach((ad) => {
      const type = ad.composition_type || "other";
      compositionBreakdown[type] = (compositionBreakdown[type] || 0) + 1;
    });

    const insights = analysis.insights;
    const summary = [
      `## Competitor Research: ${competitorName}`,
      `**Industry:** ${industry} | **Ads Found:** ${scoredAds.length} | **Avg Score:** ${Math.round(scoredAds.reduce((s, a) => s + (a.score || 0), 0) / Math.max(scoredAds.length, 1))}/100`,
      "",
      "### Top Performing Ads",
      ...topAds.map((ad, i) => `${i + 1}. **${ad.headline || ad.ad_text?.slice(0, 60) || "Untitled"}** — Score: ${ad.score}/100, ${ad.composition_type || "unknown"} composition${ad.run_duration_days ? `, running ${ad.run_duration_days}d` : ""}`),
      "",
      "### Composition Types Detected",
      ...Object.entries(compositionBreakdown).map(([type, count]) => `- **${type.replace(/_/g, " ")}**: ${count} ads`),
      "",
      `### Key Insights`,
      `**Messaging:** ${insights.messaging_themes.join(", ")}`,
      `**Visual Patterns:** ${insights.visual_patterns.join(", ")}`,
      `**CTAs:** ${insights.cta_patterns.join(", ")}`,
      `**Strengths:** ${insights.strengths.join("; ")}`,
      `**Weaknesses:** ${insights.weaknesses.join("; ")}`,
    ].join("\n");

    return {
      success: true,
      content: summary,
      data: {
        ...analysis,
        ads: scoredAds,
        composition_breakdown: compositionBreakdown,
      },
    };
  } catch (error) {
    console.error("[tool:research_competitor] Error:", error);
    return {
      success: false,
      content: `Competitor research failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
