// GET /api/dossier/[generationId]
//
// Returns the Production Dossier manifest — a JSON bundle of every artifact
// in the project, rendered for download / archival. The frontend uses this
// to build the Premiere "download dossier" view.
//
// Format:
//   {
//     project: { title, logline, durationSeconds, aspectRatio, endCard, ... },
//     treatment_md: string  // rendered Markdown
//     lesson_plan_md: string
//     directors_notes_md: string  // pitch + storyboard discussion + review
//     shot_list_csv: string
//     project_json: object  // reopenable project state
//     assets: {
//       final_film?: { url, label }
//       plates: Array<{ tag, kind, url, description }>
//       keyframes: Array<{ tag, shot_id, url, role }>
//       shots: Array<{ shot_id, url, mode, duration, aspect }>
//       references: Array<{ url, caption, director }>  // whiteboard cards
//     }
//   }
//
// The shape is verbose by design so the frontend can build a tidy download
// UI without re-querying. Streaming a real ZIP requires a binary lib that
// isn't installable here; the per-asset URLs are CDN-hosted so the user
// downloads them directly.

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

type AssetRow = {
  id: string;
  type: string;
  asset_role?: string | null;
  tag?: string | null;
  public_url: string | null;
  aspect_ratio?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
};

type LessonCard = {
  id: string;
  director_id: string;
  film: string;
  year?: number;
  technique: string;
  why: string;
  created_at: number;
};

