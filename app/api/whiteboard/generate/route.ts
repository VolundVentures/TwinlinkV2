// POST /api/whiteboard/generate
//
// Called by the frontend whenever a director invokes the `show_visual_example`
// client_event tool during a Characters API conversation. The director gives
// us a vivid description of an image to show the user (a camera angle, a
// lens, a lighting setup, a frame from a fictional film). We render it via
// gpt_image_2 with the director's `imageStyleModifier` so the visual matches
// their school, then attach the image to the current generation as a
// "reference" asset (NOT a production plate — references live in their own
// lane and never become master shots).
//
// Moderation safety: gpt_image_2 has an aggressive text-safety filter that
// trips on incidental words ("violence", "blood", "weapon", "intimate", etc.)
// even when the cinematic intent is benign. We:
//   1. Sanitize the description to remove flagged tokens before sending.
//   2. On INPUT_PREPROCESSING.SAFETY.TEXT failure, retry with a softer
//      prompt that abstracts the description further.
//   3. On final failure, return 200 with `{ skipped: true, reason }` rather
//      than 500 — a missed teaching reference must not break the avatar
//      conversation, which is the user's primary surface.

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getPersonaById, type DirectorPersona } from "@/lib/directors";
import { generateImage, toGptImage2Ratio } from "@/lib/runway";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  directorId: string;
  /** The technique or principle being taught — short, like a textbook heading.
      e.g. "Slow Push-In", "Eyeline Match", "Rack Focus", "Window Backlight". */
  technique?: string;
  /** Description of the example frame(s) — vivid, specific. */
  description: string;
  /** One-sentence teaching note (≤80 chars). */
  caption: string;
  /** When provided, the image is attached to the project's References lane. */
  generationId?: string;
};

// Words that reliably trip Runway's text safety filter even in cinematic
// contexts. Replaced with safer cinematic equivalents before prompting.
const SOFTEN_MAP: Array<[RegExp, string]> = [
  [/\bblood(?:y|ied)?\b/gi, "dark stain"],
  [/\bgore?\b/gi, "wet sheen"],
  [/\bviolence\b/gi, "intensity"],
  [/\bviolent\b/gi, "intense"],
  [/\bkill(?:ed|ing|er)?\b/gi, "still"],
  [/\bmurder(?:ed|ing|er)?\b/gi, "tragedy"],
  [/\bweapons?\b/gi, "object"],
  [/\bguns?\b/gi, "object"],
  [/\bknife|knives\b/gi, "object"],
  [/\bcorpses?\b/gi, "figure"],
  [/\bdead\b/gi, "stilled"],
  [/\bnaked\b/gi, "bare-shouldered"],
  [/\bnude\b/gi, "bare-shouldered"],
  [/\bsex(?:ual|y)?\b/gi, "intimate"],
  [/\berotic\b/gi, "intimate"],
  [/\bdrugs?\b/gi, "smoke"],
  [/\binjection\b/gi, "movement"],
  [/\bsuicide\b/gi, "stillness"],
];

function sanitizeForModeration(text: string): string {
  let out = text;
  for (const [re, rep] of SOFTEN_MAP) out = out.replace(re, rep);
  return out;
}

