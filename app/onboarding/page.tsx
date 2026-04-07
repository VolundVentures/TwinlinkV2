import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuth } from "@/lib/auth";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  // Check if user is logged in at all
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (!user) {
    redirect("/login");
  }

  // Try to get full profile (may fail if service role key is wrong)
  const auth = await getAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="w-full">
        <OnboardingWizard
          orgId={auth?.orgId || "pending"}
          userId={auth?.id || user.sub}
        />
      </div>
    </div>
  );
}
