import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/campaigns/[id] — get campaign with items
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const { data: campaign, error } = await db
      .from("campaigns")
      .select("*, campaign_items(*)")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

// PATCH /api/campaigns/[id] — update campaign (pause, cancel, edit name)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const { data: campaign, error } = await db
      .from("campaigns")
      .update(body)
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

// DELETE /api/campaigns/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    await db.from("campaigns").delete().eq("id", id).eq("org_id", auth.orgId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
