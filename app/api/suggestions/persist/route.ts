// POST /api/suggestions/persist
//
// Stores the current suggestion list (pending + applied + passed) into
// generations.agent_config.suggestions so it survives page reload and
// resume. Mirrors the in-memory `Suggestion` shape from use-director.ts.
//
// Invoked debounced from the frontend after add / apply / pass mutations.
// Server-side authoritative — last write wins.

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  generationId: string;
  // Loose typing — frontend owns the shape; we just persist it.
  suggestions: unknown[];
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    if (!body.generationId || !Array.isArray(body.suggestions)) {
      return NextResponse.json(
        { error: "generationId and suggestions[] are required" },
        { status: 400 }
      );
    }

    const { data: gen } = await db
      .from("generations")
      .select("agent_config")
      .eq("id", body.generationId)
      .single();
    const cfg = (gen?.agent_config as Record<string, unknown> | null) || {};

    await db
      .from("generations")
      .update({
        agent_config: { ...cfg, suggestions: body.suggestions },
      })
      .eq("id", body.generationId);

    return NextResponse.json({ ok: true, count: body.suggestions.length });
  } catch (err) {
    console.error("[/api/suggestions/persist] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
