// cite_lesson — appends a teaching reference to the project's lesson plan.
//
// Fired by the agent (and proxied from the live director Characters API
// session) when a real-film technique is invoked during teaching. Each card
// is one specific film + one technique + the why. Stored in
// generations.metadata.lesson_plan and emitted as a `lesson_added` SSE event
// for the Film School sidebar.
//
// The discipline (per system prompt): cite_lesson is the ONLY way teaching
// references reach the user. Don't paraphrase a film into the chat — fire the
// tool. The cards are the deliverable. Free.

import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { db } from "@/lib/db";

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

export const citeLessonDefinition: ToolDefinition = {
  name: "cite_lesson",
  description:
    "Cite a real film + technique as a teaching moment. Card lands in the user's Film School sidebar and the final dossier's lesson_plan.md.\n\n" +
    "**When to fire this tool:**\n" +
    "- During PITCH — when a director introduces a craft principle.\n" +
    "- During SCRIPT review — when explaining a structural choice.\n" +
    "- During WORLD/STORYBOARD/SHOOT — when justifying a plate/keyframe/shot decision with reference to a real film.\n" +
    "- During CUT review — when defending a coverage or signature decision.\n\n" +
    "**Rules:**\n" +
    "- One card = one film + one technique. If you cite three films at once, fire three calls.\n" +
    "- The film must be real and from the lead/co director's filmsCited list. Don't invent films.\n" +
    "- The `why` is one sentence — what the user just learned. Keep it specific.\n" +
    "- `asset_id` is optional — pass it when the lesson is anchored to a specific plate/keyframe/shot the user can click to see in context.\n\n" +
    "Free — no credit charge. Just fire it whenever you teach.",
  input_schema: {
    type: "object",
    properties: {
      director_id: {
        type: "string",
        description:
          "ID of the director making this citation. Should be the lead or co director from this project.",
      },
      film: {
        type: "string",
        description:
          "Real film title (must be from the citing director's filmsCited list). Example: 'Goodfellas'.",
      },
      year: {
        type: "number",
        description: "Optional year of the film for disambiguation.",
      },
      technique: {
        type: "string",
        description:
          "The specific technique being cited. Example: 'long Steadicam tracking (Copacabana entrance)'.",
      },
      why: {
        type: "string",
        description:
          "One sentence explaining why this technique applies to the current decision. The user just learned this.",
      },
      asset_id: {
        type: "string",
        description:
          "Optional — DB id of a plate/keyframe/shot the lesson is anchored to. Lets the user click the lesson card to view the asset in context.",
      },
    },
    required: ["director_id", "film", "technique", "why"],
  },
};

export const citeLessonTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const directorId = input.director_id as string;
  const film = (input.film as string).trim();
  const year = input.year as number | undefined;
  const technique = (input.technique as string).trim();
  const why = (input.why as string).trim();
  const assetId = input.asset_id as string | undefined;

  if (!directorId || !film || !technique || !why) {
    return {
      success: false,
      content: "cite_lesson requires director_id, film, technique, and why.",
    };
  }

  const card: LessonCard = {
    id: crypto.randomUUID(),
    director_id: directorId,
    film,
    year,
    technique,
    why,
    asset_id: assetId,
    created_at: Date.now(),
  };

  // Append to generations.agent_config.lesson_plan. We read-modify-write
  // because Postgres jsonb append from inside the agent is more brittle than
  // just doing it in JS — the call frequency is low (a few cards per phase).
  // Stored on agent_config (not metadata — that column doesn't exist on
  // generations).
  try {
    const { data: gen } = await db
      .from("generations")
      .select("agent_config")
      .eq("id", context.generationId)
      .single();

    const cfg = (gen?.agent_config as Record<string, unknown> | null) || {};
    const existing = (cfg.lesson_plan as LessonCard[] | undefined) || [];
    const next = [...existing, card];

    await db
      .from("generations")
      .update({ agent_config: { ...cfg, lesson_plan: next } })
      .eq("id", context.generationId);
  } catch (err) {
    console.warn("[tool:cite_lesson] persist failed (non-fatal):", err);
  }

  // Surface to the UI immediately. The sidebar listens for `lesson_added`.
  emitter.send("lesson_added", card);

  return {
    success: true,
    content: `Lesson cited: ${film}${year ? ` (${year})` : ""} — ${technique}.`,
    data: card,
  };
};
