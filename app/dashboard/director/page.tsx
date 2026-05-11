import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { DirectorShell } from "@/components/director/director-shell";

export const dynamic = "force-dynamic";

export default async function DirectorPage() {
  const auth = await getAuth();
  if (!auth) redirect("/login");

  return (
    <div className="h-full w-full overflow-hidden bg-white">
      <DirectorShell brands={[]} />
    </div>
  );
}
