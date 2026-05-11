// POST /api/transcript/persist
//
// Stores the live director-call transcript on generations.agent_config.live_transcript
// so it survives page reloads and cross-session test runs. The frontend
// debounces calls to this endpoint while the user is talking; on resume,
// the stored transcript is fed back into the next session's persona via
// priorTranscript so the director picks up mid-conversation.

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  generationId: string;
  transcript: Array<{ speaker: "user" | "director"; text: string }>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    if (!body.generationId || !Array.isArray(body.transcript)) {
      return NextResponse.json(
        { error: "generationId and transcript[] are required" },
        { status: 400 }
      );
    }

    const { data: gen } = await db
      .from("generations")
      .select("agent_config")
      .eq("id", body.generationId)
      .single();
    const cfg = (gen?.agent_config as Record<string, unknown> | null) || {};

    // Cap stored transcript to last 80 turns — older context is rarely used
    // and bloats agent_config indefinitely on long sessions.
    const trimmed = body.transcript.slice(-80);

    await db
      .from("generations")
      .update({
        agent_config: { ...cfg, live_transcript: trimmed },
      })
      .eq("id", body.generationId);

    return NextResponse.json({ ok: true, count: trimmed.length });
  } catch (err) {
    console.error("[/api/transcript/persist]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
