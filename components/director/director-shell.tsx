"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BriefForm } from "./brief-form";
import { Cast, type CastSelection } from "./cast";
import { ChatPane } from "./chat-pane";
import { WorkspacePane } from "./workspace-pane";
import { AssetModal, type AssetModalInput } from "./asset-modal";
import { RecentFilms } from "./recent-films";
import { DirectorWidgets, type WidgetActiveParticipant, type WidgetWingsParticipant } from "./director-widgets";
import { FilmSchoolPanel } from "./film-school";
import { SuggestionsStrip } from "./suggestions-strip";
import { useDirector } from "./use-director";
import type { BriefInput, CastedDirector } from "./director-types";
import { cn } from "@/lib/utils";

type Brand = { id: string; name: string };

export function DirectorShell({ brands }: { brands: Brand[] }) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState<"cast" | "brief">("cast");
  const [modalAsset, setModalAsset] = useState<AssetModalInput>(null);
  const director = useDirector();
  const searchParams = useSearchParams();
  const resumeId = searchParams?.get("resume");

  // AUTEUR — live director widget state.
  // SINGLE-ACTIVE architecture: one director is on-call at a time, the other
  // is in the wings. User can switch via the wings card. Avatars are cached
  // server-side, so switches only pay the ~10-30s session-creation cost.
  type SessionResult = {
    active: WidgetActiveParticipant;
    wings: WidgetWingsParticipant | null;
  };
  const [avatarSession, setAvatarSession] = useState<SessionResult | null>(null);
  // Which director is currently active. Defaults to lead. User flips via Switch.
  const [activeDirectorId, setActiveDirectorId] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarLoadStartedAt, setAvatarLoadStartedAt] = useState<number | null>(null);
  const [avatarElapsed, setAvatarElapsed] = useState(0);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSkipped, setAvatarSkipped] = useState(false);
  // Bumped by reloadActive() to force the auto-fetch effect to re-run with
  // the SAME activeDirectorId. Without this, clicking Reload clears
  // avatarSession but no dep changes — effect doesn't re-fire — director
  // never returns. (avatarSession itself can't be in deps: the effect sets it.)
  const [avatarReloadKey, setAvatarReloadKey] = useState(0);
  // Live transcript of the active session — fed by DirectorWidgets via
  // useTranscript(). On switch / reload, we hand it to the next session as
  // "what was just said" so the new director walks in with continuity.
  const transcriptRef = useRef<Array<{ speaker: "user" | "director"; text: string }>>([]);
  // Debounced persistence to agent_config.live_transcript so the transcript
  // survives page reloads and resumes. Without this, every test run starts
  // from scratch — wasteful when iterating.
  const transcriptPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const generationIdForTranscriptRef = useRef<string | null>(null);
  useEffect(() => {
    generationIdForTranscriptRef.current = director.generationId;
  }, [director.generationId]);
  // Seed transcriptRef from the persisted store on resume — gives the next
  // session priorTranscript context across page reloads. Runs once when
  // storedTranscript materializes (resumeGeneration finishes).
  useEffect(() => {
    if (
      director.storedTranscript.length > 0 &&
      transcriptRef.current.length === 0
    ) {
      transcriptRef.current = director.storedTranscript;
    }
  }, [director.storedTranscript]);

  const handleTranscriptUpdate = useCallback(
    (transcript: Array<{ speaker: "user" | "director"; text: string }>) => {
      transcriptRef.current = transcript;
      // Debounced persist — 4s after the last transcript update.
      if (transcriptPersistTimerRef.current) {
        clearTimeout(transcriptPersistTimerRef.current);
      }
      transcriptPersistTimerRef.current = setTimeout(() => {
        const gid = generationIdForTranscriptRef.current;
        if (!gid || transcriptRef.current.length === 0) return;
        fetch("/api/transcript/persist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generationId: gid,
            transcript: transcriptRef.current,
          }),
        }).catch((err) =>
          console.warn("[transcript/persist] failed:", err)
        );
      }, 4000);
    },
    []
  );
  // Phase as a ref so the avatar fetch effect can read the current phase
  // WITHOUT having phase in its deps (which would re-trigger session creation
  // every time the user moved between rooms — unwanted).
  const phaseRef = useRef<string | undefined>(undefined);
  // Same trick for the active workspace checkpoint — read at fetch time.
  const pendingCheckpointRef = useRef<{ stage: string; summary?: string } | null>(
    null
  );
  const [filmSchoolOpen, setFilmSchoolOpen] = useState(false);

  // Tick the elapsed timer once a second while loading, so the user sees
  // progress. Helps distinguish "still working" from "stuck forever".
  useEffect(() => {
    if (!avatarLoading || !avatarLoadStartedAt) {
      setAvatarElapsed(0);
      return;
    }
    const id = setInterval(() => {
      setAvatarElapsed(Math.floor((Date.now() - avatarLoadStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [avatarLoading, avatarLoadStartedAt]);

  useEffect(() => {
    if (!resumeId) return;
    setStarted(true);
    director.resumeGeneration(resumeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId]);

  // Open the dual-live director sessions once we have a cast and a started
  // project. Re-opens on resume because Runway sessions are short-lived.
  const leadId = director.cast.lead?.id;
  const coId = director.cast.co?.id;
  const briefText = director.latestBrief;
  // Default the active director to the lead when one isn't set yet.
  useEffect(() => {
    if (leadId && !activeDirectorId) setActiveDirectorId(leadId);
  }, [leadId, activeDirectorId]);
  useEffect(() => {
    if (!started || !leadId) return;
    if (avatarSession || avatarLoading || avatarError || avatarSkipped) return;
    if (!activeDirectorId) return;
    let cancelled = false;
    const controller = new AbortController();
    // Hard 150s ceiling — if the room is still processing past that, surface
    // the error so the user can retry or skip.
    const timeout = setTimeout(() => controller.abort(), 150_000);

    setAvatarLoading(true);
    setAvatarLoadStartedAt(Date.now());
    setAvatarError(null);
    fetch("/api/avatar/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadDirectorId: leadId,
        coDirectorId: coId || undefined,
        // Active director — defaults to lead. Flips when user clicks Switch.
        activeDirectorId,
        briefText: briefText || undefined,
        generationId: director.generationId || undefined,
        // What was just said before this session was created — gives the
        // new director (or the switched-in wings) conversational continuity.
        priorTranscript: transcriptRef.current.length
          ? transcriptRef.current
          : undefined,
        // Surfaces in the persona prompt as "YOU ARE IN THE X ROOM" so the
        // director answers questions correctly for the current phase.
        currentPhase: phaseRef.current || undefined,
        // The active workspace checkpoint, if any — lets the director fire
        // approve_checkpoint / reject_checkpoint when the user gives verbal
        // approval at a stage gate.
        pendingCheckpoint: pendingCheckpointRef.current || undefined,
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`session ${res.status}: ${await res.text()}`);
        return (await res.json()) as SessionResult;
      })
      .then((data) => {
        if (!cancelled) {
          setAvatarSession(data);
          setReloadReason(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          // Distinguish abort-timeout from server errors so the message is honest.
          setAvatarError(
            err instanceof Error && err.name === "AbortError"
              ? "Avatar session timed out (>150s). Retry or continue without live directors."
              : msg
          );
        }
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!cancelled) setAvatarLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
    // IMPORTANT: do NOT include avatarLoading or avatarSession in deps —
    // they're set BY this effect, which would cause the cleanup to abort
    // the fetch microseconds after it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, leadId, coId, activeDirectorId, avatarError, avatarSkipped, avatarReloadKey]);

  const onEndDirectors = useCallback(() => {
    setAvatarSession(null);
    // After end, mark "skipped" so the auto-fetch effect doesn't immediately
    // re-create. The user can click "Bring directors back" to rejoin.
    setAvatarSkipped(true);
  }, []);

  const rejoinDirectors = useCallback(() => {
    // Reset everything so the auto-fetch effect fires fresh.
    setAvatarError(null);
    setAvatarSession(null);
    setAvatarSkipped(false);
  }, []);

  // Switch to the wings director. End current session, flip activeDirectorId,
  // the auto-fetch effect kicks off a new session for the new active.
  const switchToWings = useCallback(() => {
    if (!avatarSession?.wings) return;
    setActiveDirectorId(avatarSession.wings.directorId);
    setAvatarSession(null);
    setAvatarError(null);
    setAvatarSkipped(false);
  }, [avatarSession]);

  // Why the active director is being reloaded — drives the loading-card copy
  // ("Director catching up on the latest…" vs "Casting the directors"). Set
  // before reloadActive to give the user a more honest state indicator.
  const [reloadReason, setReloadReason] = useState<"sync" | "manual" | null>(null);

  // Reload the active director — same activeDirectorId, fresh session. Used
  // when the avatar tile freezes / goes silent / errors out, AND auto-fired
  // at stage transitions so the director's persona prompt always carries the
  // latest project state (otherwise they'd "remember" the old conversation
  // but not what's actually been generated since they joined).
  const reloadActive = useCallback((reason: "sync" | "manual" = "manual") => {
    setReloadReason(reason);
    setAvatarSession(null);
    setAvatarError(null);
    setAvatarSkipped(false);
    setAvatarReloadKey((k) => k + 1);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // DIRECTOR ↔ AGENT SYNC
  //
  // The Runway Characters API has no runtime-update endpoint — the director's
  // persona prompt is set ONCE at session creation. Anything generated AFTER
  // they joined is invisible to them. To prevent the "she said the treatment
  // was generated but gave a different title than the one on screen" failure
  // mode, we transparently recreate the session at meaningful project-state
  // transitions. The new session is built with the latest project state.
  //
  // Triggers: when the treatment object first lands, when plates first appear,
  // when keyframes first appear, when shots first appear, when the final film
  // lands. Each is a moment where the conversation focus has shifted enough
  // that the director needs to walk back in fresh.
  // ─────────────────────────────────────────────────────────────────────────
  // The director's persona prompt is FROZEN at session-create time (Runway
  // limit — no runtime context update). Anything generated after the director
  // joined is invisible to them. To keep them honest about what's on screen,
  // we transparently recreate the session at meaningful transitions. Each
  // recreation injects the latest project state + a REACTIVE startScript that
  // names what just landed, so the director walks back in already mid-thought
  // about the new artifact.
  //
  // Triggers (ordered): final film lands, treatment lands, NEW checkpoint
  // stage appears (request_approval fires). 90s suppression between syncs
  // prevents cascades.
  const syncRef = useRef<{
    hadTreatment: boolean;
    hadFinalFilm: boolean;
    checkpointStage: string | null;
    phase: string | null;
  }>({
    hadTreatment: false,
    hadFinalFilm: false,
    checkpointStage: null,
    phase: null,
  });
  const syncPrimedRef = useRef(false);
  // 5s debounce only — Haiku writes the treatment in ~8-15s, so PITCH →
  // WRITING → SCRIPT transitions can land back-to-back within ~10s. 90s
  // suppression killed the SCRIPT transition; 25s killed it on Haiku;
  // 5s lets natural stage flips through while still coalescing render
  // bursts within the same React commit.
  const SYNC_SUPPRESSION_MS = 5_000;
  const lastSyncAtRef = useRef(0);

  useEffect(() => {
    if (!avatarSession) return;
    const t = director.treatment;
    const w = director.workspace;
    const hadFinalFilm = w.kind === "final";
    const checkpointStage = director.activeCheckpoint?.stage ?? null;
    const currentPhase = phaseRef.current ?? null;
    const current = {
      hadTreatment: !!t,
      hadFinalFilm,
      checkpointStage,
      phase: currentPhase,
    };

    // First observation: prime without firing — director walked in already
    // briefed by withCoAwareness, no reload needed.
    if (!syncPrimedRef.current) {
      syncRef.current = current;
      syncPrimedRef.current = true;
      return;
    }

    const prev = syncRef.current;
    let trigger: string | null = null;
    if (!prev.hadFinalFilm && current.hadFinalFilm) trigger = "final film";
    else if (!prev.hadTreatment && current.hadTreatment) trigger = "treatment landed";
    else if (
      current.checkpointStage &&
      current.checkpointStage !== prev.checkpointStage
    )
      trigger = `${current.checkpointStage} checkpoint appeared`;
    else if (current.phase && current.phase !== prev.phase) {
      // Each sync tears down the WebRTC stream and creates a new Runway
      // session — the user sees the avatar disconnect/reconnect. We pay
      // that cost ONLY for transitions where the director needs a fresh
      // ON SCREEN block to do their new job: SCRIPT (treatment review),
      // WORLD/STORYBOARD/SHOOT (asset review against real @tags), CUT,
      // PREMIERE. Skip transitions INTO WRITING and BETWEEN — those are
      // teach-only phases that the existing persona context can handle
      // via RULE 1 (no hallucination) + RULE 5 (phase-locked); the
      // director doesn't need a session reload to know "writer is on it,
      // I should teach". This cuts ~2 stream drops per project.
      const heavyRooms = new Set([
        "SCRIPT",
        "WORLD",
        "STORYBOARD",
        "SHOOT",
        "CUT",
        "POST",
        "PREMIERE",
      ]);
      if (heavyRooms.has(current.phase)) {
        trigger = `phase ${prev.phase ?? "—"} → ${current.phase}`;
      }
    }

    syncRef.current = current;

    if (trigger) {
      // Landmark events bypass suppression — they're terminal state changes
      // that the director MUST get the context for, even if back-to-back
      // (e.g. PITCH → WRITING → SCRIPT can flip in <10s on Haiku).
      const isLandmark =
        trigger === "treatment landed" ||
        trigger === "final film" ||
        trigger.startsWith("phase ");
      const elapsed = Date.now() - lastSyncAtRef.current;
      if (!isLandmark && elapsed < SYNC_SUPPRESSION_MS) {
        console.log(
          `[director-sync] ${trigger} — suppressed (${Math.round(elapsed / 1000)}s since last sync)`
        );
        return;
      }
      lastSyncAtRef.current = Date.now();
      console.log(`[director-sync] ${trigger} — refreshing director with latest state`);
      reloadActive("sync");
    }
  }, [
    avatarSession,
    director.treatment,
    director.workspace,
    director.activeCheckpoint,
    reloadActive,
  ]);

  // STARTER LESSON PACK — fired ONCE per project, right after the brief is
  // submitted and the generationId materializes. Renders 3 textbook reference
  // pages drawn from the lead director's filmsCited list, populating the
  // Film School sidebar + the References lane before the treatment lands.
  //
  // This removes the LLM dependency on the live director: even if the
  // director fires zero cite_lesson during PITCH, the user lands on PITCH
  // with cinema already on screen. The live director can still teach more
  // lessons throughout the session.
  //
  // The endpoint is idempotent — calling on every effect-fire is safe (the
  // server returns the already-rendered cards on subsequent calls).
  const starterPackFiredForRef = useRef<string | null>(null);
  useEffect(() => {
    const gid = director.generationId;
    const leadId = director.cast.lead?.id;
    if (!gid || !leadId) return;
    const key = `${gid}::${leadId}`;
    if (starterPackFiredForRef.current === key) return;
    starterPackFiredForRef.current = key;

    fetch("/api/lesson/starter-pack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generationId: gid, directorId: leadId, count: 3 }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as {
          lessons?: Array<{
            id: string;
            director_id: string;
            film: string;
            year?: number;
            technique: string;
            why: string;
            created_at: number;
          }>;
          references?: Array<{
            id: string;
            url: string;
            caption: string;
            director_id: string;
            director_name: string;
            created_at: number;
          }>;
        };
        for (const l of data.lessons || []) director.addLesson(l);
        for (const r of data.references || []) director.addReference(r);
      })
      .catch((err) =>
        console.warn("[/api/lesson/starter-pack] failed (non-fatal):", err)
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [director.generationId, director.cast.lead?.id]);

  // Manual retry — clears error state so the auto-fetch effect runs again.
  const retryAvatarSession = useCallback(() => {
    setAvatarError(null);
    setAvatarSession(null);
    setAvatarSkipped(false);
  }, []);
  const skipAvatarSession = useCallback(() => {
    setAvatarError(null);
    setAvatarSkipped(true);
  }, []);

  // Validate that a target_ref refers to something that actually exists on
  // screen. The director sometimes proposes changes to assets that haven't
  // been generated yet (e.g. propose_alternative on shot_1 during SCRIPT) —
  // those proposals will fail in the agent and confuse the user. Block them
  // here with a friendly notification.
  const validateTargetRef = useCallback(
    (target_ref: string): { ok: true } | { ok: false; reason: string } => {
      const w = director.workspace;
      if (!target_ref) return { ok: false, reason: "no target specified" };

      // @tag references — must match a known plate or keyframe.
      if (target_ref.startsWith("@")) {
        const tag = target_ref.slice(1);
        const platesNow =
          w.kind === "production" || w.kind === "final" ? w.plates : [];
        const keyframesNow =
          w.kind === "production" || w.kind === "final" ? w.keyframes : [];
        const found =
          platesNow.some((p) => p.tag === tag) ||
          keyframesNow.some((k) => k.tag === tag);
        if (!found) return { ok: false, reason: `${target_ref} hasn't been generated yet` };
        return { ok: true };
      }

      // shot_N references — must be rendered.
      if (/^shot_\d+$/i.test(target_ref)) {
        const shotsNow =
          w.kind === "production" || w.kind === "final" ? w.shots : [];
        // shotsNow is an array; the director's shot_N is positional in the
        // treatment, so we accept any shot_N where N <= shots rendered count.
        const idx = Number(target_ref.split("_")[1]);
        if (!Number.isFinite(idx) || idx < 1 || idx > shotsNow.length) {
          return { ok: false, reason: `shot_${idx} hasn't been shot yet` };
        }
        return { ok: true };
      }

      return { ok: false, reason: `unrecognized target ${target_ref}` };
    },
    [director.workspace]
  );

  // Director proposal events — propose_*, commit_proposal, dismiss_proposal.
  // Each propose_X creates a pending suggestion card. commit_proposal /
  // dismiss_proposal are triggered when a director hears verbal approval /
  // rejection from the user; we resolve to the most-recent pending suggestion
  // from the firing director.
  const onProposalEvent = useCallback(
    (
      eventName:
        | "propose_treatment"
        | "propose_alternative"
        | "propose_signature_pass"
        | "propose_coverage"
        | "commit_proposal"
        | "dismiss_proposal"
        | "approve_checkpoint"
        | "reject_checkpoint",
      args: Record<string, unknown> | null | undefined,
      who: { id: string; name: string }
    ) => {
      const a = args || {};
      const summary = (a.summary as string | undefined) || "";

      switch (eventName) {
        case "propose_treatment": {
          const brief = (a.brief as string | undefined) || "";
          if (!brief) return;
          director.addSuggestion(
            { type: "treatment", brief, summary: summary || "Write the treatment." },
            who
          );
          return;
        }
        case "propose_alternative": {
          const target_ref = (a.target_ref as string | undefined) || "";
          const direction = (a.direction as string | undefined) || "";
          if (!target_ref || !direction) return;
          const v = validateTargetRef(target_ref);
          if (!v.ok) {
            console.info(
              `[propose_alternative] rejected — ${v.reason} (director: ${who.id})`
            );
            director.pushNotification(
              `${who.name} suggested changing ${target_ref}, but ${v.reason}.`
            );
            return;
          }
          director.addSuggestion(
            {
              type: "alternative",
              target_ref,
              direction,
              summary: summary || `Change ${target_ref}.`,
            },
            who
          );
          return;
        }
        case "propose_signature_pass": {
          const target_ref = (a.target_ref as string | undefined) || "";
          if (!target_ref) return;
          const v = validateTargetRef(target_ref);
          if (!v.ok) {
            console.info(
              `[propose_signature_pass] rejected — ${v.reason} (director: ${who.id})`
            );
            director.pushNotification(
              `${who.name} suggested a signature pass on ${target_ref}, but ${v.reason}.`
            );
            return;
          }
          director.addSuggestion(
            {
              type: "signature_pass",
              target_ref,
              summary: summary || `Apply signature to ${target_ref}.`,
            },
            who
          );
          return;
        }
        case "propose_coverage": {
          const target_ref = (a.target_ref as string | undefined) || "";
          const direction = (a.direction as string | undefined) || "";
          if (!target_ref || !direction) return;
          const v = validateTargetRef(target_ref);
          if (!v.ok) {
            console.info(
              `[propose_coverage] rejected — ${v.reason} (director: ${who.id})`
            );
            director.pushNotification(
              `${who.name} suggested coverage on ${target_ref}, but ${v.reason}.`
            );
            return;
          }
          director.addSuggestion(
            {
              type: "coverage",
              target_ref,
              direction,
              summary: summary || `Coverage on ${target_ref}.`,
            },
            who
          );
          return;
        }
        case "commit_proposal": {
          const id = a.suggestion_id as string | undefined;
          // The id from the avatar may not match a real suggestion (verbal
          // flow). resolvePending falls back to the latest-pending from the
          // firing director.
          director.applySuggestion(id, who.id);
          return;
        }
        case "dismiss_proposal": {
          const id = a.suggestion_id as string | undefined;
          director.passSuggestion(id, who.id);
          return;
        }
        case "approve_checkpoint": {
          // Director heard verbal approval at a workspace gate. Map to the
          // same flow as clicking the workspace's Approve button.
          const stage = (a.stage as string | undefined) || "";
          const cp = pendingCheckpointRef.current;
          if (!cp) {
            console.info(
              `[approve_checkpoint] director fired with stage="${stage}" but no checkpoint is pending`
            );
            director.pushNotification(
              `${who.name} heard you approve, but nothing's awaiting approval right now.`
            );
            return;
          }
          if (stage && stage !== cp.stage) {
            console.info(
              `[approve_checkpoint] stage mismatch — director said "${stage}", checkpoint is "${cp.stage}"`
            );
          }
          director.respondToCheckpoint({});
          return;
        }
        case "reject_checkpoint": {
          const reason = (a.reason as string | undefined) || "";
          const cp = pendingCheckpointRef.current;
          if (!cp) {
            director.pushNotification(
              `${who.name} heard you ask for changes, but nothing's awaiting approval right now.`
            );
            return;
          }
          // Empty edits + a note triggers a re-pitch / regenerate at the
          // current stage.
          director.respondToCheckpoint({}, reason || `${who.name} relayed: rework.`);
          return;
        }
      }
    },
    [director]
  );

  // Whiteboard images — append to References lane in workspace.
  const onWhiteboardExample = useCallback(
    async (
      args: { technique?: string; description?: string; caption?: string } | null | undefined,
      meta: { id: string; name: string }
    ) => {
      if (!args?.description || !args?.caption || !director.generationId) return;
      try {
        const res = await fetch("/api/whiteboard/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generationId: director.generationId,
            directorId: meta.id,
            technique: args.technique,
            description: args.description,
            caption: args.caption,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as
          | {
              url: string;
              caption: string;
              directorId: string;
              directorName: string;
              cardId: string;
            }
          | { skipped: true; reason: string; message?: string };
        if ("skipped" in data && data.skipped) {
          // Image couldn't be rendered (usually moderation). Don't break the
          // conversation — just log and let the director keep talking.
          console.info("[whiteboard] skipped:", data.reason);
          return;
        }
        if (!("url" in data)) return;
        director.addReference({
          id: data.cardId,
          url: data.url,
          caption: data.caption,
          director_id: data.directorId,
          director_name: data.directorName,
          created_at: Date.now(),
        });
      } catch (err) {
        console.error("[whiteboard] failed:", err);
      }
    },
    [director]
  );

  // Director-fired Film School cards. Persists to agent_config.lesson_plan
  // server-side, then adds to local state so the sidebar updates immediately.
  // Also AUTO-RENDERS a textbook reference page per lesson — the persona used
  // to be told to pair cite_lesson with show_visual_example, but the LLM
  // skipped the second call too often and lessons landed without visuals.
  // Driving whiteboard generation off cite_lesson removes the LLM dependency:
  // every lesson gets a textbook page.
  const onCiteLesson = useCallback(
    async (
      args:
        | { film?: string; technique?: string; why?: string; year?: number }
        | null
        | undefined,
      meta: { id: string; name: string }
    ) => {
      if (!args?.film || !args?.technique || !args?.why || !director.generationId) return;
      try {
        const res = await fetch("/api/lesson/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generationId: director.generationId,
            director_id: meta.id,
            film: args.film,
            technique: args.technique,
            why: args.why,
            year: args.year,
          }),
        });
        if (!res.ok) return;
        const card = (await res.json()) as {
          id: string;
          director_id: string;
          film: string;
          year?: number;
          technique: string;
          why: string;
          created_at: number;
        };
        director.addLesson(card);

        // Auto-render a whiteboard textbook page for this lesson — UNLESS
        // we're in a production phase. Plate / keyframe / shot generation
        // shares the gpt_image_2 quota with whiteboards; firing 2-3
        // whiteboards while plates are rendering can double the time-to-
        // first-plate. The lesson card lands in Film School immediately
        // either way; the visual reference can wait. The user explicitly
        // asked: "when generating the plates it shouldn't be generating
        // anything else, the plates are the priority."
        const inProduction =
          director.workspace.kind === "production" ||
          director.workspace.kind === "final";
        if (!inProduction) {
          const filmTag = args.year ? `${args.film} (${args.year})` : args.film;
          const description = `A frame from the film ${filmTag} demonstrating ${args.technique}. ${args.why}`;
          const caption = args.why;
          onWhiteboardExample(
            { technique: args.technique, description, caption },
            meta
          );
        } else {
          console.info(
            "[cite_lesson] in production phase — deferring whiteboard render to keep plate generation unblocked"
          );
        }
      } catch (err) {
        console.error("[cite_lesson] failed:", err);
      }
    },
    [director, onWhiteboardExample]
  );

  // Handle cast confirmation — fetch full director objects, set as cast, advance to brief.
  async function onCastConfirmed(sel: CastSelection) {
    try {
      const res = await fetch("/api/directors");
      const json = (await res.json()) as { directors: CastedDirector[] };
      const lead = json.directors.find((d) => d.id === sel.leadDirectorId) ?? null;
      const co = sel.coDirectorId
        ? json.directors.find((d) => d.id === sel.coDirectorId) ?? null
        : null;
      director.setCast({ lead, co });
    } catch {
      // Fallback to ID-only stubs if /api/directors fails.
      director.setCast({
        lead: sel.leadDirectorId
          ? { id: sel.leadDirectorId, name: sel.leadDirectorId, school: "", portraitUrl: "" }
          : null,
        co: sel.coDirectorId
          ? { id: sel.coDirectorId, name: sel.coDirectorId, school: "", portraitUrl: "" }
          : null,
      });
    }
    setStep("brief");
  }

  if (!started) {
    return (
      <div className="h-full w-full overflow-y-auto">
        {step === "cast" && (
          <>
            <div className="mx-auto w-full max-w-3xl px-10 pt-14">
              <RecentFilms />
            </div>
            <Cast
              onConfirm={onCastConfirmed}
              initial={{
                leadDirectorId: director.cast.lead?.id,
                coDirectorId: director.cast.co?.id,
              }}
            />
          </>
        )}
        {step === "brief" && (
          <BriefForm
            brands={brands}
            cast={director.cast}
            onChangeCast={() => setStep("cast")}
            onStart={(input: BriefInput) => {
              setStarted(true);
              director.startBrief(input);
            }}
          />
        )}
      </div>
    );
  }

  const canSend = director.status !== "running";

  // Checkpoint-aware approve / regenerate for the treatment stage
  const onApprove = () => {
    if (director.activeCheckpoint) {
      director.respondToCheckpoint({});
    } else {
      director.sendFollowup("Approved. Proceed to the next stage.");
    }
  };

  const onRegenerate = () => {
    // Two paths converge here:
    //   - User clicked "Re-pitch" on an actual treatment → ask for a different angle.
    //   - User clicked "Skip questions" while the agent was interviewing → force write_script.
    // Both translate to: stop stalling, produce a treatment now.
    const hasTreatment = !!director.treatment;
    director.sendFollowup(
      hasTreatment
        ? "Not quite. Re-pitch the treatment from a different angle — shift the tone, swap the reference films, cast different."
        : "Stop asking questions. Use your best interpretation of the brief and call write_script NOW. The lead director's school decides any ambiguity. Do not reply with text — call the tool."
    );
  };

  // Expected keyframe count from the treatment: sum of per-shot plans.
  const expectedCounts = (() => {
    const t = director.treatment;
    if (!t || !Array.isArray(t.shots)) return undefined;
    const keyframes = t.shots.reduce((sum, s) => {
      if (s.keyframe_plan === "first_and_last") return sum + 2;
      if (s.keyframe_plan === "hero") return sum + 1;
      return sum;
    }, 0);
    return { keyframes, shots: t.shots.length };
  })();

  const onContinueGenerating = (stage: "keyframes" | "shots") => {
    if (stage === "keyframes") {
      director.sendFollowup(
        "Continue generating the remaining keyframes for every shot that doesn't have one yet. Fire up to 5 generate_keyframe calls in parallel per turn until every shot in the script has its keyframe(s) rendered. After all are done, call request_approval(stage=\"keyframes\")."
      );
    } else {
      director.sendFollowup(
        "Continue generating the remaining shots for every keyframe that doesn't have one yet. Fire up to 5 generate_video calls in parallel per turn. After all shots render, call request_approval(stage=\"shots\")."
      );
    }
  };

  // Derive current phase label from workspace + active checkpoint.
  // Phase locks the persona's role: PITCH is story discussion, WRITING is
  // teach-only while the writer runs, SCRIPT is treatment review, etc.
  const phase = derivePhase(
    director.workspace.kind,
    director.activeCheckpoint?.stage,
    {
      hasTreatment: !!director.treatment,
      plateCount: director.plates.length,
      keyframeCount: director.keyframes.length,
      shotCount: director.shots.length,
      isAgentRunning: director.status === "running",
      treatmentPending:
        director.workspace.kind === "treatment" &&
        "pending" in director.workspace
          ? Boolean(director.workspace.pending)
          : false,
      composingNow:
        director.workspace.kind === "production" &&
        "composing" in director.workspace
          ? Boolean(director.workspace.composing)
          : false,
      plannedShots:
        director.treatment && Array.isArray(director.treatment.shots)
          ? director.treatment.shots.length
          : undefined,
    }
  );
  // Mirror to ref so the avatar fetch closure (which can't depend on phase
  // without re-firing every room change) reads the latest value.
  phaseRef.current = phase;
  // Mirror activeCheckpoint to the avatar-session ref so the persona's
  // AWAITING APPROVAL block fires. CRITICAL: when kind === "treatment" the
  // UI shows an Approve button but director.activeCheckpoint is null (the
  // agent never calls request_approval for treatment — UI infers it).
  // Without this fallback the director hears "approve" and either
  // hallucinates ("nothing to approve") or fires the wrong tool. We
  // synthesize a checkpoint when the workspace is in treatment-review.
  pendingCheckpointRef.current = director.activeCheckpoint
    ? {
        stage: director.activeCheckpoint.stage,
        summary: director.activeCheckpoint.summary,
      }
    : director.workspace.kind === "treatment" &&
        director.treatment &&
        director.status !== "running"
      ? {
          stage: "treatment",
          summary:
            director.treatment.title ||
            director.treatment.logline ||
            "Treatment ready for review",
        }
      : null;

  return (
    <>
      <div className="grid h-full w-full overflow-hidden grid-cols-1 lg:grid-cols-[minmax(380px,34%)_minmax(0,1fr)]">
        <div className="h-full min-h-0 overflow-hidden">
          <ChatPane
            messages={director.messages}
            activity={director.activity}
            thinking={director.thinking}
            canSend={canSend}
            onSend={director.sendFollowup}
            onStop={director.stop}
            status={director.status}
            spec={director.spec}
            mentions={director.mentions}
            phase={phase}
            lessonCount={director.lessons.length}
            onOpenFilmSchool={() => setFilmSchoolOpen(true)}
          />
        </div>
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">
            <WorkspacePane
              workspace={director.workspace}
              onApprove={onApprove}
              onRegenerate={onRegenerate}
              onRespondToCheckpoint={director.respondToCheckpoint}
              onContinueGenerating={onContinueGenerating}
              expectedCounts={expectedCounts}
              references={director.references}
              generationId={director.generationId}
              onAssetClick={(a) => setModalAsset(a)}
            />
          </div>
          <SuggestionsStrip
            suggestions={director.suggestions}
            cast={director.cast}
            onApply={(id, dirId) => director.applySuggestion(id, dirId)}
            onPass={(id, dirId) => director.passSuggestion(id, dirId)}
          />
        </div>
      </div>
      {director.notifications.length > 0 && (
        <div className="pointer-events-none fixed right-6 top-6 z-50 flex flex-col gap-2">
          {director.notifications.map((n) => (
            <div
              key={n.id}
              className="pointer-events-auto min-w-[240px] border border-neutral-900 bg-neutral-900 px-4 py-2.5 font-mono text-[12px] uppercase tracking-[0.16em] text-white shadow-lg"
            >
              {n.message}
            </div>
          ))}
        </div>
      )}
      {/* Persistent live director widget — top-right, mounted across all rooms */}
      {avatarSession && (
        <DirectorWidgets
          active={avatarSession.active}
          wings={avatarSession.wings}
          phase={phase}
          onEnd={onEndDirectors}
          onSwitchToWings={switchToWings}
          onReload={reloadActive}
          onVisualExample={onWhiteboardExample}
          onCiteLesson={onCiteLesson}
          onTranscriptUpdate={handleTranscriptUpdate}
          onProposalEvent={onProposalEvent}
        />
      )}
      {/* Rejoin button — appears when the user ended the session and could
          bring the directors back with full context. */}
      {!avatarSession && started && avatarSkipped && director.cast.lead && (
        <div className="pointer-events-auto fixed right-4 top-[4.5rem] z-30 w-[320px] border border-neutral-200 bg-white p-4 shadow-md">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
            Directors are off-call
          </p>
          <p className="mt-2 font-serif text-[13px] leading-snug text-neutral-700">
            {director.cast.lead.name}
            {director.cast.co ? ` and ${director.cast.co.name}` : ""} stepped
            away. Bring them back whenever — they&apos;ll catch up on
            everything that&apos;s happened.
          </p>
          <button
            onClick={rejoinDirectors}
            className="mt-3 border border-neutral-900 bg-neutral-900 px-3 py-1.5 font-mono text-[12px] uppercase tracking-[0.18em] text-white hover:bg-neutral-800"
          >
            Bring directors back
          </button>
        </div>
      )}
      {!avatarSession && started && !avatarSkipped && (avatarLoading || avatarError) && (
        <div
          className={cn(
            "pointer-events-auto fixed right-4 top-[4.5rem] z-30 w-[380px] border bg-white shadow-md",
            avatarError ? "border-red-300" : "border-neutral-200"
          )}
        >
          {/* Portrait header — matches the width/feel of the live avatar widget
              so the sync transition feels like the video buffered, not like
              the call ended. */}
          {!avatarError && director.cast.lead && (
            <div className="relative aspect-video w-full overflow-hidden bg-neutral-900">
              {director.cast.lead.portraitUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={director.cast.lead.portraitUrl}
                  alt={director.cast.lead.name}
                  className="h-full w-full object-cover opacity-80"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-2 left-3 right-3 flex items-center gap-2">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white">
                  {reloadReason === "sync"
                    ? `${director.cast.lead.name} · catching up`
                    : reloadReason === "manual"
                      ? `${director.cast.lead.name} · reconnecting`
                      : `${director.cast.lead.name} · joining`}
                </p>
              </div>
            </div>
          )}
          <div className="p-4">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
            {avatarError
              ? "Director session failed"
              : reloadReason === "sync"
                ? "Reading what's new on screen"
                : reloadReason === "manual"
                  ? "Reconnecting"
                  : "Casting the directors"}
          </p>
          {avatarError ? (
            <>
              <p className="mt-2 max-h-32 overflow-auto break-words font-mono text-[11px] leading-snug text-red-700">
                {avatarError}
              </p>
              <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                The session sometimes drops on the way up — usually retry works.
                If a specific director keeps failing, try a different cast.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={retryAvatarSession}
                  className="border border-neutral-900 bg-neutral-900 px-3 py-1.5 font-mono text-[12px] uppercase tracking-[0.18em] text-white hover:bg-neutral-800"
                >
                  Retry
                </button>
                <button
                  onClick={skipAvatarSession}
                  className="border border-neutral-300 bg-white px-3 py-1.5 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-700 hover:border-neutral-900"
                >
                  Continue without live directors
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 font-serif text-[13px] leading-snug text-neutral-700">
                {reloadReason === "sync"
                  ? `${director.cast.lead?.name ?? "The director"} is reading what was just generated. Back in a moment.`
                  : reloadReason === "manual"
                    ? `${director.cast.lead?.name ?? "The director"} is reconnecting. Back in a moment.`
                    : `${director.cast.lead?.name ?? "The director"}${director.cast.co ? ` and ${director.cast.co.name}` : ""} are joining…`}
              </p>
              <p className="mt-2 flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
                <span>
                  {avatarElapsed}s elapsed · the room takes 30–90s to come up
                </span>
              </p>
              <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
                {reloadReason
                  ? "Hold your next question until the avatar appears — the mic only reconnects when the room is ready."
                  : "You can keep working in the chat — they'll appear when ready."}
              </p>
              {avatarElapsed >= 30 && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={skipAvatarSession}
                    className="border border-neutral-300 bg-white px-3 py-1.5 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-700 hover:border-neutral-900"
                  >
                    Continue without live directors
                  </button>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      )}
      {/* Film School slide-over */}
      <FilmSchoolPanel
        open={filmSchoolOpen}
        onClose={() => setFilmSchoolOpen(false)}
        lessons={director.lessons}
        references={director.references}
        cast={director.cast}
      />
      <AssetModal
        asset={modalAsset}
        onClose={() => setModalAsset(null)}
        mentions={director.mentions}
        onRequestEdit={(ref, instruction, kind) => {
          const stripped = ref.startsWith("@") ? ref : `@${ref}`;
          const attachRe = /\[Attached reference:\s*([^\n\]—-]+?)\s*[—-]\s*(https?:\/\/\S+)\]/g;
          const attachedUrls: string[] = [];
          const cleanedInstruction = instruction
            .replace(attachRe, (_m, _label, url) => {
              attachedUrls.push(url);
              return "";
            })
            .replace(/\n{3,}/g, "\n\n")
            .trim();
          const urlsHint =
            attachedUrls.length > 0
              ? `\n\nUser attached ${attachedUrls.length} reference image(s). Pass them via \`reference_image_urls\` on the tool call:\n${attachedUrls.map((u) => `  - ${u}`).join("\n")}`
              : "";
          const msg =
            kind === "shot"
              ? `Re-shoot ${ref} only. Do not touch other shots. Steps: (1) call edit_video (preferred — surgical edit) OR generate_video for ${ref} with the instruction below${attachedUrls.length > 0 ? " AND reference_image_urls=[...] populated with the URLs listed below" : ""}, (2) then IMMEDIATELY call request_approval(stage="shots") with the full updated items list. Do not ask me for confirmation — just do both steps in one turn.\n\nInstruction: ${cleanedInstruction}${urlsHint}`
              : `Edit ${stripped} only. Do not touch other plates/keyframes. Steps: (1) call edit_plate(target_tag="${stripped}", edit_instruction=<the instruction below>${attachedUrls.length > 0 ? ", reference_image_urls=[...] populated with the URLs listed below" : ""}). (2) then IMMEDIATELY call request_approval(stage="${
                  kind === "keyframe" ? "keyframes" : "plates"
                }") with the full updated items list. Do not ask me for confirmation — just do both steps in one turn.\n\nInstruction: ${cleanedInstruction}${urlsHint}`;
          director.sendFollowup(msg);
        }}
      />
    </>
  );
}

/**
 * Map the existing 5-stage internal pipeline (treatment / plates / keyframes /
 * shots / final_cut) to the 8-room user-facing label. Adds PITCH (live
 * interview before treatment writes) and CUT/POST/PREMIERE (carved out of
 * shots / final_cut for narrative clarity).
 */
function derivePhase(
  kind: string,
  stage: string | undefined,
  flags: {
    hasTreatment: boolean;
    plateCount: number;
    keyframeCount: number;
    shotCount: number;
    isAgentRunning: boolean;
    treatmentPending: boolean;
    composingNow?: boolean;
    plannedShots?: number;
  }
): string | undefined {
  if (kind === "welcome") return "PITCH";

  // PREMIERE — final film is rendered. CHECK FIRST: the SCRIPT branch below
  // used to fire on (hasTreatment && !isAgentRunning), which is ALSO true at
  // PREMIERE — that made the strip highlight SCRIPT after the film was done.
  if (kind === "final") return "PREMIERE";

  // WRITING — the writer is in flight, no treatment exists yet. Director's
  // only job: teach cinema. No story questions, no references to objects
  // that don't exist. This is the most hallucination-prone window — the
  // director used to fill it by inventing details, the user caught them.
  if (
    !flags.hasTreatment &&
    (flags.treatmentPending ||
      (kind === "working" && (stage === "write_script" || !stage)))
  ) {
    return "WRITING";
  }

  // SCRIPT — only when literally on the treatment view, OR treatment exists +
  // idle + NOTHING downstream rendered. Guarding with rendered counts stops
  // SCRIPT from winning over CUT/POST/PREMIERE on a resumed finished project.
  if (kind === "treatment") return "SCRIPT";
  if (
    flags.hasTreatment &&
    !flags.isAgentRunning &&
    flags.plateCount === 0 &&
    flags.keyframeCount === 0 &&
    flags.shotCount === 0
  ) {
    return "SCRIPT";
  }

  // POST — composing the final cut OR rendering audio (VO / score / ambient).
  // Watched via `composingNow` (set when compose_video runs) OR a stage label
  // signalling post-production. Sits between SHOOT/CUT and PREMIERE.
  if (
    flags.composingNow ||
    stage === "compose_video" ||
    stage === "generate_voiceover" ||
    stage === "generate_music" ||
    stage === "generate_ambient" ||
    stage === "final_cut"
  ) {
    return "POST";
  }

  // BETWEEN — agent is generating something but nothing of that something
  // is on screen yet (e.g. plates stage with 0 plates rendered). Same
  // teach-only rule as WRITING — the director must NOT reference objects
  // that haven't been produced.
  if (kind === "production") {
    // Critical fallback: production-kind activates the moment treatment is
    // approved + status=running, BEFORE any plate has rendered. activeCheckpoint
    // is also null in this window, so `stage` is undefined. Without this guard
    // we'd return WORLD by default, and the director would walk into a "review
    // plates" room with zero plates on screen — and start asking the user to
    // approve plates that don't exist (the bug the user just hit).
    const totalRendered =
      flags.plateCount + flags.keyframeCount + flags.shotCount;
    if (totalRendered === 0) return "BETWEEN";
    if (stage === "plates" && flags.plateCount === 0) return "BETWEEN";
    if (stage === "keyframes" && flags.keyframeCount === 0) return "BETWEEN";
    if (stage === "shots" && flags.shotCount === 0) return "BETWEEN";
    if (stage === "plates") return "WORLD";
    if (stage === "keyframes") return "STORYBOARD";
    if (stage === "shots") return "SHOOT";
    // CUT — every planned shot rendered, agent idle. The user is reviewing
    // the cut; Aleph signature / coverage are optional director-driven
    // passes in this room. Without this case we'd return SHOOT forever
    // even after shooting was complete.
    const shotsAllRendered =
      flags.plannedShots !== undefined &&
      flags.plannedShots > 0 &&
      flags.shotCount >= flags.plannedShots;
    if (shotsAllRendered && !flags.isAgentRunning) return "CUT";
    // Stage undefined but assets exist — pick the latest lane.
    if (flags.shotCount > 0) return "SHOOT";
    if (flags.keyframeCount > 0) return "STORYBOARD";
    return "WORLD";
  }

  return undefined;
}

