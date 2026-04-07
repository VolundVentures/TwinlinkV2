import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateJSON } from "@/lib/ai/claude";

// POST /api/campaigns/[id]/plan — AI generates an editorial plan
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    // Load campaign
    const { data: campaign, error: campError } = await db
      .from("campaigns")
      .select("*, brands(*)")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (campError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const brief = campaign.brief;
    const brand = campaign.brands;

    // Build prompt for the AI planner
    const today = new Date().toISOString().split("T")[0];
    const budgetCredits = campaign.budget_credits;

    // Cost reference
    const costRef = `
Credit costs:
- Static image: 3 credits
- Carousel (5 slides): 15 credits
- UGC video (with avatar): 50 credits (images + video + voiceover + music + compose)
- B-roll video (no avatar): 35 credits (images + video + voiceover + music + compose)
- Cinematic video: 40 credits (images + video + music + compose)
`;

    const planPrompt = `You are an AI Creative Director planning a content campaign.

Today's date: ${today}
Brand: ${brand?.name || "Unknown"} (${brand?.industry || "N/A"})
Target audience: ${brand?.target_audience || "General"}
Brand voice: ${brand?.brand_voice || "Professional"}

Campaign brief:
- Budget: ${budgetCredits} credits
- Timeframe: ${brief.timeframe_start} to ${brief.timeframe_end}
- Goals: ${brief.goals?.join(", ") || "General marketing"}
- Platforms: ${brief.platforms?.join(", ") || "Instagram, TikTok"}
- Content mix preference: ${brief.content_mix || "balanced"}
- Key dates: ${brief.key_dates?.map((d: { date: string; label: string }) => `${d.date}: ${d.label}`).join(", ") || "None"}
- Notes: ${brief.notes || "None"}

${costRef}

Generate a content plan that:
1. Stays WITHIN the ${budgetCredits} credit budget
2. Spreads content across the timeframe evenly
3. Plans content around key dates if any
4. Matches the content mix preference
5. Includes a variety of formats and creative approaches
6. Schedules at optimal posting times for each platform

Return a JSON object with:
{
  "name": "Campaign name suggestion",
  "summary": "2-3 sentence summary of the plan",
  "total_estimated_cost": number,
  "items": [
    {
      "item_type": "static_image" | "ugc_video" | "carousel" | "broll_video" | "cinematic_video",
      "platform": "instagram" | "tiktok" | "linkedin" | "x",
      "scheduled_at": "YYYY-MM-DDTHH:MM:SS",
      "description": "Creative brief for this piece",
      "estimated_cost": number,
      "sort_order": number
    }
  ]
}

Be creative with the descriptions. Each item should have a unique creative direction.`;

    // Update campaign status to planning
    await db.from("campaigns").update({ status: "planning" }).eq("id", id);

    const plan = await generateJSON<{
      name: string;
      summary: string;
      total_estimated_cost: number;
      items: Array<{
        item_type: string;
        platform: string;
        scheduled_at: string;
        description: string;
        estimated_cost: number;
        sort_order: number;
      }>;
    }>({
      model: "claude-opus-4-6",
      maxTokens: 4000,
      system: "You are an elite creative director at a top ad agency. You think strategically about content calendars, audience psychology, and platform-specific best practices. Return structured JSON only.",
      messages: [{ role: "user", content: planPrompt }],
    });

    // Insert campaign items
    if (plan.items && plan.items.length > 0) {
      const itemsToInsert = plan.items.map((item, i) => ({
        campaign_id: id,
        org_id: auth.orgId,
        item_type: item.item_type,
        platform: item.platform,
        scheduled_at: item.scheduled_at,
        creative_brief: { description: item.description },
        estimated_cost: item.estimated_cost,
        status: "planned",
        sort_order: item.sort_order || i,
      }));

      await db.from("campaign_items").insert(itemsToInsert);
    }

    // Update campaign status and name
    await db.from("campaigns").update({
      status: "plan_review",
      name: plan.name || campaign.name,
      credits_reserved: plan.total_estimated_cost || 0,
    }).eq("id", id);

    return NextResponse.json({
      plan: {
        name: plan.name,
        summary: plan.summary,
        total_estimated_cost: plan.total_estimated_cost,
        item_count: plan.items?.length || 0,
      },
    });
  } catch (error) {
    console.error("[api:campaigns:plan] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Planning failed" },
      { status: 500 }
    );
  }
}
