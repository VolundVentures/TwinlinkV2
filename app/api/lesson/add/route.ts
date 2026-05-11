// POST /api/lesson/add
//
// Called by the frontend when a director fires `cite_lesson` via the
// Characters API client_event channel. Persists the lesson card to
// generations.agent_config.lesson_plan so it survives resume, and returns
// the canonical card id for the frontend to add to local state.
//
// Mirrors the agent-side `cite_lesson` tool ([lib/ai/tools/cite-lesson.ts]):
// same shape, same persistence target, same Film School lane.

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getPersonaById } from "@/lib/directors";

export const runtime = "nodejs";
export const maxDuration = 30;

type LessonCard = {
  id: string;
  director_id: string;
  film: string;
  year?: number;
  technique: string;
  why: string;
  asset_id?: string;
  created_at: number;
};

type Body = {
  generationId: string;
  director_id: string;
  film: string;
  year?: number;
  technique: string;
  why: string;
  asset_id?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const directorId = body.director_id;
    const film = (body.film || "").trim();
    const technique = (body.technique || "").trim();
    const why = (body.why || "").trim();

    if (!body.generationId || !directorId || !film || !technique || !why) {
      return NextResponse.json(
        {
          error:
            "generationId, director_id, film, technique, and why are required",
        },
        { status: 400 }
      );
    }

    // Soft-validate the citation against the director's filmsCited list. We
    // warn but don't reject — the live director's transcription may not
    // exactly match the canonical film title.
    const persona = getPersonaById(directorId);
    if (persona) {
      const known = persona.filmsCited.some(
        (f) => f.title.toLowerCase() === film.toLowerCase()
      );
      if (!known) {
        console.warn(
          `[/api/lesson/add] director ${directorId} cited "${film}" — not in filmsCited list (allowed; may be a transcription variant)`
        );
      }
    }

    const card: LessonCard = {
      id: crypto.randomUUID(),
      director_id: directorId,
      film,
      year: body.year,
      technique,
      why,
      asset_id: body.asset_id,
      created_at: Date.now(),
    };

    try {
      const { data: gen } = await db
        .from("generations")
        .select("agent_config")
        .eq("id", body.generationId)
        .single();
      const cfg = (gen?.agent_config as Record<string, unknown> | null) || {};
      const existing = (cfg.lesson_plan as LessonCard[] | undefined) || [];
      await db
        .from("generations")
        .update({
          agent_config: { ...cfg, lesson_plan: [...existing, card] },
        })
        .eq("id", body.generationId);
    } catch (err) {
      console.warn("[/api/lesson/add] persist failed (non-fatal):", err);
    }

    return NextResponse.json(card);
  } catch (err) {
    console.error("[/api/lesson/add] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
