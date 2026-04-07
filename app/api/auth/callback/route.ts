import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if user profile already exists
      const { data: existingUser } = await db
        .from("users")
        .select("id")
        .eq("id", data.user.id)
        .single();

      if (!existingUser) {
        // Create org + user + credits for new user
        const name =
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          data.user.email?.split("@")[0] ||
          "User";

        const slug = `${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36)}`;

        const { data: org } = await db
          .from("organizations")
          .insert({
            name: `${name}'s Workspace`,
            slug,
          })
          .select("id")
          .single();

        if (org) {
          await db.from("users").insert({
            id: data.user.id,
            org_id: org.id,
            email: data.user.email!,
            name,
            role: "owner",
            avatar_url: data.user.user_metadata?.avatar_url || null,
          });

          await db.from("credit_balances").insert({
            org_id: org.id,
            balance: 500,
          });
        }

        return NextResponse.redirect(`${origin}/onboarding`);
      }

      // Existing user — go to dashboard
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // Auth error — redirect to login
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
