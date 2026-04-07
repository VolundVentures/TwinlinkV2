import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // Format: 2026-03

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: "Invalid month parameter. Expected format: YYYY-MM" },
        { status: 400 }
      );
    }

    // Calculate start and end of month
    const [year, monthNum] = month.split("-").map(Number);
    const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
    const endDate = new Date(Date.UTC(year, monthNum, 1)); // First day of next month

    const { data: posts, error } = await db
      .from("scheduled_posts")
      .select(
        "*, generation_assets!asset_id(id, public_url, thumbnail_url, type, aspect_ratio, metadata)"
      )
      .eq("org_id", auth.orgId)
      .gte("scheduled_at", startDate.toISOString())
      .lt("scheduled_at", endDate.toISOString())
      .order("scheduled_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ posts: posts ?? [] });
  } catch (error) {
    console.error("Error fetching calendar posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar posts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await request.json();

    const {
      assetId,
      platform,
      scheduledAt,
      caption,
      hashtags,
      postType,
      generationId,
      carouselSlides,
    } = body;

    if (!platform || !scheduledAt) {
      return NextResponse.json(
        { error: "platform and scheduledAt are required" },
        { status: 400 }
      );
    }

    const { data: post, error } = await db
      .from("scheduled_posts")
      .insert({
        org_id: auth.orgId,
        generation_id: generationId || null,
        asset_id: assetId || null,
        platform,
        scheduled_at: scheduledAt,
        caption: caption || null,
        hashtags: hashtags || [],
        post_type: postType || "image",
        carousel_slides: carouselSlides || null,
        status: "scheduled",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error("Error creating scheduled post:", error);
    return NextResponse.json(
      { error: "Failed to create scheduled post" },
      { status: 500 }
    );
  }
}
