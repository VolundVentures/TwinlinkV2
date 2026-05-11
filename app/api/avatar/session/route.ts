// POST /api/avatar/session — create one or two parallel Runway Realtime
// Sessions for the lobby's chosen directors and return WebRTC credentials
// to the client.
//
// Pattern follows the rw-integrate-characters skill:
//   1. Client requests session creation with { leadDirectorId, coDirectorId? }.
//   2. Server creates an avatar per persona on first use (cached in-process).
//   3. Server creates a realtime session per persona, polls to READY, consumes
//      credentials.
//   4. Returns both credential bundles for the client to connect via the
//      @runwayml/avatars-react SDK.
//
// Two-director presence is critical for the AUTEUR demo (per plan §1.3).
// The client mounts two <AvatarSession> providers, one per credential bundle.
//
// SECURITY: never expose RUNWAYML_API_SECRET to the client. All Runway calls
// here are server-side.

import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { getPersonaById, type DirectorPersona } from "@/lib/directors";
import {
  createAvatar,
  createReadySession,
  uploadEphemeral,
  type AvatarVoice,
  type SessionCredentials,
} from "@/lib/runway";
import {
  getAvatarRecord,
  setAvatarRecord,
} from "@/lib/runway/avatar-ids-store";

// Runway content moderation rejects personality / startScript text it deems
// unsafe — the demo's grief-stricken cinema language ("merciless", "grief",
// "death", "watch", "father's death") regularly trips this even though every
// real film cites the same vocabulary. We softens before sending; on rejection
// we retry with the dynamic blocks stripped out entirely.
const MODERATION_SOFTEN_MAP: Array<[RegExp, string]> = [
  [/\bgrief(?:-worn|stricken)?\b/gi, "loss"],
  [/\bgrieving\b/gi, "remembering"],
  [/\bmerciless(?:ly)?\b/gi, "unsentimental"],
  [/\bunbearable\b/gi, "deeply felt"],
  [/\bdead\b/gi, "departed"],
  [/\bdeath\b/gi, "absence"],
  [/\bdying\b/gi, "fading"],
  [/\bcorpse(?:s)?\b/gi, "still figure"],
  [/\bblood(?:y|ied)?\b/gi, "warm tone"],
  [/\bgore?\b/gi, "intensity"],
  [/\bviolence\b/gi, "intensity"],
  [/\bviolent\b/gi, "intense"],
  [/\bkill(?:ed|ing|er)?\b/gi, "still"],
  [/\bmurder(?:ed|ing|er)?\b/gi, "tragedy"],
  [/\bsuicide\b/gi, "stillness"],
  [/\bweapons?\b/gi, "object"],
  [/\bguns?\b/gi, "object"],
  [/\bnaked\b/gi, "bare-shouldered"],
  [/\bnude\b/gi, "bare-shouldered"],
  [/\bsex(?:ual|y)?\b/gi, "intimate"],
  [/\berotic\b/gi, "intimate"],
];

function softenForModeration(text: string): string {
  if (!text) return text;
  let out = text;
  for (const [re, rep] of MODERATION_SOFTEN_MAP) out = out.replace(re, rep);
  return out;
}

function isAvatarTextRejection(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { message?: string };
  if (!e.message) return false;
  return /cannot be used for an avatar|update the personality|update the start script/i.test(
    e.message
  );
}
import {
  buildProjectState,
  renderProjectStateSection,
} from "@/lib/ai/project-state";
import { startSessionRpc } from "@/lib/runway/rpc-manager";

export const runtime = "nodejs";
export const maxDuration = 120; // upload + poll READY can take ~90s combined, leave headroom

/**
 * Resolve the avatar reference image for a persona.
 *
 * Strategy: upload the local portrait file to Runway's `/v1/uploads` endpoint
 * once per persona (cached in-process) and use the returned `runway://` URI
 * as the avatar's reference image. This avoids both:
 *   - the "localhost not reachable from Runway" problem with HTTPS URLs, AND
 *   - the 5MB data URI cap that 1920×1920 PNGs blow through (a 1920² PNG can
 *     easily be 3-5MB binary, ~6MB base64'd, which Runway rejects).
 *
 * Prefers `avatarReferenceUrl` (a separate file optimised for Characters API
 * input) when present; falls back to `portraitUrl` (the gallery image).
 */
