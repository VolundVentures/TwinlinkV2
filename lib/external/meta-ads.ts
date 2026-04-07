/**
 * Competitor Ad Library via ScrapeCreators API.
 *
 * Replaces broken Firecrawl scraping with real API data from:
 * - Facebook Ad Library (via ScrapeCreators)
 * - LinkedIn Ad Library (via ScrapeCreators)
 * - Google Ad Library (via ScrapeCreators)
 * - Claude analysis (enriched with real scraped data)
 */

import { generateJSON } from "@/lib/ai/claude";

const SCRAPECREATORS_BASE = "https://api.scrapecreators.com";

function scrapecreatorHeaders(): Record<string, string> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;
  if (!apiKey) {
    throw new Error("SCRAPECREATORS_API_KEY not set. Add it to your .env file.");
  }
  return {
    "x-api-key": apiKey,
    "Content-Type": "application/json",
  };
}

// ============================================
// Types
// ============================================

export type CompetitorAd = {
  page_name: string;
  ad_text: string;
  headline?: string;
  cta?: string;
  started_running?: string;
  platform: string;
  media_type?: string;
  snapshot_url?: string;
  // Enhanced fields
  score?: number;
  run_duration_days?: number;
  composition_type?: string;
  visual_description?: string;
  ad_id?: string;
  video_url?: string;
  video_transcript?: string;
};

export type CompetitorAnalysis = {
  competitor_name: string;
  industry: string;
  ad_count: number;
  ads: CompetitorAd[];
  insights: {
    messaging_themes: string[];
    visual_patterns: string[];
    cta_patterns: string[];
    target_audience_signals: string[];
    strengths: string[];
    weaknesses: string[];
  };
  score: number;
};

// ============================================
// ScrapeCreators — Facebook Ad Library
// ============================================

/**
 * Search Facebook Ad Library via ScrapeCreators API.
 * Returns real ad data with creative snapshots, ad text, CTA, run dates.
 */
