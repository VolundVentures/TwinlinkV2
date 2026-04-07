import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const user = data?.claims;

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if user already has a profile
    const { data: existingUser } = await db
      .from("users")
      .select("id")
      .eq("id", user.sub)
      .single();

    if (existingUser) {
      return NextResponse.json({ message: "User already exists" });
    }

    const name =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "User";

    const slug = `${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36)}`;

    // Create organization
    const { data: org, error: orgError } = await db
      .from("organizations")
      .insert({
        name: `${name}'s Workspace`,
        slug,
      })
      .select("id")
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: "Failed to create organization" },
        { status: 500 }
      );
    }

    // Create user profile
    await db.from("users").insert({
      id: user.sub,
      org_id: org.id,
      email: user.email!,
      name,
      role: "owner",
    });

    // Create initial credit balance (500 free credits)
    await db.from("credit_balances").insert({
      org_id: org.id,
      balance: 500,
    });

    return NextResponse.json({ orgId: org.id });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
