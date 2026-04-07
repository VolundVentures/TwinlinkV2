import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { fullCompetitorResearch } from "@/lib/external/meta-ads";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const { name, industry, country } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "Competitor name is required" },
        { status: 400 }
      );
    }

    // Run full research pipeline (Meta scraping + Google scraping + Claude)
    const analysis = await fullCompetitorResearch(
      name,
      industry || "general",
      { country }
    );

    // Save competitor profile
    const { data: profile } = await db
      .from("competitor_profiles")
      .insert({
        org_id: auth.orgId,
        name: analysis.competitor_name,
        industry: analysis.industry,
        analysis: analysis.insights,
        ad_count: analysis.ad_count,
        avg_score: analysis.score,
      })
      .select("id")
      .single();

    // Save individual ads if any were scraped
    if (profile && analysis.ads.length > 0) {
      await db.from("competitor_ads").insert(
        analysis.ads.map((ad) => ({
          competitor_id: profile.id,
          org_id: auth.orgId,
          body_text: ad.ad_text,
          headline: ad.headline || null,
          cta: ad.cta || null,
          ad_type: ad.media_type || null,
          started_running: ad.started_running || null,
          analysis: {},
        }))
      );
    }

    return NextResponse.json({ analysis, profileId: profile?.id });
  } catch (error) {
    console.error("Competitor search error:", error);
    return NextResponse.json(
      { error: "Competitor research failed" },
      { status: 500 }
    );
  }
}