export async function searchCompetitorAds(
  query: string,
  options: {
    country?: string;
    limit?: number;
  } = {}
): Promise<{ ads: CompetitorAd[]; raw: string | null }> {
  const { country = "", limit = 20 } = options;

  try {
    const params = new URLSearchParams({
      query,
      status: "active",
    });
    if (country) params.set("country", country);

    const url = `${SCRAPECREATORS_BASE}/v1/facebook/adLibrary/search/ads?${params}`;
    console.log("[meta-ads] Searching Facebook Ad Library via ScrapeCreators:", query);

    const res = await fetch(url, { headers: scrapecreatorHeaders() });

    if (!res.ok) {
      const error = await res.text();
      console.error("[meta-ads] ScrapeCreators Facebook error:", res.status, error);
      return { ads: [], raw: error };
    }

    const data = await res.json();
    const rawAds = Array.isArray(data) ? data : data.data || data.ads || data.results || [];

    const ads: CompetitorAd[] = rawAds.slice(0, limit).map((ad: Record<string, unknown>) => {
      // Calculate run duration score
      const startDate = ad.start_date || ad.started_running || ad.ad_delivery_start_time;
      let runDurationDays = 0;
      if (startDate) {
        const start = new Date(startDate as string);
        runDurationDays = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Score: longer running ads are more successful (6+ months = high score)
      let score = 30; // base
      if (runDurationDays > 180) score = 90;
      else if (runDurationDays > 90) score = 75;
      else if (runDurationDays > 30) score = 60;
      else if (runDurationDays > 7) score = 45;

      // Extract snapshot/creative URL
      const snapshotUrl = ad.snapshot || ad.snapshot_url || ad.ad_snapshot_url ||
        ad.image_url || ad.creative_url || ad.thumbnail_url || null;

      return {
        page_name: (ad.page_name || ad.advertiser_name || ad.page || query) as string,
        ad_text: (ad.ad_text || ad.body || ad.ad_creative_body || ad.description || "") as string,
        headline: (ad.headline || ad.ad_creative_link_title || ad.title || "") as string,
        cta: (ad.cta_text || ad.cta || ad.call_to_action || ad.ad_creative_link_caption || "") as string,
        started_running: (startDate || "") as string,
        platform: (ad.publisher_platform || "meta") as string,
        media_type: (ad.media_type || ad.ad_type || "image") as string,
        snapshot_url: snapshotUrl as string | undefined,
        video_url: (ad.video_url || ad.video_hd_url || ad.video_sd_url) as string | undefined,
        video_transcript: (ad.video_transcript || ad.transcript) as string | undefined,
        ad_id: (ad.ad_archive_id || ad.id || ad.ad_id) as string | undefined,
        score,
        run_duration_days: runDurationDays,
      };
    });

    console.log(`[meta-ads] Found ${ads.length} Facebook ads for "${query}"`);
    return { ads, raw: JSON.stringify(data).slice(0, 5000) };
  } catch (error) {
    console.error("[meta-ads] Facebook Ad Library search error:", error);
    return { ads: [], raw: null };
  }
}

// ============================================
// ScrapeCreators — LinkedIn Ad Library
// ============================================

export async function searchLinkedInAds(
  company: string,
  options: { countries?: string } = {}
): Promise<{ ads: CompetitorAd[]; raw: string | null }> {
  try {
    const params = new URLSearchParams({ company });
    if (options.countries) params.set("countries", options.countries);

    const url = `${SCRAPECREATORS_BASE}/v1/linkedin/ads/search?${params}`;
    console.log("[meta-ads] Searching LinkedIn Ad Library via ScrapeCreators:", company);

    const res = await fetch(url, { headers: scrapecreatorHeaders() });

    if (!res.ok) {
      const error = await res.text();
      console.error("[meta-ads] ScrapeCreators LinkedIn error:", res.status, error);
      return { ads: [], raw: error };
    }

    const data = await res.json();
    const rawAds = Array.isArray(data) ? data : data.data || data.ads || data.results || [];

    const ads: CompetitorAd[] = rawAds.slice(0, 20).map((ad: Record<string, unknown>) => ({
      page_name: (ad.advertiser_name || ad.company || company) as string,
      ad_text: (ad.description || ad.body || ad.ad_text || "") as string,
      headline: (ad.headline || ad.title || "") as string,
      cta: (ad.cta || ad.call_to_action || "") as string,
      started_running: (ad.start_date || "") as string,
      platform: "linkedin",
      media_type: (ad.media_type || ad.format || "image") as string,
      snapshot_url: (ad.image_url || ad.creative_url || ad.thumbnail || "") as string,
      ad_id: (ad.ad_id || ad.id) as string | undefined,
      score: 50,
    }));

    console.log(`[meta-ads] Found ${ads.length} LinkedIn ads for "${company}"`);
    return { ads, raw: JSON.stringify(data).slice(0, 5000) };
  } catch (error) {
    console.error("[meta-ads] LinkedIn Ad Library search error:", error);
    return { ads: [], raw: null };
  }
}

// ============================================
// ScrapeCreators — Google Ad Library
// ============================================

export async function searchGoogleAds(
  advertiserName: string
): Promise<{ ads: CompetitorAd[]; raw: string | null }> {
  try {
    // Google endpoint requires 'domain' or 'advertiser_id', NOT 'query'
    // Try to construct a domain from the advertiser name (e.g., "Nike" → "nike.com")
    const domain = advertiserName.toLowerCase().replace(/\s+/g, "") + ".com";
    const params = new URLSearchParams({ domain });
    const url = `${SCRAPECREATORS_BASE}/v1/google/company/ads?${params}`;
    console.log("[meta-ads] Searching Google Ad Library via ScrapeCreators:", advertiserName, "domain:", domain);

    const res = await fetch(url, { headers: scrapecreatorHeaders() });

    if (!res.ok) {
      const error = await res.text();
      console.error("[meta-ads] ScrapeCreators Google error:", res.status, error);
      return { ads: [], raw: error };
    }

    const data = await res.json();
    const rawAds = Array.isArray(data) ? data : data.data || data.ads || data.results || [];

    const ads: CompetitorAd[] = rawAds.slice(0, 20).map((ad: Record<string, unknown>) => ({
      page_name: (ad.advertiser_name || ad.company || advertiserName) as string,
      ad_text: (ad.ad_text || ad.body || ad.description || "") as string,
      headline: (ad.headline || ad.title || "") as string,
      cta: (ad.cta || "") as string,
      platform: "google",
      media_type: (ad.media_type || ad.format || "text") as string,
      snapshot_url: (ad.image_url || ad.creative_url || "") as string,
      ad_id: (ad.ad_id || ad.id) as string | undefined,
      score: 50,
    }));

    console.log(`[meta-ads] Found ${ads.length} Google ads for "${advertiserName}"`);
    return { ads, raw: JSON.stringify(data).slice(0, 5000) };
  } catch (error) {
    console.error("[meta-ads] Google Ad Library search error:", error);
    return { ads: [], raw: null };
  }
}

// ============================================
// ScrapeCreators — Company Search (find page IDs)
// ============================================

export async function searchCompanyPages(
  query: string
): Promise<Array<{ name: string; page_id: string }>> {
  try {
    const url = `${SCRAPECREATORS_BASE}/v1/facebook/adLibrary/search/companies?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: scrapecreatorHeaders() });

    if (!res.ok) return [];

    const data = await res.json();
    const results = Array.isArray(data) ? data : data.data || data.results || [];

    return results.slice(0, 10).map((c: Record<string, unknown>) => ({
      name: (c.name || c.page_name || query) as string,
      page_id: (c.page_id || c.id || "") as string,
    }));
  } catch {
    return [];
  }
}

// ============================================
// Claude Analysis (enriched with real data)
// ============================================

export async function analyzeCompetitorWithClaude(
  competitorName: string,
  industry: string,
  existingAds: CompetitorAd[] = []
): Promise<CompetitorAnalysis> {
  const adsContext =
    existingAds.length > 0
      ? `\n\nHere are ${existingAds.length} REAL ads we scraped from ad libraries:\n${JSON.stringify(existingAds.slice(0, 15), null, 2)}`
      : "";

  const analysis = await generateJSON<CompetitorAnalysis>({
    model: "claude-sonnet-4-6",
    system: `You are a competitive intelligence analyst specializing in digital advertising. Analyze the competitor and provide actionable insights for ad creative strategy. When real ad data is provided, base your analysis on the ACTUAL ads, not assumptions.`,
    messages: [
      {
        role: "user",
        content: `Analyze "${competitorName}" in the ${industry} industry as a competitor.${adsContext}

Provide a comprehensive analysis with:
1. Their typical messaging themes and value propositions
2. Visual patterns they tend to use in ads (colors, layouts, imagery style)
3. Common CTAs they use
4. Signals about their target audience
5. Strengths in their ad strategy
6. Weaknesses/gaps we could exploit
7. An overall score from 0-100 rating the quality/sophistication of their ad strategy

Return JSON:
{
  "competitor_name": "${competitorName}",
  "industry": "${industry}",
  "ad_count": <number of ads analyzed>,
  "ads": [],
  "insights": {
    "messaging_themes": ["theme1", "theme2"],
    "visual_patterns": ["pattern1", "pattern2"],
    "cta_patterns": ["cta1", "cta2"],
    "target_audience_signals": ["signal1", "signal2"],
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"]
  },
  "score": <0-100>
}`,
      },
    ],
  });

  return analysis;
}

// ============================================
// Full Research Pipeline
// ============================================

/**
 * Full competitor research:
 * 1. Facebook Ad Library via ScrapeCreators
 * 2. LinkedIn Ad Library via ScrapeCreators
 * 3. Google Ad Library via ScrapeCreators
 * 4. Claude analysis enriched with real ad data
 */
export async function fullCompetitorResearch(
  competitorName: string,
  industry: string,
  options: { country?: string } = {}
): Promise<CompetitorAnalysis> {
  // Run all ad library searches in parallel
  const [metaResult, linkedinResult, googleResult] = await Promise.allSettled([
    searchCompetitorAds(competitorName, { country: options.country }),
    searchLinkedInAds(competitorName),
    searchGoogleAds(competitorName),
  ]);

  const allAds: CompetitorAd[] = [];

  if (metaResult.status === "fulfilled") {
    allAds.push(...metaResult.value.ads);
  }
  if (linkedinResult.status === "fulfilled") {
    allAds.push(...linkedinResult.value.ads);
  }
  if (googleResult.status === "fulfilled") {
    allAds.push(...googleResult.value.ads);
  }

  console.log(`[meta-ads] Total ads collected: ${allAds.length} (Meta: ${metaResult.status === "fulfilled" ? metaResult.value.ads.length : 0}, LinkedIn: ${linkedinResult.status === "fulfilled" ? linkedinResult.value.ads.length : 0}, Google: ${googleResult.status === "fulfilled" ? googleResult.value.ads.length : 0})`);

  // Claude analysis enriched with real scraped ads
  const analysis = await analyzeCompetitorWithClaude(
    competitorName,
    industry,
    allAds
  );

  // Merge scraped ads into the analysis
  if (allAds.length > 0) {
    analysis.ads = allAds;
    analysis.ad_count = allAds.length;
  }

  return analysis;
}
