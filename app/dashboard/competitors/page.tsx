"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n/use-translations";
import {
  Search,
  Loader2,
  Target,
  TrendingUp,
  Eye,
  MessageSquare,
  Zap,
  AlertTriangle,
  Clock,
  BarChart3,
  Megaphone,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { CompetitorProfile } from "@/lib/database.types";

type CompetitorAd = {
  page_name: string;
  ad_text: string;
  headline?: string;
  cta?: string;
  started_running?: string;
  platform: string;
  media_type?: string;
};

type CompetitorInsights = {
  messaging_themes: string[];
  visual_patterns: string[];
  cta_patterns: string[];
  target_audience_signals: string[];
  strengths: string[];
  weaknesses: string[];
};

type CompetitorAnalysis = {
  competitor_name: string;
  industry: string;
  ad_count: number;
  ads: CompetitorAd[];
  insights: CompetitorInsights;
  score: number;
};

type ResearchResult = {
  analysis: CompetitorAnalysis;
  profileId?: string;
};

const PROGRESS_MESSAGES = [
  "Searching Meta Ad Library...",
  "Scanning Google Ads Transparency Center...",
  "Extracting ad creatives...",
  "Analyzing messaging patterns...",
  "Identifying visual strategies...",
  "Evaluating CTA effectiveness...",
  "Compiling competitive intelligence...",
  "Generating final report...",
];

const TAG_COLORS = [
  "badge-green",
  "badge-purple",
  "badge-coral",
  "badge-blue",
];

export default function CompetitorsPage() {
  const { t } = useTranslation();

  // Search form state
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");

  // Research state
  const [loading, setLoading] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);

  // Past research state
  const [pastProfiles, setPastProfiles] = useState<CompetitorProfile[]>([]);
  const [loadingPast, setLoadingPast] = useState(true);
  const [expandedPastId, setExpandedPastId] = useState<string | null>(null);

  // Ads expansion
  const [showAllAds, setShowAllAds] = useState(false);

  // Cycle through progress messages during loading
  useEffect(() => {
    if (!loading) return;
    setProgressIndex(0);
    const interval = setInterval(() => {
      setProgressIndex((prev) => {
        if (prev < PROGRESS_MESSAGES.length - 1) return prev + 1;
        return prev;
      });
    }, 3500);
    return () => clearInterval(interval);
  }, [loading]);

  // Load past research results
  const loadPastResearch = useCallback(async () => {
    try {
      const res = await fetch("/api/competitors");
      if (res.ok) {
        const data = await res.json();
        setPastProfiles(data.profiles || []);
      }
    } catch {
      // silently fail for past research
    } finally {
      setLoadingPast(false);
    }
  }, []);

  useEffect(() => {
    loadPastResearch();
  }, [loadPastResearch]);

  async function handleResearch(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setShowAllAds(false);

    try {
      const res = await fetch("/api/competitors/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          industry: industry.trim() || undefined,
          country: country.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Research failed. Please try again.");
      }

      const data: ResearchResult = await res.json();
      setResult(data);

      // Refresh past research list
      loadPastResearch();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function getScoreBadge(score: number) {
    if (score >= 80) return "bg-[#4D5D4B] text-white";
    if (score >= 60) return "bg-[#6C5CE7] text-white";
    if (score >= 40) return "bg-[#74B9FF] text-white";
    return "bg-[#D1D5DB] text-[#1A1A1A]";
  }

  function renderTagPills(items: string[]) {
    if (!items || items.length === 0) {
      return <p className="text-[14px] text-[#9CA3AF] italic">No data available</p>;
    }
    return (
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={i}
            className={`${TAG_COLORS[i % TAG_COLORS.length]} rounded-full px-3 py-1 text-[13px] font-medium`}
          >
            {item}
          </span>
        ))}
      </div>
    );
  }

  function renderBulletList(items: string[]) {
    if (!items || items.length === 0) {
      return <p className="text-[14px] text-[#9CA3AF] italic">No data available</p>;
    }
    return (
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[14px] text-[#6B7280]">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D1D5DB]" />
            {item}
          </li>
        ))}
      </ul>
    );
  }

  function renderInsightsCard(
    icon: React.ReactNode,
    title: string,
    content: React.ReactNode
  ) {
    return (
      <div className="rounded-2xl border border-[#F0F0F0] bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          {icon}
          <h3 className="text-[15px] font-semibold text-[#1A1A1A]">{title}</h3>
        </div>
        {content}
      </div>
    );
  }

  function renderAnalysis(analysis: CompetitorAnalysis) {
    const { insights, ads } = analysis;
    const displayedAds = showAllAds ? ads : ads.slice(0, 3);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[20px] font-bold text-[#1A1A1A]">
              {analysis.competitor_name}
            </h2>
            <p className="text-[14px] text-[#6B7280]">
              {analysis.industry} &middot; {analysis.ad_count} ad
              {analysis.ad_count !== 1 ? "s" : ""} analyzed
            </p>
          </div>
          <div
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[14px] font-bold ${getScoreBadge(
              analysis.score
            )}`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            {analysis.score}/100
          </div>
        </div>

        {/* Insights Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {renderInsightsCard(
            <MessageSquare className="h-4 w-4 text-[#6C5CE7]" />,
            "Messaging Themes",
            renderTagPills(insights.messaging_themes)
          )}

          {renderInsightsCard(
            <Eye className="h-4 w-4 text-[#74B9FF]" />,
            "Visual Patterns",
            renderTagPills(insights.visual_patterns)
          )}

          {renderInsightsCard(
            <Megaphone className="h-4 w-4 text-[#FF7675]" />,
            "CTA Patterns",
            renderTagPills(insights.cta_patterns)
          )}

          {renderInsightsCard(
            <Target className="h-4 w-4 text-[#4D5D4B]" />,
            "Target Audience Signals",
            renderTagPills(insights.target_audience_signals)
          )}

          {renderInsightsCard(
            <TrendingUp className="h-4 w-4 text-[#4D5D4B]" />,
            "Strengths",
            renderBulletList(insights.strengths)
          )}

          {renderInsightsCard(
            <AlertTriangle className="h-4 w-4 text-[#FF7675]" />,
            "Weaknesses & Opportunities",
            renderBulletList(insights.weaknesses)
          )}
        </div>

        {/* Individual Ads */}
        {ads && ads.length > 0 && (
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-[#1A1A1A]">
              <Zap className="h-4 w-4 text-[#FBBF24]" />
              Ads Found ({ads.length})
            </h3>
            <div className="space-y-3">
              {displayedAds.map((ad, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-[#F0F0F0] bg-white p-5"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[14px] font-medium text-[#1A1A1A]">
                      {ad.page_name}
                    </span>
                    <div className="flex items-center gap-2">
                      {ad.platform && (
                        <span className="badge-blue rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider">
                          {ad.platform}
                        </span>
                      )}
                      {ad.media_type && (
                        <span className="badge-purple rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider">
                          {ad.media_type}
                        </span>
                      )}
                    </div>
                  </div>
                  {ad.headline && (
                    <p className="mb-1 text-[15px] font-medium text-[#1A1A1A]">
                      {ad.headline}
                    </p>
                  )}
                  <p className="text-[14px] text-[#6B7280] line-clamp-3">
                    {ad.ad_text}
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    {ad.cta && (
                      <span className="badge-green rounded-full px-3 py-0.5 text-[13px] font-medium">
                        CTA: {ad.cta}
                      </span>
                    )}
                    {ad.started_running && (
                      <span className="flex items-center gap-1 text-[13px] text-[#9CA3AF]">
                        <Clock className="h-3 w-3" />
                        {ad.started_running}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {ads.length > 3 && (
              <button
                onClick={() => setShowAllAds(!showAllAds)}
                className="flex items-center gap-1 text-[14px] text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
              >
                {showAllAds ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Show all {ads.length} ads
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-[28px] font-bold text-[#1A1A1A]">{t.nav.competitors}</h1>
        <p className="mt-1 text-[15px] text-[#6B7280]">
          Analyze competitor ad strategies from Meta and Google ad libraries
        </p>
      </div>

      {/* Search Form */}
      <div className="rounded-2xl border border-[#F0F0F0] bg-white p-6 shadow-soft">
        <form onSubmit={handleResearch} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="mb-1.5 block text-[13px] font-medium text-[#6B7280]">
                Competitor Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nike, Airbnb, Shopify"
                className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] focus:border-[#4D5D4B] focus:outline-none focus:ring-1 focus:ring-[#4D5D4B]/20"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#6B7280]">
                Industry
              </label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. ecommerce, SaaS, fitness"
                className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] focus:border-[#4D5D4B] focus:outline-none focus:ring-1 focus:ring-[#4D5D4B]/20"
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#6B7280]">
                Country
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. US, AE, SA"
                className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] focus:border-[#4D5D4B] focus:outline-none focus:ring-1 focus:ring-[#4D5D4B]/20"
                disabled={loading}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {loading ? "Researching..." : "Research"}
            </button>
          </div>
        </form>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="rounded-2xl border border-[#F0F0F0] bg-white p-10 shadow-soft">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#4D5D4B]" />
            </div>
            <p className="text-[15px] font-medium text-[#1A1A1A]">
              Researching {name}...
            </p>
            <p className="mt-1.5 text-[14px] text-[#6B7280]">
              {PROGRESS_MESSAGES[progressIndex]}
            </p>
            <div className="mt-4 flex gap-1.5">
              {PROGRESS_MESSAGES.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-6 rounded-full transition-colors duration-300 ${
                    i <= progressIndex ? "bg-[#4D5D4B]" : "bg-[#E5E7EB]"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="rounded-2xl border border-[#F0F0F0] bg-white p-6 shadow-soft">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF7675]" />
            <div>
              <p className="text-[15px] font-medium text-[#1A1A1A]">Research failed</p>
              <p className="mt-1 text-[14px] text-[#6B7280]">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  handleResearch(new Event("submit") as unknown as React.FormEvent);
                }}
                className="btn-primary mt-3 text-[13px]"
              >
                {t.common.retry}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="rounded-2xl border border-[#F0F0F0] bg-white p-6 shadow-soft">
          {renderAnalysis(result.analysis)}
        </div>
      )}

      {/* Past Research */}
      <div className="space-y-4">
        <h2 className="text-[20px] font-semibold text-[#1A1A1A]">Past Research</h2>
        {loadingPast ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 shimmer rounded-2xl border border-[#F0F0F0]"
              />
            ))}
          </div>
        ) : pastProfiles.length === 0 ? (
          <div className="rounded-2xl border border-[#F0F0F0] bg-white p-10 text-center">
            <Search className="mx-auto h-8 w-8 text-[#D1D5DB]" />
            <p className="mt-3 text-[14px] text-[#9CA3AF]">
              No past research yet. Use the search above to analyze a competitor.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pastProfiles.map((profile) => {
              const isExpanded = expandedPastId === profile.id;
              const analysis = profile.analysis as CompetitorInsights | null;

              return (
                <div
                  key={profile.id}
                  className="rounded-2xl border border-[#F0F0F0] bg-white transition-shadow hover:shadow-soft"
                >
                  <button
                    onClick={() =>
                      setExpandedPastId(isExpanded ? null : profile.id)
                    }
                    className="flex w-full items-center justify-between p-5 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8EDE7]">
                        <Target className="h-4 w-4 text-[#4D5D4B]" />
                      </div>
                      <div>
                        <p className="text-[15px] font-medium text-[#1A1A1A]">
                          {profile.name}
                        </p>
                        <p className="text-[13px] text-[#9CA3AF]">
                          {profile.industry || "General"} &middot;{" "}
                          {profile.ad_count} ads &middot;{" "}
                          {new Date(profile.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {profile.avg_score != null && (
                        <span
                          className={`rounded-full px-3 py-1 text-[13px] font-bold ${getScoreBadge(
                            profile.avg_score
                          )}`}
                        >
                          {profile.avg_score}/100
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-[#D1D5DB]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-[#D1D5DB]" />
                      )}
                    </div>
                  </button>
                  {isExpanded && analysis && (
                    <div className="border-t border-[#F0F0F0] p-5">
                      <div className="grid gap-4 sm:grid-cols-2">
                        {analysis.messaging_themes &&
                          analysis.messaging_themes.length > 0 &&
                          renderInsightsCard(
                            <MessageSquare className="h-4 w-4 text-[#6C5CE7]" />,
                            "Messaging Themes",
                            renderTagPills(analysis.messaging_themes)
                          )}
                        {analysis.visual_patterns &&
                          analysis.visual_patterns.length > 0 &&
                          renderInsightsCard(
                            <Eye className="h-4 w-4 text-[#74B9FF]" />,
                            "Visual Patterns",
                            renderTagPills(analysis.visual_patterns)
                          )}
                        {analysis.cta_patterns &&
                          analysis.cta_patterns.length > 0 &&
                          renderInsightsCard(
                            <Megaphone className="h-4 w-4 text-[#FF7675]" />,
                            "CTA Patterns",
                            renderTagPills(analysis.cta_patterns)
                          )}
                        {analysis.target_audience_signals &&
                          analysis.target_audience_signals.length > 0 &&
                          renderInsightsCard(
                            <Target className="h-4 w-4 text-[#4D5D4B]" />,
                            "Target Audience",
                            renderTagPills(analysis.target_audience_signals)
                          )}
                        {analysis.strengths &&
                          analysis.strengths.length > 0 &&
                          renderInsightsCard(
                            <TrendingUp className="h-4 w-4 text-[#4D5D4B]" />,
                            "Strengths",
                            renderBulletList(analysis.strengths)
                          )}
                        {analysis.weaknesses &&
                          analysis.weaknesses.length > 0 &&
                          renderInsightsCard(
                            <AlertTriangle className="h-4 w-4 text-[#FF7675]" />,
                            "Weaknesses & Opportunities",
                            renderBulletList(analysis.weaknesses)
                          )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
