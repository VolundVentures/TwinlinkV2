import { db } from "@/lib/db";

/**
 * Build a compact, tag-indexed manifest of every asset this generation has
 * produced so far. Injected into the agent's system prompt on every run so
 * the director has full awareness of the project state, even after the
 * conversation history is compacted or the user returns weeks later.
 *
 * Keep the output tight — it's in every prompt.
 */

type AssetRow = {
  id: string;
  type: string;
  tag: string | null;
  asset_role: string | null;
  aspect_ratio: string | null;
  public_url: string | null;
  status: string | null;
  parent_asset_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export type ProjectState = {
  hasAny: boolean;
  treatment: {
    title?: string;
    logline?: string;
    endCard?: string;
    durationSeconds?: number;
    aspectRatio?: string;
    shotCount?: number;
    /** The planned plates list from the treatment — surfaces what the agent
        must generate during the WORLD stage. Without this, the agent gets the
        instruction "generate every plate" but no plate list to work from. */
    plannedPlates?: Array<{
      tag?: string;
      kind?: string;
      parentTag?: string;
      description?: string;
    }>;
    /** The planned shots list from the treatment — surfaces what the agent
        must compose during STORYBOARD/SHOOT. */
    plannedShots?: Array<{
      id?: string;
      label?: string;
      duration?: number;
      model?: string;
      keyframePlan?: string;
      plateRefs?: string[];
      motion?: string;
      hasShotBuild?: boolean;
    }>;
  } | null;
  plates: Array<{ tag: string; kind?: string; parentTag?: string; description?: string }>;
  keyframes: Array<{
    tag?: string;
    shotId?: string;
    role?: string;
    /** Lifted from shot_spec — surfaces what the keyframe is actually depicting. */
    scale?: string;
    lens?: string;
    angle?: string;
    keyLight?: string;
    mood?: string;
    subjectAction?: string;
  }>;
  shots: Array<{
    shotId?: string;
    mode?: string;
    duration?: number;
    aspect?: string;
    /** The LLM-authored motion description that was sent to Gen-4.5 (pre-augmentation). */
    motionPrompt?: string;
    /** The keyframe this shot animates — lets the director cross-reference. */
    keyframeTag?: string;
    /** Lifted from the keyframe's shot_spec so SHOOT-room review has cinematic specifics. */
    scale?: string;
    lens?: string;
    angle?: string;
    keyLight?: string;
    mood?: string;
    subjectAction?: string;
  }>;
  finalFilm: { aspectRatio?: string; durationSeconds?: number } | null;
};

export async function buildProjectState(generationId: string): Promise<ProjectState> {
  const empty: ProjectState = {
    hasAny: false,
    treatment: null,
    plates: [],
    keyframes: [],
    shots: [],
    finalFilm: null,
  };

  if (!generationId) return empty;

  try {
    const { data: rows, error } = await db
      .from("generation_assets")
      .select(
        "id, type, tag, asset_role, aspect_ratio, public_url, status, parent_asset_id, created_at, metadata"
      )
      .eq("generation_id", generationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("[project-state] DB error:", error.message);
      return empty;
    }
    if (!rows?.length) return empty;

    const state: ProjectState = { ...empty, hasAny: true };
    const seenTags = new Set<string>();

    for (const r of rows as AssetRow[]) {
      const meta = r.metadata || {};
      const tag = r.tag || (meta.tag as string | undefined) || undefined;

      if (r.type === "script") {
        const plannedPlates = Array.isArray(meta.plates)
          ? (meta.plates as Array<Record<string, unknown>>).map((p) => ({
              tag: p.tag as string | undefined,
              kind: p.kind as string | undefined,
              parentTag: p.parent_tag as string | undefined,
              description: ((p.description as string) || "").slice(0, 200),
            }))
          : undefined;
        const plannedShots = Array.isArray(meta.shots)
          ? (meta.shots as Array<Record<string, unknown>>).map((s) => ({
              id: s.id as string | undefined,
              label: s.label as string | undefined,
              duration: s.duration_seconds as number | undefined,
              model: s.model as string | undefined,
              keyframePlan: s.keyframe_plan as string | undefined,
              plateRefs: Array.isArray(s.plate_refs)
                ? (s.plate_refs as string[])
                : undefined,
              motion: ((s.motion as string) || "").slice(0, 160),
              hasShotBuild:
                Array.isArray(s.shot_build) && (s.shot_build as unknown[]).length > 0,
            }))
          : undefined;
        state.treatment = {
          title: meta.title as string,
          logline: meta.logline as string,
          endCard: meta.end_card as string,
          durationSeconds: meta.duration_seconds as number,
          aspectRatio: meta.aspect_ratio as string,
          shotCount: Array.isArray(meta.shots) ? (meta.shots as unknown[]).length : undefined,
          plannedPlates,
          plannedShots,
        };
        continue;
      }

      const role = r.asset_role || (meta.role as string | undefined);

      if (role === "plate" && tag && !seenTags.has(tag)) {
        seenTags.add(tag);
        state.plates.push({
          tag,
          kind: meta.plate_kind as string,
          parentTag: meta.parent_tag as string,
          description: (meta.description as string)?.slice(0, 120),
        });
      } else if (role === "keyframe" && tag) {
        if (!seenTags.has(tag)) {
          seenTags.add(tag);
          const spec = (meta.shot_spec as Record<string, unknown> | undefined) || {};
          const staging = (spec.staging as Record<string, unknown> | undefined) || {};
          const light = (spec.light as Record<string, unknown> | undefined) || {};
          state.keyframes.push({
            tag,
            shotId: meta.shot_id as string,
            role: meta.keyframe_role as string,
            scale: spec.scale as string | undefined,
            lens: spec.lens as string | undefined,
            angle: spec.angle as string | undefined,
            keyLight: light.key_direction as string | undefined,
            mood: spec.mood as string | undefined,
            subjectAction: (staging.subject_action as string | undefined)?.slice(0, 120),
          });
        }
      } else if (role === "shot") {
        state.shots.push({
          shotId: meta.shot_id as string,
          mode: meta.mode as string,
          duration: meta.duration as number,
          aspect: r.aspect_ratio || undefined,
          motionPrompt: (meta.prompt as string | undefined)?.slice(0, 140),
          keyframeTag: meta.keyframe_tag as string | undefined,
        });
      } else if (role === "final_film") {
        state.finalFilm = {
          aspectRatio: r.aspect_ratio || undefined,
          durationSeconds: meta.duration_seconds as number,
        };
      }
    }

    // Join shot ↔ keyframe by tag so SHOOT/CUT review can show the director
    // the cinematic spec (scale, lens, light, mood, subject action) for
    // every rendered shot. Without this join, the director sees only the
    // shot id + URL when commenting — and starts inventing what's in the
    // frame.
    if (state.shots.length && state.keyframes.length) {
      const kfByTag = new Map(state.keyframes.map((k) => [k.tag, k]));
      const kfByShot = new Map<string, (typeof state.keyframes)[number]>();
      for (const k of state.keyframes) {
        if (k.shotId) kfByShot.set(k.shotId, k);
      }
      for (const s of state.shots) {
        const kf =
          (s.keyframeTag && kfByTag.get(s.keyframeTag)) ||
          (s.shotId && kfByShot.get(s.shotId)) ||
          null;
        if (!kf) continue;
        s.scale = kf.scale;
        s.lens = kf.lens;
        s.angle = kf.angle;
        s.keyLight = kf.keyLight;
        s.mood = kf.mood;
        s.subjectAction = kf.subjectAction;
      }
    }

    return state;
  } catch (err) {
    console.error("[project-state] fatal:", err);
    return empty;
  }
}

/**
 * Render the project state as a compact markdown block for the system prompt.
 * Empty = returns empty string (no section).
 */
export function renderProjectStateSection(state: ProjectState): string {
  if (!state.hasAny) return "";

  const lines: string[] = ["## CURRENT PROJECT STATE (from DB — always authoritative)"];

  if (state.treatment) {
    const t = state.treatment;
    lines.push("");
    lines.push("### Treatment (locked)");
    if (t.title) lines.push(`- **Title:** ${t.title}`);
    if (t.logline) lines.push(`- **Logline:** ${t.logline}`);
    if (t.endCard) lines.push(`- **End card:** "${t.endCard}"`);
    if (t.durationSeconds || t.aspectRatio)
      lines.push(`- **Spec:** ${t.durationSeconds || "?"}s · ${t.aspectRatio || "?"}`);
    if (t.shotCount !== undefined) lines.push(`- **Planned shots:** ${t.shotCount}`);

  }
  // (Planned-plates / planned-shots blocks are consolidated below into the
  // "X of Y rendered" progress sections — those show both what's done and
  // what's remaining in a single block per lane.)

  // Plates — always show rendered count vs planned count so the director
  // sees PROGRESS, not just an absolute number. Critical: the director was
  // approving "plates" when only 3 of 6 were rendered because they only saw
  // the 3 and assumed completion. The "remaining" list makes the gap
  // explicit; the "GENERATION IN PROGRESS" header is the loudest signal.
  if (state.plates.length || state.treatment?.plannedPlates?.length) {
    const planned = state.treatment?.plannedPlates || [];
    const renderedTags = new Set(state.plates.map((p) => p.tag));
    const remaining = planned.filter(
      (p) => p.tag && !renderedTags.has(p.tag)
    );
    const total = Math.max(state.plates.length, planned.length);
    const inProgress = remaining.length > 0;
    lines.push("");
    lines.push(
      `### Plates — ${state.plates.length} of ${total} rendered${
        inProgress ? " · GENERATION IN PROGRESS, do NOT approve yet" : " · all on screen"
      }`
    );
    for (const p of state.plates) {
      const head = `- **@${p.tag}** · ${p.kind || "plate"}${p.parentTag ? ` ← @${p.parentTag}` : ""}`;
      lines.push(p.description ? `${head} — ${p.description}` : head);
    }
    if (remaining.length) {
      lines.push(
        `_${remaining.length} planned plate${remaining.length === 1 ? "" : "s"} still rendering — DO NOT reference these by name yet, they're not on screen:_`
      );
      for (const p of remaining) {
        lines.push(
          `- (pending) @${p.tag || "?"} · ${p.kind || "?"}${
            p.parentTag ? ` ← @${p.parentTag}` : ""
          }`
        );
      }
    }
  }

  // Keyframes — one per planned shot. Show rendered vs planned with the
  // same "X of Y · GENERATION IN PROGRESS" header so the director can't
  // approve before the lane is complete.
  if (state.keyframes.length || state.treatment?.plannedShots?.length) {
    const plannedShots = state.treatment?.plannedShots || [];
    const expectedKeyframes = plannedShots.filter(
      (s) => s.id && s.model !== "image_clip"
    );
    const totalKf = Math.max(state.keyframes.length, expectedKeyframes.length);
    const inProgressKf =
      expectedKeyframes.length > 0 &&
      state.keyframes.length < expectedKeyframes.length;
    lines.push("");
    lines.push(
      `### Keyframes — ${state.keyframes.length} of ${totalKf} composed${
        inProgressKf ? " · GENERATION IN PROGRESS, do NOT approve yet" : " · all on screen"
      }`
    );
    const byShot = new Map<string, typeof state.keyframes>();
    for (const k of state.keyframes) {
      const s = k.shotId || "misc";
      if (!byShot.has(s)) byShot.set(s, []);
      byShot.get(s)!.push(k);
    }
    for (const [shot, kfs] of byShot) {
      const tagList = kfs.map((k) => `@${k.tag}${k.role ? `(${k.role})` : ""}`).join(", ");
      lines.push(`- **${shot}** → ${tagList}`);
    }
    if (inProgressKf) {
      const renderedShotIds = new Set(state.keyframes.map((k) => k.shotId));
      const missing = expectedKeyframes.filter((s) => !renderedShotIds.has(s.id));
      if (missing.length) {
        lines.push(
          `_${missing.length} keyframe${missing.length === 1 ? "" : "s"} still composing:_`
        );
        for (const m of missing) {
          lines.push(`- (pending) ${m.id || "?"} — ${m.label || ""}`);
        }
      }
    }
  }

  // Shots — videos animated from keyframes.
  if (state.shots.length || state.treatment?.plannedShots?.length) {
    const plannedShots = state.treatment?.plannedShots || [];
    const expectedShots = plannedShots.filter((s) => s.id);
    const totalShots = Math.max(state.shots.length, expectedShots.length);
    const inProgressShots =
      expectedShots.length > 0 && state.shots.length < expectedShots.length;
    lines.push("");
    lines.push(
      `### Shots — ${state.shots.length} of ${totalShots} rendered${
        inProgressShots ? " · GENERATION IN PROGRESS, do NOT approve yet" : " · all on screen"
      }`
    );
    for (const s of state.shots) {
      lines.push(
        `- **${s.shotId || "?"}** · ${s.duration ?? "?"}s · ${s.aspect || "?"}${
          s.keyframeTag ? ` · keyframe @${s.keyframeTag}` : ""
        }`
      );
      const specParts: string[] = [];
      if (s.scale) specParts.push(`scale ${s.scale}`);
      if (s.lens) specParts.push(`${s.lens}`);
      if (s.angle) specParts.push(`${s.angle}`);
      if (s.keyLight) specParts.push(`key from ${s.keyLight}`);
      if (s.mood) specParts.push(`mood "${s.mood}"`);
      if (specParts.length) lines.push(`  spec: ${specParts.join(" · ")}`);
      if (s.subjectAction) lines.push(`  subject: ${s.subjectAction}`);
      if (s.motionPrompt) lines.push(`  motion: ${s.motionPrompt}`);
    }
    if (inProgressShots) {
      const renderedShotIds = new Set(state.shots.map((s) => s.shotId));
      const missing = expectedShots.filter((s) => !renderedShotIds.has(s.id));
      if (missing.length) {
        lines.push(
          `_${missing.length} shot${missing.length === 1 ? "" : "s"} still rendering:_`
        );
        for (const m of missing) {
          lines.push(`- (pending) ${m.id || "?"} — ${m.label || ""}`);
        }
      }
    }
  }

  if (state.finalFilm) {
    lines.push("");
    lines.push(
      `### Final cut — delivered at ${state.finalFilm.aspectRatio || "?"} · ${state.finalFilm.durationSeconds || "?"}s`
    );
  }

  lines.push("");
  lines.push(
    "Any @tag above is already generated and resolvable. Reference by @tag in prompts — the tool layer resolves to URLs automatically. You may also call `list_assets` at any time to refresh this view."
  );

  return lines.join("\n");
}
