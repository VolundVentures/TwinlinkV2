import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await request.json();

    // Get current user settings
    const { data: user } = await db
      .from("users")
      .select("settings")
      .eq("id", auth.id)
      .single();

    const currentSettings = (user?.settings as Record<string, unknown>) || {};

    // Merge new settings
    const updatedSettings = {
      ...currentSettings,
      ...body,
    };

    // Update user settings
    const { error } = await db
      .from("users")
      .update({ settings: updatedSettings })
      .eq("id", auth.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: updatedSettings });
  } catch (error) {
    console.error("[api:users:settings] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update settings" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const auth = await requireAuth();

    const { data: user } = await db
      .from("users")
      .select("settings")
      .eq("id", auth.id)
      .single();

    return NextResponse.json({ settings: user?.settings || {} });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch settings" },
      { status: 500 }
    );
  }
}