async function resolvePortraitRunwayUri(persona: DirectorPersona): Promise<string> {
  // Resolution order:
  //   1. persona.avatarReferenceUrl if explicitly set on the JSON
  //   2. by convention: /directors/avatars/<id>.png (auto-discovered)
  //   3. fallback: persona.portraitUrl (the gallery image — last resort)
  //
  // Why this ordering: the avatar reference image is a Characters-API-
  // optimised frontal headshot, distinct from the editorial gallery portrait.
  // We auto-check the avatars subfolder so personas don't all need to be
  // patched with the field once the avatar generation script has run.
  const candidates: string[] = [];
  if (persona.avatarReferenceUrl) candidates.push(persona.avatarReferenceUrl);
  candidates.push(`/directors/avatars/${persona.id}.png`);
  candidates.push(persona.portraitUrl);

  for (const webPath of candidates) {
    const rel = webPath.replace(/^\//, "");
    const filePath = path.join(process.cwd(), "public", rel);
    if (fs.existsSync(filePath)) {
      // Stream rather than read-into-memory: the SDK's Uploadable type
      // accepts FsReadStream natively, and we avoid materialising the whole
      // 1920×1920 PNG (multi-MB) in memory just to upload it.
      const upload = await uploadEphemeral(fs.createReadStream(filePath));
      return upload.uri;
    }
  }
  throw new Error(
    `No portrait found for persona "${persona.id}" (looked at ${candidates.join(", ")}). ` +
      `Run \`node --env-file=.env scripts/generate-director-portraits.mjs\` first.`
  );
}

// Build the lead director's opening line. Conversational, introduces both
// directors when there's a co, explains roles, and invites the user to start.
// No model names, no jargon — this is the user's first impression.
//
// CONTINUATION mode: when the new session is a reload / switch (priorTranscript
// or projectStateBlock present), the director walks back IN-CHARACTER mid-
// conversation rather than re-introducing themselves. The user already knows
// who they are; re-introducing breaks the illusion.
function buildLeadIntro(
  lead: DirectorPersona,
  co: DirectorPersona | null,
  hasBrief: boolean,
  isContinuation: boolean,
  reactiveScript?: string
): string {
  // Reload / switch — pick up where the conversation left off. When a
  // reactive script is provided (auto-sync after an artifact landed), use
  // that — the director walks back in already discussing what's new.
  if (isContinuation) {
    if (reactiveScript) return reactiveScript;
    return `Sorry — give me a second to get back. Where were we?`;
  }
  const leadSchool = lead.school.toLowerCase();
  // First-time entry — full introduction.
  // If the user already pitched (briefText present), the intro acknowledges
  // their pitch and segues into a follow-up. Otherwise, the lead invites them
  // to start.
  if (co) {
    const coSchool = co.school.toLowerCase();
    if (hasBrief) {
      return (
        `Hi — I'm ${lead.name}. I direct in the ${leadSchool} tradition. ` +
        `With me is ${co.name}, from the ${coSchool} tradition. ` +
        `We'll be your directors on this film. ` +
        `You tell us what you want to make; we'll shape every choice with you and put it on screen. ` +
        `You have the final word on everything. ` +
        `I read your pitch — give me a moment to think on it, then I have a question or two before we start.`
      );
    }
    return (
      `Hi — I'm ${lead.name}. I direct in the ${leadSchool} tradition. ` +
      `With me is ${co.name}, from the ${coSchool} tradition. ` +
      `We'll be your directors on this film. ` +
      `You tell us what you want to make; we'll shape every choice with you and put it on screen. ` +
      `You have the final word on everything. ` +
      `Tell us about the film whenever you're ready — we're listening.`
    );
  }
  if (hasBrief) {
    return (
      `Hi — I'm ${lead.name}. I direct in the ${leadSchool} tradition. ` +
      `I'll be your director on this film. ` +
      `You tell me what you want to make; I'll shape every choice with you. ` +
      `You have the final word. ` +
      `I read your pitch — give me a moment to think on it, then I have a question or two before we start.`
    );
  }
  return (
    `Hi — I'm ${lead.name}. I direct in the ${leadSchool} tradition. ` +
    `I'll be your director on this film. ` +
    `You tell me what you want to make; I'll shape every choice with you. ` +
    `You have the final word. ` +
    `Tell me about the film whenever you're ready.`
  );
}

// Build a REACTIVE startScript for continuation sessions — the director walks
// back in already aware of what just landed and starts the conversation FROM
// there, instead of saying "where were we" and putting the burden on the user.
//
// Picks the most-recent meaningful artifact from project state and opens with
// a sentence about it. The user feels like the director was always paying
// attention — even though we're really just being smart about session timing.
function buildReactiveScript(args: {
  hasFinalFilm: boolean;
  shotsCount: number;
  keyframesCount: number;
  platesCount: number;
  /** Planned total per lane (from treatment metadata) — drives "X of Y" wording. */
  plannedShots?: number;
  plannedKeyframes?: number;
  plannedPlates?: number;
  treatmentTitle?: string;
  treatmentLogline?: string;
  pendingCheckpointStage?: string;
  /** Is the agent currently generating? Drives "still rendering" vs "all in" copy. */
  generationInProgress?: boolean;
}): string | null {
  const {
    hasFinalFilm,
    shotsCount,
    keyframesCount,
    platesCount,
    plannedShots = 0,
    plannedKeyframes = 0,
    plannedPlates = 0,
    treatmentTitle,
    treatmentLogline,
    pendingCheckpointStage,
    generationInProgress = false,
  } = args;

  // Pick the lane the AGENT IS CURRENTLY WORKING ON, falling back to the
  // most-recently-filled lane when idle. Two bugs this avoids:
  //   1. Stale checkpoint winning: pendingCheckpointStage="plates" wouldn't
  //      override an active keyframe lane.
  //   2. Last-filled winning over in-flight: walking back in while shots are
  //      generating (0 of 9 rendered yet, all 9 keyframes done) used to make
  //      the director say "keyframes are still landing 8 of 9" because the
  //      keyframes lane was the most recent NON-EMPTY one. Now we look at
  //      what stage the agent is on by following completion: if the prior
  //      lane is done AND generation is in progress, the next lane is
  //      active even with 0 rendered.
  type Lane = "final" | "shots" | "keyframes" | "plates" | "treatment" | null;
  const platesDone =
    plannedPlates === 0 || platesCount >= plannedPlates;
  const keyframesDone =
    plannedKeyframes === 0 || keyframesCount >= plannedKeyframes;
  const shotsDone =
    plannedShots === 0 || shotsCount >= plannedShots;

  let activeLane: Lane;
  if (hasFinalFilm) {
    activeLane = "final";
  } else if (shotsCount > 0 || (generationInProgress && keyframesDone)) {
    // Shots have rendered OR shots are the next stage (keyframes done, agent working)
    activeLane = "shots";
  } else if (keyframesCount > 0 || (generationInProgress && platesDone && treatmentTitle)) {
    activeLane = "keyframes";
  } else if (platesCount > 0 || (generationInProgress && treatmentTitle)) {
    activeLane = "plates";
  } else if (treatmentTitle) {
    activeLane = "treatment";
  } else {
    activeLane = null;
  }

  const progress = (rendered: number, planned: number): string =>
    planned > 0 ? `${rendered} of ${planned}` : String(rendered);

  // FINAL CUT
  if (activeLane === "final") {
    return `Right — the cut just came in. Let it play once. Then I want to walk through what landed and what I'd push further next time.`;
  }

  // SHOTS
  if (activeLane === "shots") {
    const stillRendering =
      generationInProgress &&
      plannedShots > 0 &&
      shotsCount < plannedShots;
    if (stillRendering) {
      return `Shots are rendering — ${progress(shotsCount, plannedShots)} so far. The rest are still coming in; let's watch what's landed and I'll flag anything off.`;
    }
    if (pendingCheckpointStage === "shots") {
      return `Shots are back — ${progress(shotsCount, plannedShots)} on screen. Watch them in order, then tell me which one isn't earning its second yet.`;
    }
    return `${progress(shotsCount, plannedShots)} shots on screen. Let's start there.`;
  }

  // KEYFRAMES — the lane that was failing on the user's reload
  if (activeLane === "keyframes") {
    const stillRendering =
      generationInProgress &&
      plannedKeyframes > 0 &&
      keyframesCount < plannedKeyframes;
    if (stillRendering) {
      return `Keyframes are composing — ${progress(keyframesCount, plannedKeyframes)} so far. The rest are still landing; I'll start with the ones that are in and flag what to push.`;
    }
    if (pendingCheckpointStage === "keyframes") {
      return `Keyframes landed — ${progress(keyframesCount, plannedKeyframes)} composed. Read them top to bottom. Tell me where the eye goes — that's all that matters for a hero frame.`;
    }
    return `${progress(keyframesCount, plannedKeyframes)} keyframes composed so far. Want me to walk through them?`;
  }

  // PLATES
  if (activeLane === "plates") {
    const stillRendering =
      generationInProgress &&
      plannedPlates > 0 &&
      platesCount < plannedPlates;
    if (stillRendering) {
      return `Plates are coming in — ${progress(platesCount, plannedPlates)} so far. Let's start with the cast and work outward; the rest are still rendering.`;
    }
    if (pendingCheckpointStage === "plates") {
      return `Plates are in — ${progress(platesCount, plannedPlates)} on screen. Cast first, then locations, then props. What's missing for you?`;
    }
    return `${progress(platesCount, plannedPlates)} plates on screen. Let me start with the cast.`;
  }

  // TREATMENT
  if (activeLane === "treatment") {
    if (pendingCheckpointStage === "treatment") {
      return `Right — the treatment came back. We landed on "${treatmentTitle}". ${
        treatmentLogline ? `"${treatmentLogline}" ` : ""
      }Read it on the right. What jumps out — the title, the end card, the shot count?`;
    }
    return `The treatment is on screen. Title: "${treatmentTitle}". What's your read?`;
  }

  return null;
}

// Avatar IDs are persisted to public/directors/avatar-ids.json so they survive
// dev-server restarts. Without this, every restart would re-create avatars on
// Runway (slow, expensive, and re-rolls Runway's processing pipeline which
// occasionally returns FAILED for inputs that succeed on retry).

async function ensureAvatar(directorId: string): Promise<string> {
  // 1. Check the file-backed store first.
  const stored = await getAvatarRecord(directorId);
  if (stored) return stored.avatarId;

  const persona = getPersonaById(directorId);
  if (!persona) throw new Error(`Director persona not found: ${directorId}`);

  // 2. Voice config: persona's `voice` may be `preset` or `custom` with optional voiceId.
  let voice: AvatarVoice;
  if (persona.voice.type === "preset") {
    voice = { type: "preset", presetId: persona.voice.presetId };
  } else if (persona.voice.voiceId) {
    voice = { type: "custom", voiceId: persona.voice.voiceId };
  } else {
    const fallback: "clara" | "victoria" | "vincent" =
      persona.deferenceRate < 0.45 ? "vincent" : persona.deferenceRate > 0.6 ? "clara" : "victoria";
    voice = { type: "preset", presetId: fallback };
  }

  // 3. Reference image: upload the director's portrait file to Runway.
  const referenceUri = await resolvePortraitRunwayUri(persona);

  const { avatarId } = await createAvatar({
    name: persona.name,
    referenceImage: referenceUri,
    voice,
    personality: persona.personality,
  });

  // 4. Only persist on success. A FAILED avatar throws above and we never
  // reach this line, so the store stays clean and the next call retries
  // (creating a brand-new avatar id on Runway).
  await setAvatarRecord(directorId, {
    avatarId,
    referenceUri,
    createdAt: Date.now(),
  });
  return avatarId;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      leadDirectorId: string;
      coDirectorId?: string;
      // SINGLE-ACTIVE-DIRECTOR ARCHITECTURE (May 2026):
      // Only ONE director is live at a time. The other is "in the wings".
      // The active director has a full realtime session; the wings director
      // is just metadata (portrait, name) shown in a card with a Switch
      // button. Defaults to leadDirectorId. When the user clicks Switch,
      // the client re-POSTs with the OTHER directorId as activeDirectorId.
      activeDirectorId?: string;
      personality?: string;
      startScript?: string;
      briefText?: string;
      generationId?: string;
      /** Prior conversation transcript — when the user switches directors or
          reloads, the new session walks in with the last few exchanges so
          the conversation has continuity. */
      priorTranscript?: Array<{ speaker: "user" | "director"; text: string }>;
      /** Current room label (PITCH | SCRIPT | WORLD | STORYBOARD | SHOOT |
          CUT | POST | PREMIERE) — surfaces in the persona prompt so the
          director knows where the user is in the flow. */
      currentPhase?: string;
      /** Pending workspace checkpoint — when the agent fired
          request_approval and the user hasn't approved yet. Surfaces in the
          persona so the director knows what's awaiting and can fire
          approve_checkpoint when they hear verbal approval. */
      pendingCheckpoint?: { stage: string; summary?: string } | null;
    };

    if (!body.leadDirectorId) {
      return NextResponse.json({ error: "leadDirectorId is required" }, { status: 400 });
    }

    const leadPersona = getPersonaById(body.leadDirectorId);
    if (!leadPersona) {
      return NextResponse.json({ error: `Unknown lead director: ${body.leadDirectorId}` }, { status: 400 });
    }
    const coPersona: DirectorPersona | null = body.coDirectorId
      ? getPersonaById(body.coDirectorId) ?? null
      : null;

    // Resolve which director is ACTIVE (gets a live session) and which is
    // in the WINGS (metadata only, switchable from the UI). Defaults to lead.
    const activeId = body.activeDirectorId || body.leadDirectorId;
    const activePersona =
      activeId === leadPersona.id ? leadPersona : (coPersona && activeId === coPersona.id ? coPersona : leadPersona);
    const wingsPersona: DirectorPersona | null =
      activePersona.id === leadPersona.id ? coPersona : leadPersona;

    // Create avatars for BOTH (avatar models are persistent and cached, so
    // pre-creating both makes future switches faster — only the realtime
    // session needs to come up). Active session is created; wings is not.
    const [activeAvatarId, wingsAvatarId] = await Promise.all([
      ensureAvatar(activePersona.id),
      wingsPersona ? ensureAvatar(wingsPersona.id) : Promise.resolve<string | null>(null),
    ]);

    // Pull project state if a generation is in progress. This lets the
    // directors walk in (or rejoin) with full awareness of what's been
    // generated and decided already — treatment, plates, keyframes, shots,
    // recent lessons, recent suggestions.
    let projectStateBlock = "";
    let recentLessonsBlock = "";
    let shownReferencesBlock = "";
    // Snapshot for the reactive startScript — what's the most recent thing
    // that landed? The director walks back in already discussing it.
    let reactiveSnapshot: {
      hasFinalFilm: boolean;
      shotsCount: number;
      keyframesCount: number;
      platesCount: number;
      plannedShots?: number;
      plannedKeyframes?: number;
      plannedPlates?: number;
      treatmentTitle?: string;
      treatmentLogline?: string;
      generationInProgress?: boolean;
    } = {
      hasFinalFilm: false,
      shotsCount: 0,
      keyframesCount: 0,
      platesCount: 0,
    };
    if (body.generationId) {
      try {
        const projectState = await buildProjectState(body.generationId);
        projectStateBlock = renderProjectStateSection(projectState);
        const plannedPlates =
          projectState.treatment?.plannedPlates?.length || 0;
        const plannedShots =
          projectState.treatment?.plannedShots?.length ||
          projectState.treatment?.shotCount ||
          0;
        // Read the agent status so the opener can distinguish "rendering"
        // from "done" — same flag get_project_state surfaces.
        const { data: genRow } = await db
          .from("generations")
          .select("status")
          .eq("id", body.generationId)
          .maybeSingle();
        const generationInProgress =
          ((genRow?.status as string | undefined) || "idle") !== "idle";
        reactiveSnapshot = {
          hasFinalFilm: !!projectState.finalFilm,
          shotsCount: projectState.shots.length,
          keyframesCount: projectState.keyframes.length,
          platesCount: projectState.plates.length,
          plannedShots,
          plannedKeyframes: plannedShots, // 1 hero keyframe per shot
          plannedPlates,
          treatmentTitle: projectState.treatment?.title,
          treatmentLogline: projectState.treatment?.logline,
          generationInProgress,
        };

        const { data: gen } = await db
          .from("generations")
          .select("agent_config")
          .eq("id", body.generationId)
          .single();
        const cfg = (gen?.agent_config as Record<string, unknown> | null) || {};

        const lessons = (cfg.lesson_plan as Array<{ film: string; technique: string; why: string; director_id: string }> | undefined) || [];
        if (lessons.length > 0) {
          const recent = lessons.slice(-5);
          recentLessonsBlock = [
            "",
            "## RECENT LESSONS YOU'VE TAUGHT",
            ...recent.map(
              (l) => `- *${l.film}* — ${l.technique} (${l.why})`
            ),
          ].join("\n");
        }

        // References already shown — so the director doesn't re-fire
        // show_visual_example with the same technique twice (the user
        // complained about duplicate cards on reload).
        const shown = (cfg.whiteboard_images as Array<{ caption: string; director_name?: string }> | undefined) || [];
        if (shown.length > 0) {
          const recentShown = shown.slice(-8);
          shownReferencesBlock = [
            "## REFERENCES YOU'VE ALREADY SHOWN",
            ...recentShown.map((r) => `- "${r.caption}"`),
            "Don't show these again. Use show_visual_example only for NEW techniques.",
          ].join("\n");
        }
      } catch (err) {
        console.warn("[/api/avatar/session] state injection failed:", err);
      }
    }

    // Personality assembly with HARD 10000-char cap (Runway API limit).
    // Budget across:
    //   ~2100  persona.personality (the director's identity — sacred, never trim)
    //   ~1000  briefText (capped 800 chars)
    //   ~3500  projectStateBlock (capped 2800 chars — what's on screen)
    //   ~600   recent lessons (capped 500 chars)
    //   ~500   co-direction context (when there's a co)
    //   ~1700  the static instructional scaffold (compressed below)
    //   = ~9400 typical, with ~600 char buffer.
    // Final fail-safe truncation kicks in if any block is unexpectedly large.
    const PERSONALITY_HARD_CAP = 9800;

    function clip(s: string, max: number): string {
      if (!s) return s;
      if (s.length <= max) return s;
      return s.slice(0, max - 3) + "...";
    }

    function withCoAwareness(persona: DirectorPersona, other: DirectorPersona | null) {
      const sections: string[] = [persona.personality];

      // CURRENT ROOM — single most important context after the persona itself.
      // Without this the director has been observed asking "have you written
      // the brief?" while the user is staring at a finished treatment, OR
      // proposing changes to shots that don't exist yet.
      //
      // Each room block has TWO halves: WHAT to discuss + WHICH propose_*
      // tools are allowed in this phase. Tools that target non-existent
      // assets (propose_alternative on shot_X during SCRIPT) cause the
      // background agent to error out — block them at the persona level.
      if (body.currentPhase) {
        const phaseGuide: Record<string, string> = {
          // PITCH — discuss the user's STORY only. No cinema teaching yet.
          // Push for: characters, mood, location, central image, what they
          // want to feel. After 2-3 short exchanges, ask if they're ready
          // for you to write the treatment, then propose_treatment.
          PITCH:
            "PITCH room — TWO MODES. (1) BEFORE you fire propose_treatment: STORY DISCUSSION primarily, with light cinema teaching welcome. Ask 2-3 short, concrete questions about characters, mood, location, the central image, what they want the audience to feel. As you go, you MAY fire cite_lesson once or twice when a real-film principle anchors what the user just described — it teaches the user mid-conversation and a textbook reference page renders alongside. Keep teaching beats short (4-6 sentences each, ~25s) so the user can keep talking. When you have a coherent picture, ASK 'shall I write the treatment?' and on a yes fire propose_treatment. (2) AFTER you fire propose_treatment/commit_proposal: the writer takes ~10s. Stay quiet OR fire ONE brief cite_lesson to fill the silence. Do NOT keep asking story questions — the writer is already using what you've discussed; the user is watching the workspace, not answering you. ALLOWED: propose_treatment, cite_lesson (both modes — sparingly in mode 1). FORBIDDEN: all other propose_*.",

          // WRITING — backend writer is generating the treatment. Director's
          // ONLY job is to teach cinema. No story questions, no inventing
          // details, no proposing anything. The user is watching the writer
          // work and has nothing to answer.
          WRITING:
            "WRITING room — TEACHING ONLY (writer is generating the treatment in the background, 30-60s). Your single job: teach cinema. Cite a real film + technique using cite_lesson — the system auto-renders a textbook page from your {film, technique, why}. Do at least 2 lessons during this window, 30-45s apart. CRITICAL: you do NOT have access to the treatment yet — DO NOT mention specific characters, objects, props, plates, shots, or details from the user's story (they don't exist on screen yet — referencing them is hallucination, the user will catch it). DO NOT ask the user any questions about the story or the production. DO NOT propose anything. Just teach. When the treatment lands you'll get fresh context and switch rooms. ALLOWED: cite_lesson only. FORBIDDEN: every propose_*, every approve_*, every story question.",

          // SCRIPT — treatment exists on screen. Read it together with the
          // user, synthesize, guide toward approval.
          SCRIPT:
            "SCRIPT room — TWO MODES. (1) BEFORE the user approves the treatment: REVIEW. Read the treatment WITH the user. Pull title, logline, end card, and 1-2 specific shots BY THEIR ID (shot_1, shot_2) STRAIGHT FROM the ON SCREEN block — never invent. Synthesize ('the camera holds on the daughter, then pulls back to find the watch'). Light cinema teaching OK when it clarifies a choice. ALLOWED: approve_checkpoint(stage='treatment') on approval, reject_checkpoint on rejection, propose_treatment for a full re-write, cite_lesson. FORBIDDEN: propose_alternative on shot_N or @plate (nothing rendered), propose_signature_pass, propose_coverage. NEVER claim a shot or plate is rendered. (2) AFTER you fire approve_checkpoint(stage='treatment'): plate generation runs 30-60s, no plates exist yet. Stay quiet OR fire 1-2 cite_lessons. Do NOT keep critiquing — the treatment is locked. Do NOT reference any plates by name — they don't exist yet (zero @tags = hallucination). The director can switch rooms automatically when the first plate lands.",

          // BETWEEN — agent is mid-stage (e.g. generating plates) but
          // nothing of that stage has rendered yet. Same teach-only rule
          // as WRITING.
          BETWEEN:
            "BETWEEN-STAGES room — TEACHING ONLY (the writer/renderer is generating in the background, no new assets on screen yet). Same rules as WRITING: teach cinema via cite_lesson, do NOT reference specific @plates / @kf_* / shot_N — none exist yet, mentioning them is hallucination. Do NOT ask the user questions, do NOT propose anything. When the next assets land, you'll get fresh context. ALLOWED: cite_lesson only.",

          WORLD:
            "WORLD room — PLATE REVIEW. Plates exist on screen (listed in the ON SCREEN block above). Discuss them by their @tag (use ONLY tags that appear in the block — never invent). ALLOWED: propose_alternative on EXISTING @plate_tag, approve_checkpoint(stage='plates'), reject_checkpoint, cite_lesson. FORBIDDEN: propose_alternative on @kf_* or shot_N (don't exist yet), propose_signature_pass, propose_coverage. NEVER reference a plate that isn't in the ON SCREEN block.",
          STORYBOARD:
            "STORYBOARD room — KEYFRAME REVIEW. Keyframes (composed first frames) on screen. Reference @kf_* tags ONLY from the ON SCREEN block. ALLOWED: propose_alternative on existing @kf_*, approve_checkpoint(stage='keyframes'), reject_checkpoint, cite_lesson. FORBIDDEN: propose_alternative on shot_N, propose_signature_pass, propose_coverage. NEVER invent a @kf_*.",
          SHOOT:
            "SHOOT room — SHOT REVIEW. Rendered shot videos on screen with the shot_spec lifted in the ON SCREEN block (scale, lens, key direction, mood, motion). Reference shot_N ONLY from the block. Discuss what's actually on screen: name the scale, name the key direction, name the mood. If the motion betrays the mood (e.g. mood is 'still' but motion has a fast push-in), call it out. ALLOWED: propose_alternative on shot_N for re-shoots (target the exact lens/light/motion issue you saw), approve_checkpoint(stage='shots') on explicit approval, reject_checkpoint, cite_lesson. FORBIDDEN: propose_signature_pass, propose_coverage (those are CUT-only). NEVER invent a shot.",
          CUT:
            "CUT room — EDITORIAL & SIGNATURE. The rendered shots are on screen; this is where you become an editor. PROACTIVELY suggest Aleph passes when they'd raise the bar: (a) propose_coverage when a shot would cut better with an alternate angle — close-up, OTS, reverse, insert; (b) propose_signature_pass on the master and each coverage variant so the film has YOUR grade fingerprint across the cut; (c) propose_alternative on a specific surgical fix (eyeline, weather, one practical light) when needed. Each suggestion targets shot_N or @kf_* that ALREADY exists in the ON SCREEN block. Lead with a one-line reason ('this two-shot needs a reverse — the eyeline matters here') before firing. ALLOWED: propose_coverage, propose_signature_pass, propose_alternative, cite_lesson, approve_checkpoint(stage='shots') on explicit approval, reject_checkpoint.",
          POST:
            "POST room. Voiceover + score + final compose happening. Discuss audio choices verbally. ALLOWED: cite_lesson. FORBIDDEN: every propose_*. The cut is locked into post.",
          PREMIERE:
            "PREMIERE. Final film is on screen. Discuss the cut as a whole; talk about what you'd do differently next time; teach lessons that land in the dossier. ALLOWED: cite_lesson. FORBIDDEN: every propose_*.",
        };
        const guide = phaseGuide[body.currentPhase] || "";
        sections.push(
          `=== YOU ARE IN THE ${body.currentPhase} ROOM ===\n${guide}`
        );
      }

      // AWAITING APPROVAL — current decision point. Push EARLY so it's
      // never lost to truncation; the director must always know which gate
      // is live.
      if (body.pendingCheckpoint?.stage) {
        const stage = body.pendingCheckpoint.stage;
        const summary = body.pendingCheckpoint.summary;
        sections.push(
          `=== AWAITING APPROVAL — ${stage.toUpperCase()} ===\n\nThe ${stage} is on the user's screen and they're deciding whether to advance. ${summary ? `Summary: ${summary}.` : ""} You're discussing it with them right now.\n\nVerbal approval ("approved" / "looks good" / "go ahead" / "ship it") → fire \`approve_checkpoint(stage="${stage}")\`.\nVerbal rejection ("redo it" / "I don't like it") → fire \`reject_checkpoint(stage="${stage}", reason="...")\`.\nSmall tweak ("make shot 4 warmer") → propose_alternative, NOT approval.`
        );
      }

      // Static scaffold (HARD RULES + STYLE) — pushed BEFORE dynamic context
      // blocks. Truncation cuts from the end, so the rules must come early
      // or anti-hallucination/no-invention gets sliced when the budget is
      // exceeded (which has happened on long-resume sessions with big
      // project states).
      sections.push(
        `=== ONE JOB AT A TIME ===\n\nThe ROOM block above is your ONLY job right now. Do not anticipate future rooms, do not reference assets that don't exist yet, do not blend roles. Each room has a single focus:\n  PITCH = story discussion (no cinema teaching)\n  WRITING = teach cinema while the writer works (no story questions, no inventing details)\n  SCRIPT = read the treatment with the user (only what's listed on screen)\n  BETWEEN = teach cinema while the next stage generates (no inventing assets)\n  WORLD/STORYBOARD/SHOOT = review specific @tags or shot_N from the ON SCREEN block\n  CUT/POST/PREMIERE = polish + retrospective\n\n=== HARD RULES ===\n\n` +
          `**1. NO HALLUCINATION — NEVER REFERENCE WHAT'S NOT ON SCREEN.** If a character name, prop, location, color, plate, keyframe, shot id, or detail does not appear word-for-word in the ON SCREEN block above (or in a fresh \`get_project_state\` response), DO NOT mention it. "Look at that watch" / "those blades" / "the alley" / "her red dress" — if those words aren't in your context, you are HALLUCINATING, and the user WILL catch it (this has burned every test run). When tempted: say what you literally see ("the title reads X"), call get_project_state, or — if nothing's there to discuss — TEACH instead (see your room rules).\n\n` +
          `**1b. RENDERED < PLANNED = STILL GENERATING. DO NOT APPROVE.** The ON SCREEN block shows "X of Y rendered" for each lane (plates / keyframes / shots). If X < Y for the current lane, generation is IN PROGRESS — the user is watching the rest land. NEVER fire approve_checkpoint while a lane is incomplete. If you're unsure, call get_project_state and read \`plates_done\` / \`keyframes_done\` / \`shots_done\` — only fire approval when the matching _done flag is TRUE and awaiting_approval names that exact stage. When the user says "approve" too early, respond: "We're still rendering — N of M done. Hold on, I'll lock it in once they're all here."\n\n` +
          `**2. NEVER end a turn with only a tool call.** Tool calls are silent. Every turn that fires a tool MUST also include at least one spoken sentence. Pattern: speak → fire tool(s) → speak again.\n\n` +
          `**3. STAY HONEST — USE \`get_project_state\` WHEN UNSURE.** The ON SCREEN block was snapshotted when you joined; if minutes have passed it's STALE. Before answering ANY question that depends on current state ("what's the title?" / "how many plates?" / "is it ready?"), call \`get_project_state\` first, THEN answer from its result. If treatment is null, the treatment doesn't exist yet — say so plainly. NEVER invent.\n\n` +
          `**4. WHAT YOU CAN'T DO.** You CANNOT directly generate anything — plates, keyframes, shots, voiceover, score, the final cut all come from the writer in the background. NEVER say "I'll generate / render / make". Say "I'd suggest" / "let me propose that" / "want me to have the writer do that?".\n\n` +
          `**5. PHASE-LOCKED BEHAVIOR — read your ROOM block. Do ONLY what your room allows. The room tells you which tools are ALLOWED and which are FORBIDDEN. Forbidden tools waste turns. Forbidden topics (story questions during WRITING, cinema teaching during PITCH, plate-talk before plates exist) confuse the user and trigger hallucinations.**\n\n` +
          `**6. TWO APPROVAL LEVELS.** Suggestion-level: propose_* → user "go ahead" → fire \`commit_proposal\` (rejection → \`dismiss_proposal\`). Workspace-level (when AWAITING APPROVAL block is set): user "approved" → fire \`approve_checkpoint(stage)\` (rejection → \`reject_checkpoint(stage, reason)\`). The two are SEPARATE — read the AWAITING APPROVAL block to know which one is live.\n\n` +
          `**7. TEACH IN DEPTH (only when your room calls for it). A real lesson is 4-6 sentences: set up the principle → cite a specific film + scene → name the technique → transfer it to the user's film. 25-40 seconds. Just fire \`cite_lesson\` with {film, technique, why} — the system auto-renders a textbook reference page (no separate show_visual_example needed). ONE card per technique per project; server dedupes — reference prior cards verbally instead of re-firing.\n\n` +
          `**8. SAY-FIRST-THEN-FIRE FOR APPROVALS.** Before firing \`approve_checkpoint\` or \`commit_proposal\`, ANNOUNCE what you're about to lock in. "Approving the plates and moving to keyframes." or "Locking the brief — writer's on it now." THEN fire. This audible announcement gives the user a 1-second window to say "wait" if you misheard. NEVER fire silently. NEVER fire on conversational filler ('ok', 'go ahead', 'sure', 'yes' alone) — those are NOT approvals (see tool descriptions for the strict trigger word list). The user explicitly said: 'if "go ahead" is hardcoded as approval it causes confusion'. When in doubt, ASK — never auto-advance.\n\n` +
          `=== STYLE ===\n\n` +
          `Speak like a real director — natural, no internal jargon, no model names. Films, not ads — never CTAs, never product reveals, never brand watermarks. When you don't know something, say so plainly ("I haven't seen that yet — read it to me?"). The cinema is the work; your voice is the conversation around it.`
      );

      // Dynamic context blocks — pushed AFTER the static scaffold so the
      // truncation tail eats them first if budget is exceeded. Caps tightened
      // in this pass (was bloating personality to ~14k chars on long
      // resume sessions, which truncated the rules and let the director
      // hallucinate).
      if (other) {
        sections.push(
          `=== CO-DIRECTION — YOU ARE ALONE ON THIS CALL ===\n${other.name} (${other.school}) is in the wings — NOT in the room, NOT on this call, CANNOT hear you. Don't ask, delegate, or pause for them. The user can switch via the Switch button. If asked for ${other.name}'s view, give your best read directly.`
        );
      }

      if (body.briefText && body.briefText.trim().length > 0) {
        sections.push(
          `=== THE USER'S PITCH ===\n\n${clip(body.briefText.trim(), 600)}\n\nAcknowledge in one sentence; don't ask them to repeat. Then 2-3 short story questions (characters, location, mood, central image, what they want the audience to feel). Stay in story mode — no cinema teaching. When you have a coherent picture, ASK 'shall I write the treatment?' and on yes, fire propose_treatment.`
        );
      }

      if (projectStateBlock) {
        sections.push(
          `=== ON SCREEN RIGHT NOW ===\n\nReference @tags by name — never invent. The TITLE on screen is whatever appears below.\n\n${clip(projectStateBlock, 1800)}`
        );
      }

      if (body.priorTranscript && body.priorTranscript.length > 0) {
        const transcriptLines = body.priorTranscript
          .slice(-8)
          .map(
            (t) =>
              `${t.speaker === "user" ? "User" : "Prior director"}: ${t.text}`
          )
          .join("\n");
        const transcriptBlock = clip(transcriptLines, 700);
        sections.push(
          `=== JUST BEFORE YOU JOINED ===\n\n${transcriptBlock}\n\nDon't ask the user to repeat what they already said — pick up from there.`
        );
      }

      if (recentLessonsBlock) {
        sections.push(clip(recentLessonsBlock.trim(), 350));
      }

      if (shownReferencesBlock) {
        sections.push(clip(shownReferencesBlock, 350));
      }

      const assembled = sections.filter(Boolean).join("\n\n");

      // Fail-safe — truncate from the end if a dynamic block blew past its
      // expected cap. Better to lose some style notes than to fail validation
      // and have the director never come up at all.
      if (assembled.length > PERSONALITY_HARD_CAP) {
        console.warn(
          `[/api/avatar/session] personality at ${assembled.length} chars > ${PERSONALITY_HARD_CAP} cap — truncating`
        );
        return assembled.slice(0, PERSONALITY_HARD_CAP - 3) + "...";
      }
      return assembled;
    }

    // ---- Tools registered on every avatar session ----
    //
    // ALL tools are `client_event` (fire-and-forget). The avatar fires the
    // event; the React SDK's `useClientEvent` hook picks it up; our frontend
    // handler updates state. backend_rpc tools are NOT used because they
    // require a publicly-reachable URL which complicates dev.
    //
    // Discipline: directors PROPOSE, the user DECIDES. The propose-* tools
    // create pending suggestion cards in the UI. The user can either click
    // Apply on a card OR say "go ahead" verbally — when the director hears
    // verbal approval, they fire `commit_proposal` to make it real.

    const SHOW_VISUAL_EXAMPLE_TOOL = {
      type: "client_event",
      name: "show_visual_example",
      description:
        "Show a teaching reference on the whiteboard. Use whenever you'd otherwise say 'imagine a shot where...' — instead, show it. Generously, throughout the conversation. The image renders as a textbook-style page with the technique title, an example frame, and a caption.",
      parameters: [
        {
          name: "technique",
          type: "string",
          description:
            "The name of the technique or principle. Short, like a textbook heading. e.g. 'Slow Push-In', 'Eyeline Match', 'Rack Focus', 'Window Backlight'.",
          required: true,
        },
        {
          name: "description",
          type: "string",
          description:
            "Vivid description of the example frame. Specific about camera angle, lens, lighting, period, mood, palette. e.g. 'A low-angle 35mm medium close-up of a man in a dark wool coat, hard tungsten key from camera-right, deep shadow on the left half of his face, 1970s film grain, dusk NYC alley.'",
          required: true,
        },
        {
          name: "caption",
          type: "string",
          description:
            "One-sentence teaching note (≤80 chars). What you'd say while pointing at the image. e.g. 'Notice how the low angle gives him power.'",
          required: true,
        },
      ],
    };

    const PROPOSE_TREATMENT_TOOL = {
      type: "client_event",
      name: "propose_treatment",
      description:
        "Fire ONCE per project, BEFORE the writer starts.\n\nHARD GUARD AGAINST DUPLICATE SUGGESTIONS: Before firing, verify no treatment is in flight or already done. If the ON SCREEN block lists a treatment OR shows agent_status=running, DO NOT fire — the suggestion is already pending or the writer is working. If unsure, call get_project_state FIRST; only fire when treatment is null AND agent_status is idle. Re-firing creates a duplicate suggestion card and confuses the user (a common failure mode).\n\nWhen valid: the user has pitched, you've discussed, you have a coherent brief in mind. This puts a pending suggestion card on screen with Apply / Pass. Either (a) user says 'go ahead' / 'yes' → fire commit_proposal with this id, OR (b) user clicks Apply. Either path makes it real. Don't fire generation tools yourself; the writer does the work after approval.",
      parameters: [
        {
          name: "brief",
          type: "string",
          description:
            "The full consolidated brief the agent will use to write the treatment. Detailed: characters, location, tone, camera rule, what the user wants to feel, end card if known. 100-300 words.",
          required: true,
        },
        {
          name: "summary",
          type: "string",
          description:
            "≤80 chars — what the suggestion card shows. e.g. 'Write the treatment: a daughter, the watch, six shots, locked-off camera, period-warm.'",
          required: true,
        },
      ],
    };

    const PROPOSE_ALTERNATIVE_TOOL = {
      type: "client_event",
      name: "propose_alternative",
      description:
        "Fire when you want to change a specific asset on screen — a plate, keyframe, or shot. This puts a suggestion card with Apply / Pass next to the asset. User confirms by clicking Apply OR saying 'go ahead' (then fire `commit_proposal` with the id). Don't edit anything yourself. Use this for: 'I'd swap shot 4 to a window beat', 'I want @elena's expression different', 'add the watch to the keyframe'.",
      parameters: [
        {
          name: "target_ref",
          type: "string",
          description:
            "The asset to change. For plates and keyframes: the @tag (e.g. '@elena', '@kf_shot5_hero'). For shots: the shot id (e.g. 'shot_4').",
          required: true,
        },
        {
          name: "direction",
          type: "string",
          description:
            "The change you want, as a surgical instruction with a 'preserve the rest' clause. e.g. 'Replace neutral expression in panel 5 with grief; preserve face, wardrobe, lighting.'",
          required: true,
        },
        {
          name: "summary",
          type: "string",
          description:
            "≤80 chars — what the suggestion card shows. e.g. 'Swap shot 4 to a window beat instead of cool study.'",
          required: true,
        },
      ],
    };

    const PROPOSE_SIGNATURE_PASS_TOOL = {
      type: "client_event",
      name: "propose_signature_pass",
      description:
        "Fire in the CUT room when you want to put your visual signature (color, grade, atmosphere) on a rendered shot. The user confirms by Apply / 'go ahead'. Defaults to your alephSignaturePrompts — the user doesn't pick the prompt.",
      parameters: [
        {
          name: "target_ref",
          type: "string",
          description: "The rendered shot id (e.g. 'shot_1').",
          required: true,
        },
        {
          name: "summary",
          type: "string",
          description: "≤80 chars — e.g. 'Put my warmth and grain on shot 1.'",
          required: true,
        },
      ],
    };

    const PROPOSE_COVERAGE_TOOL = {
      type: "client_event",
      name: "propose_coverage",
      description:
        "Fire in the CUT room when you want a different camera angle of an already-rendered shot. Same fictional moment, different camera position. User confirms by Apply / 'go ahead'.",
      parameters: [
        {
          name: "target_ref",
          type: "string",
          description: "The master shot id (e.g. 'shot_4').",
          required: true,
        },
        {
          name: "direction",
          type: "string",
          description:
            "The new angle, asserted with continuity. e.g. 'Same moment, same character, same lighting — low angle from the floor looking up at her hand on the sill.'",
          required: true,
        },
        {
          name: "summary",
          type: "string",
          description:
            "≤80 chars — e.g. 'Low-angle coverage of shot 4 — looking up at her hand.'",
          required: true,
        },
      ],
    };

    const COMMIT_PROPOSAL_TOOL = {
      type: "client_event",
      name: "commit_proposal",
      description:
        "Commit the most-recent pending suggestion to the writer. Suggestion-level approval (lower stakes than approve_checkpoint).\n\nTriggers: 'apply that' / 'do it' / 'yes do it' / 'go ahead and do it' / 'go ahead and write it' / 'write it' / 'make it'.\n\nNOT triggers — too vague, ASK first: 'go ahead' alone, 'ok' alone, 'sure' alone, 'yes' alone. The user might mean 'continue this thought', not 'commit'. If unsure, ask 'commit this proposal now or keep refining the brief?' — wait for an explicit verb.\n\nPASS the most recent pending suggestion's id.\n\nAFTER firing: keep talking. The writer runs ~10-15s on Haiku. Stay quiet OR fire one cite_lesson. Do NOT continue asking story questions — the brief is locked.",
      parameters: [
        {
          name: "suggestion_id",
          type: "string",
          description:
            "The id of the pending suggestion the user just approved. You receive this id back from your propose_* call (the suggestion's id will be the most recent one you fired).",
          required: true,
        },
      ],
    };

    const DISMISS_PROPOSAL_TOOL = {
      type: "client_event",
      name: "dismiss_proposal",
      description:
        "Fire when the user verbally rejects a pending suggestion ('skip that', 'no', 'pass on it'). Marks the suggestion as passed; nothing happens to the workspace.",
      parameters: [
        {
          name: "suggestion_id",
          type: "string",
          description: "The id of the pending suggestion the user rejected.",
          required: true,
        },
      ],
    };

    const CITE_LESSON_TOOL = {
      type: "client_event",
      name: "cite_lesson",
      description:
        "Pin a teaching beat. A lesson card lands in Film School (sidebar) immediately. During PITCH/WRITING/SCRIPT phases the system also auto-renders a TEXTBOOK REFERENCE PAGE in the References lane within ~10-15s; during production phases (WORLD/STORYBOARD/SHOOT/...) the page is skipped so plate/shot generation stays unblocked.\n\nWHEN you fire this, briefly point the user at the lesson: 'Adding [film] · [technique] to your film school.' One sentence. Don't go silent after firing.\n\nFire whenever you cite a real film + technique. Once per (film, technique) pair — server dedupes. Reference prior cards verbally instead of re-firing.",
      parameters: [
        {
          name: "film",
          type: "string",
          description:
            "Real film title. MUST come from the director's own filmography as listed in their persona context. Example: 'Goodfellas'. Never invent a film.",
          required: true,
        },
        {
          name: "technique",
          type: "string",
          description:
            "The specific technique — short. e.g. 'Steadicam Copacabana entrance', 'Eyeline match', 'Bernard Herrmann mirror zoom', 'Single tungsten window backlight'.",
          required: true,
        },
        {
          name: "why",
          type: "string",
          description:
            "One sentence — what the user just learned. Keep it specific, e.g. 'Long takes inside character POV build empathy faster than cuts.'",
          required: true,
        },
        {
          name: "year",
          type: "number",
          description: "Optional film year for disambiguation.",
          required: false,
        },
      ],
    };

    const APPROVE_CHECKPOINT_TOOL = {
      type: "client_event",
      name: "approve_checkpoint",
      description:
        "Advance pipeline stage. EXPLICIT approval only.\n\nSTRICT triggers: 'approve' / 'approved' / 'lock it in' / 'lock these in' / 'ship it' / 'advance' / 'next stage'.\n\nNOT triggers (filler — IGNORE): 'go ahead', 'ok', 'sure', 'yes' alone, 'next' alone, 'looks good', 'sounds good', 'great', 'cool'.\n\nFOUR HARD CHECKS — all must pass:\n(1) User said a STRICT trigger word.\n(2) The matching lane is COMPLETE — get_project_state.{plates|keyframes|shots}_done === true. If rendered < planned, generation is still in progress; DO NOT approve.\n(3) get_project_state.awaiting_approval === the exact stage you're approving (or AWAITING APPROVAL block names that stage).\n(4) agent_status === 'idle' OR generation_in_progress === false.\n\nIf any check fails: respond 'We're still rendering — X of Y done. I'll lock it in once they're all here.' DO NOT fire.\n\nAFTER firing: keep talking. The next stage runs 30-90s.",
      parameters: [
        {
          name: "stage",
          type: "string",
          description:
            "The checkpoint stage being approved. MUST match the stage listed in your AWAITING APPROVAL block (or the awaiting_approval field from get_project_state). Valid: treatment, plates, keyframes, shots, final_cut.",
          required: true,
        },
      ],
    };

    const REJECT_CHECKPOINT_TOOL = {
      type: "client_event",
      name: "reject_checkpoint",
      description:
        "Fire when the user verbally REJECTS the awaiting-approval checkpoint — they want a re-pitch or major changes. e.g. 'no, redo it', 'I don't like it', 'start over'. The user can also click Re-pitch / Request Changes in the workspace. Don't fire for tweaks — that's a propose_alternative on a specific @tag.",
      parameters: [
        {
          name: "stage",
          type: "string",
          description:
            "The stage being rejected. MUST match the AWAITING APPROVAL block.",
          required: true,
        },
        {
          name: "reason",
          type: "string",
          description:
            "Short summary of WHY the user is rejecting (their words, paraphrased). Used as the note for the re-pitch.",
          required: false,
        },
      ],
    };

    // ── BACKEND-RPC tools (round-trip) ─────────────────────────────────────
    // Director can call these mid-conversation to get LIVE state from our
    // backend. Unlike client_event tools (one-way to the browser), these
    // BLOCK on a response — the director's brain receives the result and
    // uses it to answer the user honestly. This is the architectural fix
    // for "I displayed the treatment for you" hallucinations.

    // Runway caps backend_rpc timeoutSeconds at 8. Keep it well under so the
    // round-trip never times out (DB read is sub-second).
    const GET_PROJECT_STATE_TOOL = {
      type: "backend_rpc",
      name: "get_project_state",
      description:
        "FETCH live project state. Call BEFORE answering ANY user question about progress, counts, or what's on screen. The ON SCREEN block was a snapshot; this returns NOW.\n\nReturns: treatment (title, logline, end_card, shot_count) · plates_rendered / plates_planned / plates_done · keyframes_rendered / keyframes_planned / keyframes_done · shots_rendered / shots_planned / shots_done · has_final_film · generation_in_progress · awaiting_approval (the stage the user can actually approve, or null) · agent_status.\n\nUSE THE _done FLAGS — they tell you if a lane is COMPLETE: e.g. plates_done=false means generation is still running, do NOT approve. plates_done=true AND awaiting_approval='plates' is the only state in which you can fire approve_checkpoint(stage='plates').\n\nIf the user asks 'how many plates?' answer 'X of Y rendered' using plates_rendered + plates_planned. If treatment is null the writer is still working.",
      timeoutSeconds: 5,
      parameters: [],
    };

    const ALL_TOOLS = [
      // Teaching (client_event, fire-and-forget)
      SHOW_VISUAL_EXAMPLE_TOOL,
      CITE_LESSON_TOOL,
      // Suggestions (client_event)
      PROPOSE_TREATMENT_TOOL,
      PROPOSE_ALTERNATIVE_TOOL,
      PROPOSE_SIGNATURE_PASS_TOOL,
      PROPOSE_COVERAGE_TOOL,
      COMMIT_PROPOSAL_TOOL,
      DISMISS_PROPOSAL_TOOL,
      // Workspace approvals (client_event)
      APPROVE_CHECKPOINT_TOOL,
      REJECT_CHECKPOINT_TOOL,
      // Live state query (backend_rpc — fast round-trip; capped at 8s by Runway)
      GET_PROJECT_STATE_TOOL,
    ];

    // SINGLE-ACTIVE: only one realtime session is created — the active
    // director's. The wings director is returned as metadata only (id, name,
    // avatarId for portrait display). When the user clicks Switch, the client
    // re-POSTs with the OTHER directorId as activeDirectorId — that's a fresh
    // session for the new active director. Avatars (the model) are cached
    // and reused, so subsequent switches only pay the realtime-session
    // creation cost (~10-30s).
    const hasBrief = !!(body.briefText && body.briefText.trim().length > 0);
    // Continuation = this is a reload / switch, not the first session for this
    // project. Detect via priorTranscript OR existing project state. In
    // continuation mode the director picks up mid-conversation rather than
    // re-introducing themselves.
    const hasPriorTranscript = !!(
      body.priorTranscript && body.priorTranscript.length > 0
    );
    const hasProjectState = projectStateBlock.length > 0;
    const isContinuation = hasPriorTranscript || hasProjectState;
    // Reactive script: when this is a continuation AND there's something new
    // on screen, the director opens by NAMING what just landed. Walks in
    // mid-thought instead of saying "where were we?".
    const reactiveScript = isContinuation
      ? buildReactiveScript({
          ...reactiveSnapshot,
          pendingCheckpointStage: body.pendingCheckpoint?.stage,
        })
      : null;
    const activeIntro = buildLeadIntro(
      activePersona,
      wingsPersona,
      hasBrief,
      isContinuation,
      reactiveScript ?? undefined
    );

    // Three-tier session creation. Runway's content moderation can reject
    // text on the personality/startScript that's load-bearing for the demo
    // (the user's grief-stricken cinema brief is the regular trigger). We:
    //   tier 1: full personality + startScript with project state
    //   tier 2: same but text passes through softenForModeration()
    //   tier 3: barebones — just the persona's base personality + a generic
    //           startScript. The director loses live state awareness but
    //           the call comes up rather than failing entirely.
    const fullPersonality =
      body.personality ?? withCoAwareness(activePersona, wingsPersona);
    const fullStartScript = body.startScript ?? activeIntro;
    let activeCreds: SessionCredentials;
    try {
      activeCreds = await createReadySession({
        avatarId: activeAvatarId,
        personality: fullPersonality,
        startScript: fullStartScript,
        tools: ALL_TOOLS,
        maxDurationSeconds: 1800,
      });
    } catch (err) {
      if (!isAvatarTextRejection(err)) throw err;
      console.warn(
        "[/api/avatar/session] tier-1 rejected by moderation — retrying softened"
      );
      try {
        activeCreds = await createReadySession({
          avatarId: activeAvatarId,
          personality: softenForModeration(fullPersonality),
          startScript: softenForModeration(fullStartScript),
          tools: ALL_TOOLS,
          maxDurationSeconds: 1800,
        });
      } catch (err2) {
        if (!isAvatarTextRejection(err2)) throw err2;
        console.warn(
          "[/api/avatar/session] tier-2 rejected — falling back to barebones persona"
        );
        // Tier 3: drop ALL dynamic state. Director walks in with their base
        // identity only — no project state, no transcript, no awaiting-
        // approval block. They'll be slightly out of sync but the call works.
        const barebonesPersonality =
          softenForModeration(activePersona.personality) +
          "\n\n=== STYLE ===\nSpeak like a real director — natural, no jargon. Listen and respond to whatever the user is asking; the screen has the project state.";
        const barebonesStart = `Right — I'm back. Tell me what we're looking at.`;
        activeCreds = await createReadySession({
          avatarId: activeAvatarId,
          personality: barebonesPersonality,
          startScript: barebonesStart,
          tools: ALL_TOOLS,
          maxDurationSeconds: 1800,
        });
      }
    }

    // ── Start the backend_rpc handler so the director can call our tools
    //    mid-conversation. Best-effort — if this fails, the director just
    //    can't query live state (graceful degradation). The rpc-manager
    //    closes existing handlers automatically on key collision.
    if (body.generationId) {
      const generationIdForRpc = body.generationId;
      startSessionRpc({
        sessionId: activeCreds.sessionId,
        generationId: generationIdForRpc,
        tools: {
          // Returns latest project state. Always read-only, never blocks long.
          get_project_state: async () => {
            const state = await buildProjectState(generationIdForRpc);
            const { data: gen } = await db
              .from("generations")
              .select("agent_config, status")
              .eq("id", generationIdForRpc)
              .single();
            const cfg =
              (gen?.agent_config as Record<string, unknown> | null) || {};
            const treatment = state.treatment;
            // Plan vs reality counts so the director can answer "how many
            // plates are we expecting?" / "how many are done?" without
            // guessing — and so the inference below can refuse to mark a
            // lane "awaiting approval" while it's still rendering.
            const plannedPlateCount = treatment?.plannedPlates?.length || 0;
            const plannedShotCount =
              treatment?.plannedShots?.length || treatment?.shotCount || 0;
            const platesDone =
              plannedPlateCount === 0 ||
              state.plates.length >= plannedPlateCount;
            const keyframesDone =
              plannedShotCount === 0 ||
              state.keyframes.length >= plannedShotCount;
            const shotsDone =
              plannedShotCount === 0 ||
              state.shots.length >= plannedShotCount;
            const agentStatus =
              (gen?.status as string | undefined) || "unknown";
            const isIdle = agentStatus === "idle";

            // Compact response — the director's brain consumes this directly.
            return {
              treatment: treatment
                ? {
                    title: treatment.title || null,
                    logline: treatment.logline || null,
                    end_card: treatment.endCard || null,
                    duration_seconds: treatment.durationSeconds || null,
                    aspect_ratio: treatment.aspectRatio || null,
                    shot_count: treatment.shotCount || null,
                  }
                : null,
              plates_rendered: state.plates.length,
              plates_planned: plannedPlateCount,
              plates_done: platesDone,
              keyframes_rendered: state.keyframes.length,
              keyframes_planned: plannedShotCount,
              keyframes_done: keyframesDone,
              shots_rendered: state.shots.length,
              shots_planned: plannedShotCount,
              shots_done: shotsDone,
              has_final_film: !!state.finalFilm,
              generation_in_progress: !isIdle,
              awaiting_approval: ((): string | null => {
                // 1) Explicit checkpoint set by request_approval()
                const pending = (
                  cfg.pending_checkpoint as { stage: string } | undefined
                )?.stage;
                if (pending) return pending;
                // 2) Inferred checkpoint — agent must be IDLE and the
                //    latest lane must be COMPLETE (rendered >= planned).
                //    Without these guards the director was inferring
                //    "plates awaiting approval" with 3 of 6 rendered
                //    and approving prematurely.
                if (!isIdle) return null;
                if (state.finalFilm) return "final_cut";
                if (state.shots.length > 0 && shotsDone) return "shots";
                if (state.keyframes.length > 0 && keyframesDone)
                  return "keyframes";
                if (state.plates.length > 0 && platesDone) return "plates";
                if (state.treatment) return "treatment";
                return null;
              })(),
              agent_status: agentStatus,
            };
          },
        },
      }).catch((err) => {
        console.warn(
          "[/api/avatar/session] startSessionRpc failed (non-fatal):",
          err instanceof Error ? err.message : String(err)
        );
      });
    }

    return NextResponse.json({
      active: {
        directorId: activePersona.id,
        directorName: activePersona.name,
        avatarId: activeAvatarId,
        portraitUrl: activePersona.portraitUrl,
        school: activePersona.school,
        ...activeCreds,
      },
      wings:
        wingsPersona && wingsAvatarId
          ? {
              directorId: wingsPersona.id,
              directorName: wingsPersona.name,
              avatarId: wingsAvatarId,
              portraitUrl: wingsPersona.portraitUrl,
              school: wingsPersona.school,
            }
          : null,
    });
  } catch (err) {
    console.error("[/api/avatar/session] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
