import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireAuth();

    const { data: connections, error } = await db
      .from("platform_connections")
      .select("id, platform, account_name, account_id, account_avatar_url, created_at")
      .eq("org_id", auth.orgId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ connections: connections ?? [] });
  } catch (error) {
    console.error("Error fetching platform connections:", error);
    return NextResponse.json(
      { error: "Failed to fetch platform connections" },
      { status: 500 }
    );
  }
}
