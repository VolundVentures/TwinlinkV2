// GET /api/debug/transcript/[generationId]
//
// Dev-only endpoint that exposes the live director-call transcript saved on
// `generations.agent_config.live_transcript`. The user can hit this in the
// browser after a test run, copy the JSON, and paste it back to me so I can
// see exactly what the director and user said to each other.
//
// Renders as plain text by default (?format=text) for easier copy/paste,
// or JSON (?format=json) when scripted.

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type TranscriptEntry = { speaker: "user" | "director"; text: string };
type LessonCard = {
  director_id: string;
  film: string;
  technique: string;
  why: string;
};
type Suggestion = {
  type: string;
  director_name: string;
  status: string;
  summary: string;
  target_ref?: string;
  direction?: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  const { generationId } = await params;
  if (!generationId) {
    return NextResponse.json({ error: "generationId required" }, { status: 400 });
  }
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "text";

  try {
    const { data: gen } = await db
      .from("generations")
      .select("agent_config, prompt, created_at")
      .eq("id", generationId)
      .single();
    if (!gen) {
      return NextResponse.json({ error: "generation not found" }, { status: 404 });
    }
    const cfg = (gen.agent_config as Record<string, unknown> | null) || {};
    const transcript = (cfg.live_transcript as TranscriptEntry[] | undefined) || [];
    const lessons = (cfg.lesson_plan as LessonCard[] | undefined) || [];
    const suggestions =
      (cfg.suggestions as Suggestion[] | undefined) || [];

    if (format === "json") {
      return NextResponse.json({
        generationId,
        prompt: gen.prompt,
        created_at: gen.created_at,
        transcript,
        lessons,
        suggestions,
      });
    }

    // Text format — readable in the browser, copy-pasteable.
    const lines: string[] = [];
    lines.push(`# AUTEUR session ${generationId}`);
    lines.push(`# created ${gen.created_at}`);
    lines.push(`# brief: ${gen.prompt}`);
    lines.push("");
    lines.push(`## TRANSCRIPT (${transcript.length} turns)`);
    lines.push("");
    for (const t of transcript) {
      lines.push(
        `${t.speaker.toUpperCase().padEnd(8)} ${t.text}`
      );
    }
    lines.push("");
    lines.push(`## SUGGESTIONS (${suggestions.length})`);
    for (const s of suggestions) {
      lines.push(
        `[${s.status}] ${s.director_name} — ${s.type}${
          s.target_ref ? ` on ${s.target_ref}` : ""
        }: ${s.summary}`
      );
    }
    lines.push("");
    lines.push(`## LESSONS (${lessons.length})`);
    for (const l of lessons) {
      lines.push(`${l.film} — ${l.technique}: ${l.why}`);
    }

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  } catch (err) {
    console.error("[/api/debug/transcript]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
