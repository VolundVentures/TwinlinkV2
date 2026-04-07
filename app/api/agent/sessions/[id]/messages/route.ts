import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/agent/sessions/[id]/messages — load conversation messages
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const { data: session } = await db
      .from("agent_sessions")
      .select("messages")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ messages: session.messages || [] });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// PATCH /api/agent/sessions/[id]/messages — save conversation messages
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;
    const { messages } = await request.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: "messages must be an array" }, { status: 400 });
    }

    // Verify session belongs to this org
    const { data: session } = await db
      .from("agent_sessions")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Save messages
    const { error } = await db
      .from("agent_sessions")
      .update({
        messages,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