function buildTextbookPrompt(args: {
  techniqueTitle: string;
  description: string;
  captionShort: string;
  persona: DirectorPersona;
}): string {
  const { techniqueTitle, description, captionShort, persona } = args;
  return [
    `A composed editorial reference page from a film school course book — photographed cleanly on a flat lit surface.`,
    ``,
    `Layout, top to bottom:`,
    `1) The technique title in elegant serif typography across the top, centered: "${techniqueTitle}". Black ink on warm off-white background, generous letter-spacing.`,
    `2) A single example frame below the title, occupying the center two-thirds of the page. The frame depicts: ${description}.`,
    `3) A thin horizontal rule below the frame.`,
    `4) Below the rule, a short caption in monospaced uppercase text, generously letter-spaced: "${captionShort}".`,
    `5) Tiny mark at the bottom-right corner: "via ${persona.name.toUpperCase()}" in mono, very faint.`,
    ``,
    `Aesthetic: warm off-white paper background, slight paper texture and grain, hand-printed editorial feel — like a page from a Cahiers du Cinéma technique manual or a director's masterclass workbook. Black ink only for typography. No glossy finish, no decorative ornaments, no color outside the central example frame.`,
    ``,
    `The example frame itself is in the visual style of: ${persona.imageStyleModifier}.`,
    ``,
    `STRICT RULES: do NOT add multiple frames, do NOT add arrows or annotations beyond what's described, do NOT add any text or captions other than the title, the caption line, and the "via" mark, do NOT use color in the typography. The page reads like a single textbook reference page, photographed flat.`,
  ].join("\n");
}

// Stripped-down fallback prompt — used after a moderation reject. Drops the
// raw description and keeps only the technique-name + a generic frame brief.
function buildAbstractFallbackPrompt(args: {
  techniqueTitle: string;
  captionShort: string;
  persona: DirectorPersona;
}): string {
  const { techniqueTitle, captionShort, persona } = args;
  return [
    `An editorial reference page from a film school course book.`,
    ``,
    `Layout: a serif title at the top reads "${techniqueTitle}". Below the title, a single illustrative frame depicting a generic cinematic moment that demonstrates the principle (no people in close detail; abstract or wide composition is fine). Below the frame, a thin horizontal rule, and a monospaced caption: "${captionShort}". A faint mono mark at the bottom-right reads "via ${persona.name.toUpperCase()}".`,
    ``,
    `Aesthetic: warm off-white paper, faint texture, black ink typography only, in the visual feel of ${persona.imageStyleModifier}. No additional text, no annotations, no decorative elements.`,
  ].join("\n");
}

function isModerationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { failureCode?: string; taskDetails?: { failureCode?: string }; message?: string };
  const code = e.failureCode || e.taskDetails?.failureCode || "";
  if (code.startsWith("INPUT_PREPROCESSING.SAFETY")) return true;
  return /moderation|safety|did not pass/i.test(e.message || "");
}

