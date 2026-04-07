import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const auth = await requireAuth();
    const { postId } = await params;
    const body = await request.json();

    const allowedFields: Record<string, string> = {
      scheduledAt: "scheduled_at",
      caption: "caption",
      hashtags: "hashtags",
      platform: "platform",
      postType: "post_type",
      status: "status",
      carouselSlides: "carousel_slides",
    };

    const updates: Record<string, unknown> = {};
    for (const [key, dbField] of Object.entries(allowedFields)) {
      if (body[key] !== undefined) {
        updates[dbField] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data: post, error } = await db
      .from("scheduled_posts")
      .update(updates)
      .eq("id", postId)
      .eq("org_id", auth.orgId)
      .select()
      .single();

    if (error) throw error;

    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error("Error updating scheduled post:", error);
    return NextResponse.json(
      { error: "Failed to update scheduled post" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const auth = await requireAuth();
    const { postId } = await params;

    const { error } = await db
      .from("scheduled_posts")
      .delete()
      .eq("id", postId)
      .eq("org_id", auth.orgId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting scheduled post:", error);
    return NextResponse.json(
      { error: "Failed to delete scheduled post" },
      { status: 500 }
    );
  }
}
