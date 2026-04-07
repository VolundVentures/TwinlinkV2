import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireAuth();

    const { data: brands, error } = await db
      .from("brands")
      .select("*")
      .eq("org_id", auth.orgId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ brands });
  } catch (error) {
    console.error("Error fetching brands:", error);
    return NextResponse.json(
      { error: "Failed to fetch brands" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await request.json();

    const { data: brand, error } = await db
      .from("brands")
      .insert({
        org_id: auth.orgId,
        name: body.name,
        website_url: body.website_url,
        logo_url: body.logo_url || null,
        description: body.description,
        primary_color: body.primary_color,
        secondary_color: body.secondary_color,
        accent_color: body.accent_color,
        industry: body.industry,
        target_audience: body.target_audience,
        brand_voice: body.brand_voice,
        products: body.products || [],
        scraped_data: body.scraped_data || {},
        is_default: body.is_default || false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ brand });
  } catch (error) {
    console.error("Error creating brand:", error);
    return NextResponse.json(
      { error: "Failed to create brand" },
      { status: 500 }
    );
  }
}