// Normalize technique / caption text for dedup: lowercase, strip punctuation,
// collapse whitespace. "Smash Zoom + Jump Cut!" → "smash zoom jump cut".
function normalizeKey(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    if (!body.directorId || !body.description || !body.caption) {
      return NextResponse.json(
        { error: "directorId, description, and caption are required" },
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

    const techniqueTitle = (body.technique || "TECHNIQUE").toUpperCase();
    const captionShort = body.caption.replace(/"/g, "'").slice(0, 80);
    const sanitizedDescription = sanitizeForModeration(body.description);

    // PROJECT-WIDE DEDUP. The persona prompt has a "you've already shown
    // these" block, but that's only refreshed on session reload — within a
    // single session the LLM can re-fire the same teaching example. We
    // refuse server-side, return the EXISTING card so the UI shows the
    // already-rendered image instead of stamping out duplicates.
    //
    // Dedup key: (director_id, normalized technique). Falls back to caption
    // if technique wasn't provided. Match window = entire project; once
    // taught, never re-taught.
    const techniqueKey = normalizeKey(body.technique || body.caption);
    if (body.generationId) {
      try {
        const { data: gen } = await db
          .from("generations")
          .select("agent_config")
          .eq("id", body.generationId)
          .single();
        const cfg = (gen?.agent_config as Record<string, unknown> | null) || {};
        const existing = (cfg.whiteboard_images as Array<{
          id: string;
          url: string;
          caption: string;
          director_id: string;
          director_name: string;
          technique_key?: string;
          created_at: number;
        }> | undefined) || [];
        const dupe = existing.find(
          (c) =>
            c.director_id === body.directorId &&
            ((c.technique_key && c.technique_key === techniqueKey) ||
              normalizeKey(c.caption) === techniqueKey)
        );
        if (dupe) {
          console.info(
            `[/api/whiteboard/generate] dedup hit — director "${body.directorId}" already showed "${techniqueKey}", returning existing card`
          );
          return NextResponse.json({
            url: dupe.url,
            caption: dupe.caption,
            directorId: dupe.director_id,
            directorName: dupe.director_name,
            cardId: dupe.id,
            deduped: true,
          });
        }
      } catch (err) {
        console.warn("[/api/whiteboard/generate] dedup lookup failed:", err);
      }
    }

    let task: Awaited<ReturnType<typeof generateImage>> | null = null;
    let lastErr: unknown = null;

    // Attempt 1: full textbook prompt with sanitized description.
    try {
      task = await generateImage({
        promptText: buildTextbookPrompt({
          techniqueTitle,
          description: sanitizedDescription,
          captionShort,
          persona,
        }),
        ratio: toGptImage2Ratio("16:9"),
        generationId: body.generationId || "",
        description: `whiteboard reference [${persona.name}]: ${body.caption.slice(0, 60)}`,
      });
    } catch (err) {
      lastErr = err;
      if (!isModerationError(err)) throw err;
      console.warn(
        "[/api/whiteboard/generate] moderation rejected attempt 1, retrying with abstract prompt"
      );
    }

    // Attempt 2: abstract fallback if attempt 1 failed moderation.
    if (!task) {
      try {
        task = await generateImage({
          promptText: buildAbstractFallbackPrompt({
            techniqueTitle,
            captionShort,
            persona,
          }),
          ratio: toGptImage2Ratio("16:9"),
          generationId: body.generationId || "",
          description: `whiteboard fallback [${persona.name}]: ${body.caption.slice(0, 60)}`,
        });
      } catch (err) {
        lastErr = err;
        if (!isModerationError(err)) throw err;
        console.warn(
          "[/api/whiteboard/generate] moderation rejected attempt 2; skipping whiteboard for this turn"
        );
      }
    }

    // Both attempts failed moderation — skip gracefully. Don't 500: the
    // avatar conversation must continue. The director just doesn't get a
    // visual aid for this teaching moment.
    if (!task) {
      return NextResponse.json({
        skipped: true,
        reason: "moderation",
        message: "The teaching reference couldn't be rendered (safety filter).",
        lastError:
          lastErr instanceof Error ? lastErr.message : String(lastErr),
      });
    }

    const url = Array.isArray(task.output)
      ? task.output[0]
      : (task.output as unknown as string);
    if (!url) {
      return NextResponse.json({ skipped: true, reason: "no-output" });
    }

    const card = {
      id: crypto.randomUUID(),
      url,
      caption: body.caption,
      director_id: body.directorId,
      director_name: persona.name,
      technique_key: techniqueKey,
      created_at: Date.now(),
    };

    // Attach to the project so it shows in the References lane and survives
    // resume. Stored in generations.agent_config (the only jsonb column on
    // this table). Best-effort — failures don't block the response.
    if (body.generationId) {
      try {
        const { data: gen } = await db
          .from("generations")
          .select("agent_config")
          .eq("id", body.generationId)
          .single();
        const cfg = (gen?.agent_config as Record<string, unknown> | null) || {};
        const existing = (cfg.whiteboard_images as Array<typeof card>) || [];
        await db
          .from("generations")
          .update({
            agent_config: { ...cfg, whiteboard_images: [...existing, card] },
          })
          .eq("id", body.generationId);
      } catch (err) {
        console.warn("[/api/whiteboard/generate] persist failed (non-fatal):", err);
      }
    }

    return NextResponse.json({
      url,
      caption: body.caption,
      directorId: body.directorId,
      directorName: persona.name,
      cardId: card.id,
    });
  } catch (err) {
    console.error("[/api/whiteboard/generate] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
