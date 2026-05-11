import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  name?: string;
  email?: string;
  company?: string;
  role?: string;
  useCase?: string;
};

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "Server is not configured." },
      { status: 500 }
    );
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = str(body.name, 120);
  const email = str(body.email, 200)?.toLowerCase() ?? null;
  const company = str(body.company, 160);
  const role = str(body.role, 80);
  const useCase = str(body.useCase, 1000);

  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "";
  const ipHash = ip
    ? createHash("sha256").update(ip).digest("hex").slice(0, 32)
    : null;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.from("access_requests").insert({
    name,
    email,
    company,
    role,
    use_case: useCase,
    referrer: str(req.headers.get("referer"), 500),
    user_agent: str(req.headers.get("user-agent"), 500),
    ip_hash: ipHash,
  });

  if (error) {
    // 23505 = unique_violation (email already requested). Treat as success so
    // we don't leak presence, but log internally.
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[access-requests] insert error", error);
    return NextResponse.json(
      { error: "Couldn't save your request. Try again in a moment." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
