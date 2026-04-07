import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/campaigns/[id]/approve — approve plan and start production
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { itemIds } = body as { itemIds?: string[] };

    // Verify campaign exists and is in reviewable state
    const { data: campaign, error: campError } = await db
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (campError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (!["plan_review", "approved"].includes(campaign.status)) {
      return NextResponse.json({ error: "Campaign is not in a reviewable state" }, { status: 400 });
    }

    // If specific items provided, only approve those; otherwise approve all planned items
    if (itemIds && itemIds.length > 0) {
      await db
        .from("campaign_items")
        .update({ status: "queued" })
        .eq("campaign_id", id)
        .in("id", itemIds)
        .eq("status", "planned");
    } else {
      await db
        .from("campaign_items")
        .update({ status: "queued" })
        .eq("campaign_id", id)
        .eq("status", "planned");
    }

    // Update campaign status to production
    await db.from("campaigns").update({
      status: "production",
      started_at: new Date().toISOString(),
    }).eq("id", id);

    return NextResponse.json({ success: true, status: "production" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to approve" },
      { status: 500 }
    );
  }
}
