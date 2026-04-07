import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  orgId: string;
  preferredLanguage: string;
};

export async function getAuth(): Promise<AuthUser | null> {
  try {
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getClaims();

    if (authError) {
      console.error("[auth] getClaims error:", authError.message);
      return null;
    }

    const user = data?.claims;
    if (!user) return null;

    // Try to find existing profile
    const { data: profile, error: profileError } = await db
      .from("users")
      .select("name, role, org_id, preferred_language")
      .eq("id", user.sub)
      .single();

    if (profileError) {
      console.error("[auth] Profile query error:", profileError.message, profileError.code);
    }

    if (profile) {
      return {
        id: user.sub,
        email: user.email!,
        name: profile.name,
        role: profile.role,
        orgId: profile.org_id,
        preferredLanguage: profile.preferred_language,
      };
    }

    // Profile doesn't exist yet — auto-provision
    console.log("[auth] Auto-provisioning user:", user.sub, user.email);

    const name =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "User";

    const slug = `${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36)}`;

    const { data: org, error: orgError } = await db
      .from("organizations")
      .insert({ name: `${name}'s Workspace`, slug })
      .select("id")
      .single();

    if (orgError) {
      console.error("[auth] Org creation error:", orgError.message, orgError.code, orgError.details);
      return null;
    }

    if (!org) {
      console.error("[auth] Org created but no data returned");
      return null;
    }

    const { error: userError } = await db.from("users").insert({
      id: user.sub,
      org_id: org.id,
      email: user.email!,
      name,
      role: "owner",
      avatar_url: user.user_metadata?.avatar_url || null,
    });

    if (userError) {
      // Duplicate key = another concurrent request already provisioned this user
      if (userError.code === "23505") {
        console.log("[auth] User already provisioned by concurrent request, fetching...");
        const { data: existingProfile } = await db
          .from("users")
          .select("name, role, org_id, preferred_language")
          .eq("id", user.sub)
          .single();
        if (existingProfile) {
          return {
            id: user.sub,
            email: user.email!,
            name: existingProfile.name,
            role: existingProfile.role,
            orgId: existingProfile.org_id,
            preferredLanguage: existingProfile.preferred_language,
          };
        }
      }
      console.error("[auth] User creation error:", userError.message, userError.code, userError.details);
      return null;
    }

    const { error: creditError } = await db.from("credit_balances").insert({
      org_id: org.id,
      balance: 500,
    });

    if (creditError) {
      console.error("[auth] Credit creation error:", creditError.message);
    }

    console.log("[auth] User provisioned successfully:", user.sub, "org:", org.id);

    return {
      id: user.sub,
      email: user.email!,
      name,
      role: "owner",
      orgId: org.id,
      preferredLanguage: "en",
    };
  } catch (error) {
    console.error("[auth] Unexpected error:", error);
    return null;
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const auth = await getAuth();
  if (!auth) {
    throw new Error("Unauthorized");
  }
  return auth;
}
