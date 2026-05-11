"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName } },
    });
    if (authError) { setError(authError.message); setLoading(false); return; }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* Header — mobile logo only */}
      <div className="lg:hidden flex justify-center mb-4">
        <img src="/logo.svg" alt="TwinLink" className="h-10 w-10" />
      </div>

      <div>
        <h1 className="text-[28px] font-bold text-[#1A1A1A] tracking-tight">Create your account</h1>
        <p className="mt-2 text-[15px] text-[#6B7280]">
          Join TwinLink and start creating with AI.
        </p>
      </div>

      <div className="space-y-5">
        <form onSubmit={handleEmailSignup} className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-[#6B7280] mb-1.5 block">Name</label>
            <input
              type="text" placeholder="Alex Jordan" value={fullName} onChange={(e) => setFullName(e.target.value)} required
              className="w-full h-[52px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px] text-[#1A1A1A] placeholder:text-[#C4C4C4] outline-none focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A]/5 transition-all"
            />
          </div>
          <div>
            <label className="text-[13px] font-medium text-[#6B7280] mb-1.5 block">Email</label>
            <input
              type="email" placeholder="alex@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full h-[52px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px] text-[#1A1A1A] placeholder:text-[#C4C4C4] outline-none focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A]/5 transition-all"
            />
          </div>
          <div>
            <label className="text-[13px] font-medium text-[#6B7280] mb-1.5 block">Password</label>
            <input
              type="password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="w-full h-[52px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px] text-[#1A1A1A] placeholder:text-[#C4C4C4] outline-none focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A]/5 transition-all"
            />
          </div>

          {error && (
            <p className="text-[13px] text-[#EF4444] bg-[#FEF2F2] rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full h-[52px] rounded-xl bg-[#1A1A1A] text-white text-[15px] font-semibold hover:bg-[#333] transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
          </button>
        </form>

        <p className="text-center text-[13px] text-[#9CA3AF]">
          Have an account?{" "}
          <Link href="/login" className="text-[#1A1A1A] font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
