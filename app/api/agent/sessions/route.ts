import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/agent/sessions — list past chat sessions for the current user
export async function GET() {
  try {
    const auth = await requireAuth();

    const { data: sessions, error } = await db
      .from("agent_sessions")
      .select("id, generation_id, status, messages, created_at, updated_at, generations(title, prompt, type)")
      .eq("org_id", auth.orgId)
      .not("messages", "eq", "[]") // Only sessions with messages
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format for the frontend — filter out useless sessions
    const formatted = (sessions || [])
      .map((s) => {
        const gen = s.generations as { title?: string; prompt?: string; type?: string } | null;
        const msgs = (s.messages || []) as Array<{ role: string; content: string }>;
        const firstUserMsg = msgs.find((m) => m.role === "user");
        return {
          id: s.id,
          generationId: s.generation_id,
          title: gen?.title || firstUserMsg?.content?.slice(0, 60) || "Untitled",
          type: gen?.type || "unknown",
          messageCount: msgs.length,
          status: s.status,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        };
      })
      // Only show sessions with real conversations (at least a user message + agent response)
      .filter((s) => s.messageCount >= 2);

    return NextResponse.json({ sessions: formatted });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
