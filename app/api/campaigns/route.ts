import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/campaigns — list all campaigns for the user's org
export async function GET() {
  try {
    const auth = await requireAuth();

    const { data: campaigns, error } = await db
      .from("campaigns")
      .select("*, campaign_items(count)")
      .eq("org_id", auth.orgId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ campaigns: campaigns || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

// POST /api/campaigns — create a new campaign
export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await request.json();

    const { name, brandId, brief, budgetCredits, autonomyLevel } = body;

    if (!brandId || !brief) {
      return NextResponse.json({ error: "brandId and brief are required" }, { status: 400 });
    }

    const { data: campaign, error } = await db
      .from("campaigns")
      .insert({
        org_id: auth.orgId,
        user_id: auth.id,
        brand_id: brandId,
        name: name || "New Campaign",
        status: "briefing",
        brief,
        budget_credits: budgetCredits || 0,
        credits_used: 0,
        credits_reserved: 0,
        autonomy_level: autonomyLevel || "semi",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create campaign" },
      { status: 500 }
    );
  }
}
