import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuth } from "@/lib/auth";
import { getCredits } from "@/lib/credits";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { MobileBottomNav } from "@/components/dashboard/mobile-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (!user) {
    redirect("/login");
  }

  const auth = await getAuth();
  const userName = auth?.name ?? user.user_metadata?.name ?? user.email ?? "User";
  const credits = auth ? await getCredits(auth.orgId) : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userName={userName} credits={credits} />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
      </div>
      {/* Bottom tab bar — mobile only */}
      <MobileBottomNav />
    </div>
  );
}
