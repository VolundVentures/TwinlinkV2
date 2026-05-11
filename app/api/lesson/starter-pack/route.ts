// POST /api/lesson/starter-pack
//
// Fired by the frontend ONCE per project, right after the brief is submitted,
// while the writer (Haiku) is composing the treatment. Generates 2–3 starter
// teaching cards drawn from the lead director's `filmsCited` list — each card
// is a (film, technique, why) tuple. For each card the endpoint also renders
// a textbook reference page image via gpt_image_2 in parallel so the
// References lane is populated by the time the treatment lands.
//
// Why a dedicated endpoint instead of relying on the live director to fire
// cite_lesson during PITCH: the LLM dependency is unreliable (the director
// often skips teaching to focus on story questions). Pre-rendering starter
// lessons removes the dependency — every project starts with cinema on
// screen. The live director can still cite more lessons later.
//
// Idempotence: refuses to fire if any starter lessons already exist for this
// project + this director. Safe to call on every page mount.

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getPersonaById, type DirectorPersona } from "@/lib/directors";
import { generateImage, toGptImage2Ratio } from "@/lib/runway";

export const runtime = "nodejs";
export const maxDuration = 120;

type LessonCard = {
  id: string;
  director_id: string;
  film: string;
  year?: number;
  technique: string;
  why: string;
  is_starter?: boolean;
  created_at: number;
};

type WhiteboardCard = {
  id: string;
  url: string;
  caption: string;
  director_id: string;
  director_name: string;
  technique_key?: string;
  created_at: number;
};

type Body = {
  generationId: string;
  directorId: string;
  /** How many starter cards to fire. Default 3. Capped at 4. */
  count?: number;
};

