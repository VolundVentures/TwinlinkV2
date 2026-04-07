import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateJSON } from "@/lib/ai/claude";

type Params = { params: Promise<{ id: string; itemId: string }> };

// PATCH /api/campaigns/[id]/items/[itemId] — update item
export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireAuth();
    const { id, itemId } = await params;
    const body = await request.json();

    // If there's a comment/feedback, use Opus to revise the creative brief
    if (body.comment) {
      const { data: item } = await db
        .from("campaign_items")
        .select("*, campaigns!inner(brand_id, brands(name, industry))")
        .eq("id", itemId)
        .eq("campaign_id", id)
        .single();

      if (item) {
        const currentBrief = item.creative_brief as Record<string, unknown>;
        const revised = await generateJSON<{ description: string; estimated_cost: number }>({
          model: "claude-opus-4-6",
          maxTokens: 500,
          system: "You are an elite creative director. Revise the creative brief based on the feedback. Return JSON with 'description' (revised brief) and 'estimated_cost' (unchanged or adjusted).",
          messages: [{
            role: "user",
            content: `Current creative brief: "${currentBrief.description || ""}"
Item type: ${item.item_type}
Platform: ${item.platform}

User feedback: "${body.comment}"

Revise the creative brief to incorporate this feedback. Keep it concise (2-3 sentences).`,
          }],
        });

        const { error } = await db
          .from("campaign_items")
          .update({
            creative_brief: { description: revised.description },
            estimated_cost: revised.estimated_cost || item.estimated_cost,
            review_notes: body.comment,
          })
          .eq("id", itemId)
          .eq("campaign_id", id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Fetch updated item
        const { data: updated } = await db.from("campaign_items").select("*").eq("id", itemId).single();
        return NextResponse.json({ item: updated });
      }
    }

    // Standard update (reschedule, change platform, etc.)
    const { comment, ...updates } = body;
    const { data: updated, error } = await db
      .from("campaign_items")
      .update(updates)
      .eq("id", itemId)
      .eq("campaign_id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update item" },
      { status: 500 }
    );
  }
}

// DELETE /api/campaigns/[id]/items/[itemId]
export async function DELETE(request: Request, { params }: Params) {
  try {
    const auth = await requireAuth();
    const { id, itemId } = await params;

    const { error } = await db
      .from("campaign_items")
      .delete()
      .eq("id", itemId)
      .eq("campaign_id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete item" },
      { status: 500 }
    );
  }
}