type Suggestion = {
  id: string;
  type: string;
  director_id: string;
  director_name: string;
  status: "pending" | "applied" | "passed";
  summary: string;
  created_at: number;
  target_ref?: string;
  direction?: string;
  brief?: string;
};

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: number;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  const { generationId } = await params;
  if (!generationId) {
    return NextResponse.json({ error: "generationId required" }, { status: 400 });
  }

  try {
    // Two-step fetch so a missing `generation_assets` relationship name
    // (which differs across Supabase setups) doesn't cause a "not found"
    // false negative on the parent row. The previous single-query JOIN
    // version was 404ing even when the generation row existed.
    // `generations` does NOT have duration_seconds / aspect_ratio columns —
    // the film spec lives in the treatment script asset's metadata (set by
    // write_script). Querying those columns 500s with PG 42703.
    const { data: gen, error: genErr } = await db
      .from("generations")
      .select("id, prompt, agent_config, created_at")
      .eq("id", generationId)
      .maybeSingle();
    if (genErr) {
      console.error("[/api/dossier] generation lookup failed:", genErr);
      return NextResponse.json(
        { error: `lookup failed: ${genErr.message}` },
        { status: 500 }
      );
    }
    if (!gen) {
      console.warn(`[/api/dossier] no generation row for id=${generationId}`);
      return NextResponse.json(
        { error: `generation ${generationId} not found` },
        { status: 404 }
      );
    }
    const { data: assetsRaw } = await db
      .from("generation_assets")
      .select("*")
      .eq("generation_id", generationId);
    const assets = assetsRaw || [];
    // Re-attach in the shape downstream code expects.
    (gen as Record<string, unknown>).generation_assets = assets;

    const cfg = (gen.agent_config as Record<string, unknown> | null) || {};
    const lessons = (cfg.lesson_plan as LessonCard[] | undefined) || [];
    const suggestions = (cfg.suggestions as Suggestion[] | undefined) || [];
    const whiteboardImages = (cfg.whiteboard_images as Array<{
      url: string;
      caption: string;
      director_name: string;
      created_at?: number;
    }> | undefined) || [];

    // Source-of-truth asset rows — we attached these above after the
    // two-step fetch. The `gen` row was selected without the join so the
    // type doesn't carry `generation_assets`; reach for the field we
    // attached manually.
    const rows =
      ((gen as Record<string, unknown>).generation_assets as
        | AssetRow[]
        | null) || [];

    let treatment: Record<string, unknown> | null = null;
    const platesOut: Array<{
      tag: string;
      kind: string;
      url: string;
      description?: string;
    }> = [];
    const keyframesOut: Array<{
      tag?: string;
      shot_id?: string;
      url: string;
      role?: string;
    }> = [];
    const shotsOut: Array<{
      shot_id?: string;
      url: string;
      mode?: string;
      duration?: number;
      aspect?: string;
    }> = [];
    let finalFilm: { url: string; aspect?: string; duration?: number } | null = null;

    for (const r of rows) {
      const meta = r.metadata || {};
      const role = r.asset_role || (meta.role as string | undefined);
      if (r.type === "script") {
        treatment = meta;
        continue;
      }
      if (!r.public_url) continue;
      if (role === "plate" && r.tag) {
        platesOut.push({
          tag: r.tag,
          kind: (meta.plate_kind as string) || "plate",
          url: r.public_url,
          description: meta.description as string | undefined,
        });
      } else if (role === "keyframe") {
        keyframesOut.push({
          tag: r.tag || undefined,
          shot_id: meta.shot_id as string | undefined,
          url: r.public_url,
          role: meta.keyframe_role as string | undefined,
        });
      } else if (role === "shot") {
        shotsOut.push({
          shot_id: meta.shot_id as string | undefined,
          url: r.public_url,
          mode: meta.mode as string | undefined,
          duration: meta.duration as number | undefined,
          aspect: r.aspect_ratio || (meta.aspect_ratio as string) || undefined,
        });
      } else if (role === "final_film") {
        finalFilm = {
          url: r.public_url,
          aspect: r.aspect_ratio || undefined,
          duration: meta.duration_seconds as number | undefined,
        };
      }
    }

    // Pull conversation history for directors_notes
    const { data: sessions } = await db
      .from("agent_sessions")
      .select("messages, created_at")
      .eq("generation_id", generationId)
      .order("created_at", { ascending: true });
    const transcript: ChatMessage[] = [];
    for (const s of sessions || []) {
      const msgs = (s.messages as ChatMessage[] | null) || [];
      for (const m of msgs) transcript.push(m);
    }

    // ─── Render markdown / CSV ────────────────────────────────────────────
    const treatmentMd = renderTreatmentMd(treatment);
    const lessonPlanMd = renderLessonPlanMd(lessons);
    const directorsNotesMd = renderDirectorsNotesMd(transcript, suggestions);
    const shotListCsv = renderShotListCsv(shotsOut, keyframesOut, treatment);

    // Spec is sourced from the treatment, not from `generations` columns
    // (which were removed). Falls back to the final film's metadata if the
    // treatment didn't carry it.
    const durationSeconds =
      (treatment?.duration_seconds as number | undefined) ??
      finalFilm?.duration ??
      null;
    const aspectRatio =
      (treatment?.aspect_ratio as string | undefined) ??
      finalFilm?.aspect ??
      null;

    return NextResponse.json({
      project: {
        id: gen.id,
        title: (treatment?.title as string) || "Untitled",
        logline: treatment?.logline as string | undefined,
        end_card: treatment?.end_card as string | undefined,
        duration_seconds: durationSeconds,
        aspect_ratio: aspectRatio,
        created_at: gen.created_at,
      },
      treatment_md: treatmentMd,
      lesson_plan_md: lessonPlanMd,
      directors_notes_md: directorsNotesMd,
      shot_list_csv: shotListCsv,
      project_json: {
        treatment,
        suggestions,
        lessons,
      },
      assets: {
        final_film: finalFilm,
        plates: platesOut,
        keyframes: keyframesOut,
        shots: shotsOut,
        references: whiteboardImages.map((w) => ({
          url: w.url,
          caption: w.caption,
          director: w.director_name,
        })),
      },
    });
  } catch (err) {
    console.error("[/api/dossier]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// ─── Renderers ──────────────────────────────────────────────────────────

function renderTreatmentMd(t: Record<string, unknown> | null): string {
  if (!t) return "# Treatment\n\n_No treatment recorded._\n";
  const lines: string[] = [];
  lines.push(`# ${(t.title as string) || "Untitled"}`);
  lines.push("");
  if (t.logline) lines.push(`> ${t.logline}`);
  lines.push("");
  if (t.end_card) lines.push(`**End card.** "${t.end_card}"`);
  if (t.duration_seconds || t.aspect_ratio)
    lines.push(`**Duration · aspect.** ${t.duration_seconds || "?"}s · ${t.aspect_ratio || "?"}`);
  if (t.tone) lines.push(`**Tone.** ${t.tone}`);
  if (t.camera_rule) lines.push(`**Camera rule.** ${t.camera_rule}`);
  if (Array.isArray(t.reference_films))
    lines.push(`**Reference films.** ${(t.reference_films as string[]).join(" · ")}`);
  lines.push("");

  const plates = (t.plates as Array<Record<string, unknown>> | undefined) || [];
  if (plates.length) {
    lines.push(`## Plates (${plates.length})`);
    for (const p of plates) {
      lines.push(
        `- **@${p.tag}** · ${p.kind}${p.parent_tag ? ` ← @${p.parent_tag}` : ""} — ${p.description || ""}`
      );
    }
    lines.push("");
  }

  const shots = (t.shots as Array<Record<string, unknown>> | undefined) || [];
  if (shots.length) {
    lines.push(`## Shots (${shots.length})`);
    for (const s of shots) {
      lines.push(`### ${s.id} — ${s.label || ""}`);
      lines.push(`${s.duration_seconds || "?"}s · ${s.model || "?"}`);
      if (s.motion) lines.push(`Motion: ${s.motion}`);
      if (s.notes) lines.push(`_${s.notes}_`);
      lines.push("");
    }
  }

  if (t.voiceover && (t.voiceover as Record<string, unknown>).full_script) {
    lines.push(`## Voiceover`);
    lines.push(`> "${(t.voiceover as Record<string, unknown>).full_script}"`);
    lines.push("");
  }

  if (t.music) {
    const m = t.music as Record<string, unknown>;
    if (m.has_music) {
      lines.push(`## Music`);
      lines.push(`${m.description || ""}${m.mood ? ` · ${m.mood}` : ""}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

function renderLessonPlanMd(lessons: LessonCard[]): string {
  const lines: string[] = ["# Film School — what you learned", ""];
  if (lessons.length === 0) {
    lines.push("_No lessons recorded._");
    return lines.join("\n");
  }
  // Group by director
  const byDirector = new Map<string, LessonCard[]>();
  for (const l of lessons) {
    if (!byDirector.has(l.director_id)) byDirector.set(l.director_id, []);
    byDirector.get(l.director_id)!.push(l);
  }
  for (const [dirId, items] of byDirector) {
    lines.push(`## ${dirId}`);
    lines.push("");
    for (const l of items) {
      lines.push(`### ${l.film}${l.year ? ` (${l.year})` : ""} — ${l.technique}`);
      lines.push(l.why);
      lines.push("");
    }
  }
  return lines.join("\n");
}

function renderDirectorsNotesMd(
  transcript: ChatMessage[],
  suggestions: Suggestion[]
): string {
  const lines: string[] = ["# Director's Notes", ""];
  lines.push("## Decisions");
  lines.push("");
  if (suggestions.length === 0) {
    lines.push("_No decisions recorded._");
  } else {
    for (const s of suggestions) {
      lines.push(`- **[${s.status}]** ${s.director_name} — ${s.summary}`);
    }
  }
  lines.push("");
  lines.push("## Conversation");
  lines.push("");
  if (transcript.length === 0) {
    lines.push("_No transcript recorded._");
  } else {
    for (const m of transcript) {
      // Skip internal directives (start with "↗" or are bulky approval routings)
      if (m.role === "system") {
        if (m.content.trim().startsWith("↗")) lines.push(`> ${m.content}`);
        continue;
      }
      const role = m.role === "user" ? "**You**" : "**Director**";
      lines.push(`${role}: ${m.content}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

function renderShotListCsv(
  shots: Array<{
    shot_id?: string;
    url: string;
    mode?: string;
    duration?: number;
    aspect?: string;
  }>,
  keyframes: Array<{ tag?: string; shot_id?: string; url: string; role?: string }>,
  treatment: Record<string, unknown> | null
): string {
  const headers = [
    "shot_id",
    "label",
    "duration_s",
    "mode",
    "aspect",
    "keyframe_tag",
    "keyframe_url",
    "shot_url",
    "plate_refs",
  ];
  const lines = [headers.join(",")];
  const treatmentShots =
    (treatment?.shots as Array<Record<string, unknown>> | undefined) || [];
  // Build lookup tables
  const kfByShot = new Map<string, (typeof keyframes)[number]>();
  for (const k of keyframes) {
    if (k.shot_id) kfByShot.set(k.shot_id, k);
  }
  const renderedById = new Map<string, (typeof shots)[number]>();
  for (const s of shots) {
    if (s.shot_id) renderedById.set(s.shot_id, s);
  }
  // Iterate in treatment order for stability
  if (treatmentShots.length > 0) {
    for (const t of treatmentShots) {
      const id = (t.id as string) || "";
      const kf = kfByShot.get(id);
      const rendered = renderedById.get(id);
      const plateRefs = Array.isArray(t.plate_refs)
        ? (t.plate_refs as string[]).map((r) => `@${r}`).join(" ")
        : "";
      lines.push(
        [
          id,
          csvQuote((t.label as string) || ""),
          String(t.duration_seconds ?? ""),
          csvQuote((rendered?.mode as string) || (t.model as string) || ""),
          csvQuote((rendered?.aspect as string) || (t.aspect_ratio as string) || ""),
          csvQuote(kf?.tag || ""),
          csvQuote(kf?.url || ""),
          csvQuote(rendered?.url || ""),
          csvQuote(plateRefs),
        ].join(",")
      );
    }
  } else {
    // No treatment — fall back to rendered shots only
    for (const s of shots) {
      lines.push(
        [
          s.shot_id || "",
          "",
          String(s.duration ?? ""),
          csvQuote(s.mode || ""),
          csvQuote(s.aspect || ""),
          "",
          "",
          csvQuote(s.url),
          "",
        ].join(",")
      );
    }
  }
  return lines.join("\n");
}

function csvQuote(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