function normalizeKey(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const SOFTEN_MAP: Array<[RegExp, string]> = [
  [/\bblood(?:y|ied)?\b/gi, "dark stain"],
  [/\bgore?\b/gi, "wet sheen"],
  [/\bviolence\b/gi, "intensity"],
  [/\bviolent\b/gi, "intense"],
  [/\bkill(?:ed|ing|er)?\b/gi, "still"],
  [/\bmurder(?:ed|ing|er)?\b/gi, "tragedy"],
  [/\bweapons?\b/gi, "object"],
  [/\bnaked\b/gi, "bare-shouldered"],
  [/\bnude\b/gi, "bare-shouldered"],
];
function sanitize(text: string): string {
  let out = text;
  for (const [re, rep] of SOFTEN_MAP) out = out.replace(re, rep);
  return out;
}

function buildTextbookPrompt(args: {
  techniqueTitle: string;
  filmTag: string;
  caption: string;
  persona: DirectorPersona;
}): string {
  const { techniqueTitle, filmTag, caption, persona } = args;
  return [
    `A composed editorial reference page from a film school course book — photographed cleanly on a flat lit surface.`,
    ``,
    `Layout, top to bottom:`,
    `1) The technique title in elegant serif typography across the top, centered: "${techniqueTitle}". Black ink on warm off-white background, generous letter-spacing.`,
    `2) A single example frame below the title, occupying the center two-thirds of the page. The frame is a representative still inspired by the visual language of ${filmTag} — composition, light, palette, and period mood appropriate to the film, demonstrating the technique above.`,
    `3) A thin horizontal rule below the frame.`,
    `4) Below the rule, a short caption in monospaced uppercase text, generously letter-spaced: "${caption}".`,
    `5) Tiny mark at the bottom-right corner: "via ${persona.name.toUpperCase()}" in mono, very faint.`,
    ``,
    `Aesthetic: warm off-white paper background, slight paper texture and grain, hand-printed editorial feel — like a page from a Cahiers du Cinéma technique manual or a director's masterclass workbook. Black ink only for typography.`,
    ``,
    `The example frame itself is in the visual style of: ${persona.imageStyleModifier}.`,
    ``,
    `STRICT RULES: do NOT add multiple frames, do NOT add arrows or annotations, do NOT add any text other than the title, the caption, and the "via" mark, do NOT use color in the typography.`,
  ].join("\n");
}

// Produce a short teaching note from the technique + film. This is the
// `why` line shown on the lesson card and used as the textbook caption.
function buildWhyLine(filmTitle: string, technique: string): string {
  const t = technique.trim();
  return `From ${filmTitle} — ${t}. Carry this principle into the film we are making.`.slice(
    0,
    180
  );
}

// Pick N (film, technique) pairs from a persona's filmsCited.
// Pull one technique per film (the FIRST one — typically the most iconic),
// rotating through films to give breadth. Falls back to multiple techniques
// from the same film if the persona has fewer films than the requested count.
function pickStarterPairs(
  persona: DirectorPersona,
  count: number
): Array<{ film: string; year?: number; technique: string }> {
  const out: Array<{ film: string; year?: number; technique: string }> = [];
  const films = persona.filmsCited.filter((f) => f.techniques.length > 0);
  if (films.length === 0) return out;

  let filmIdx = 0;
  const filmTechIdx: Record<string, number> = {};
  while (out.length < count) {
    const f = films[filmIdx % films.length];
    const used = filmTechIdx[f.title] || 0;
    if (used >= f.techniques.length) {
      // This film's techniques exhausted; advance to next film.
      filmIdx++;
      // If we've cycled through every film with nothing left, stop.
      if (filmIdx >= films.length * 4) break;
      continue;
    }
    out.push({ film: f.title, year: f.year, technique: f.techniques[used] });
    filmTechIdx[f.title] = used + 1;
    filmIdx++;
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    if (!body.generationId || !body.directorId) {
      return NextResponse.json(
        { error: "generationId and directorId are required" },
        { status: 400 }
      );
    }

    const persona = getPersonaById(body.directorId);
    if (!persona) {
      return NextResponse.json(
        { error: `Unknown director: ${body.directorId}` },
        { status: 400 }
      );
    }

    const count = Math.min(Math.max(body.count ?? 3, 1), 4);

    // Idempotence: if starter lessons already exist for this project + this
    // director, return them rather than re-firing. Lets the client call this
    // endpoint on every mount without worrying about doubles.
    const { data: gen } = await db
      .from("generations")
      .select("agent_config")
      .eq("id", body.generationId)
      .single();
    const cfg = (gen?.agent_config as Record<string, unknown> | null) || {};
    const existingLessons =
      (cfg.lesson_plan as LessonCard[] | undefined) || [];
    const existingStarters = existingLessons.filter(
      (l) => l.is_starter === true && l.director_id === body.directorId
    );
    if (existingStarters.length > 0) {
      const existingBoards =
        (cfg.whiteboard_images as WhiteboardCard[] | undefined) || [];
      const starterTechniqueKeys = new Set(
        existingStarters.map((l) => normalizeKey(l.technique))
      );
      const pairedBoards = existingBoards.filter((b) => {
        const k = b.technique_key || normalizeKey(b.caption);
        return b.director_id === body.directorId && starterTechniqueKeys.has(k);
      });
      return NextResponse.json({
        deduped: true,
        lessons: existingStarters,
        references: pairedBoards,
      });
    }

    const pairs = pickStarterPairs(persona, count);
    if (pairs.length === 0) {
      return NextResponse.json({
        lessons: [],
        references: [],
        message: "Director has no films cited.",
      });
    }

    // TEXT-FIRST FLOW (changed from blocking image-then-return on 2026-05-11):
    //   1. Build lesson cards immediately (no model call), persist them, return.
    //   2. Kick off textbook image generation in the BACKGROUND (fire-and-
    //      forget). Images land in agent_config.whiteboard_images when they
    //      finish; they surface on the next session reload / resume.
    //
    // Reason: the previous flow blocked the response for 20-30s while three
    // gpt_image_2 calls finished, and during that window it ALSO competed
    // with the agent's plate generation for Runway's throttle budget —
    // causing plate tasks to be queue-throttled and time out. Detaching the
    // image lane removes the contention and lets the lesson cards land in
    // Film School as soon as the user opens the sidebar.
    const now = Date.now();
    const newLessons: LessonCard[] = pairs.map((p) => ({
      id: crypto.randomUUID(),
      director_id: body.directorId,
      film: p.film,
      year: p.year,
      technique: p.technique,
      why: buildWhyLine(p.film, p.technique),
      is_starter: true,
      created_at: now,
    }));

    // Persist lessons immediately so they survive reload.
    try {
      const { data: latest } = await db
        .from("generations")
        .select("agent_config")
        .eq("id", body.generationId)
        .single();
      const latestCfg =
        (latest?.agent_config as Record<string, unknown> | null) || {};
      const lessonsFinal = [
        ...((latestCfg.lesson_plan as LessonCard[] | undefined) || []),
        ...newLessons,
      ];
      await db
        .from("generations")
        .update({
          agent_config: {
            ...latestCfg,
            lesson_plan: lessonsFinal,
          },
        })
        .eq("id", body.generationId);
    } catch (err) {
      console.warn(
        "[/api/lesson/starter-pack] lesson persist failed (non-fatal):",
        err
      );
    }

    // Background: generate textbook reference images. We DON'T await this
    // and DON'T block the response. Each image, when done, gets appended to
    // agent_config.whiteboard_images so the next session pickup shows it.
    // Errors here never reach the user — the worst case is the textbook
    // image is missing on this session but the lesson card text is intact.
    void (async () => {
      for (const p of pairs) {
        const techniqueTitle = p.technique.toUpperCase();
        const filmTag = p.year ? `${p.film} (${p.year})` : p.film;
        const why = buildWhyLine(p.film, p.technique);
        const caption = why.slice(0, 80);
        try {
          const task = await generateImage({
            promptText: buildTextbookPrompt({
              techniqueTitle,
              filmTag,
              caption: sanitize(caption),
              persona,
            }),
            ratio: toGptImage2Ratio("16:9"),
            generationId: body.generationId,
            description: `starter lesson [${persona.name}]: ${p.technique.slice(0, 60)}`,
          });
          const url = Array.isArray(task.output)
            ? task.output[0]
            : (task.output as unknown as string);
          if (!url) continue;
          const card: WhiteboardCard = {
            id: crypto.randomUUID(),
            url,
            caption,
            director_id: body.directorId,
            director_name: persona.name,
            technique_key: normalizeKey(p.technique),
            created_at: Date.now(),
          };
          // Append to whiteboard_images. Read-modify-write — these arrive
          // one at a time so the race window is tiny.
          try {
            const { data: latest } = await db
              .from("generations")
              .select("agent_config")
              .eq("id", body.generationId)
              .single();
            const latestCfg =
              (latest?.agent_config as Record<string, unknown> | null) || {};
            const refsFinal = [
              ...((latestCfg.whiteboard_images as WhiteboardCard[] | undefined) ||
                []),
              card,
            ];
            await db
              .from("generations")
              .update({
                agent_config: { ...latestCfg, whiteboard_images: refsFinal },
              })
              .eq("id", body.generationId);
          } catch (err) {
            console.warn(
              "[/api/lesson/starter-pack] bg ref persist failed:",
              err
            );
          }
        } catch (err) {
          console.warn(
            "[/api/lesson/starter-pack] bg image gen failed (non-fatal):",
            err instanceof Error ? err.message : String(err)
          );
        }
      }
    })();

    return NextResponse.json({
      lessons: newLessons,
      references: [], // images still generating in background; surface on resume
    });
  } catch (err) {
    console.error("[/api/lesson/starter-pack] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
