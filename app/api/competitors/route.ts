import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireAuth();

    const { data: profiles, error } = await db
      .from("competitor_profiles")
      .select("*")
      .eq("org_id", auth.orgId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error("Error fetching competitor profiles:", error);
    return NextResponse.json(
      { error: "Failed to fetch competitor profiles" },
      { status: 500 }
    );
  }
}
