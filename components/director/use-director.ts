"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentMessageEvent,
  AssetReadyEvent,
  BriefInput,
  CastedDirector,
  ChatMessage,
  Checkpoint,
  CheckpointReadyEvent,
  FinalFilmAsset,
  KeyframeAsset,
  PlateAsset,
  SessionStartEvent,
  ShotAsset,
  ToolActivity,
  ToolProgressEvent,
  ToolResultEvent,
  ToolStartEvent,
  TreatmentData,
  WorkspaceState,
} from "./director-types";

export type LessonCard = {
  id: string;
  director_id: string;
  film: string;
  year?: number;
  technique: string;
  why: string;
  asset_id?: string;
  created_at: number;
};

export type ReferenceCard = {
  id: string;
  url: string;
  caption: string;
  director_id: string;
  director_name: string;
  created_at: number;
};

/**
 * A pending creative suggestion from a director, surfaced as a card with
 * Apply / Pass buttons. The user can confirm via click OR via verbal
 * approval to the director (which fires commit_proposal and routes to
 * applySuggestion). The user has the final word — the director never acts
 * unilaterally.
 */
export type Suggestion =
  | {
      id: string;
      type: "treatment";
      director_id: string;
      director_name: string;
      summary: string;
      brief: string;
      status: "pending" | "applied" | "passed";
      created_at: number;
    }
  | {
      id: string;
      type: "alternative";
      director_id: string;
      director_name: string;
      summary: string;
      target_ref: string;
      direction: string;
      status: "pending" | "applied" | "passed";
      created_at: number;
    }
  | {
      id: string;
      type: "signature_pass";
      director_id: string;
      director_name: string;
      summary: string;
      target_ref: string;
      status: "pending" | "applied" | "passed";
      created_at: number;
    }
  | {
      id: string;
      type: "coverage";
      director_id: string;
      director_name: string;
      summary: string;
      target_ref: string;
      direction: string;
      status: "pending" | "applied" | "passed";
      created_at: number;
    };

export type SuggestionInput =
  | { type: "treatment"; brief: string; summary: string }
  | { type: "alternative"; target_ref: string; direction: string; summary: string }
  | { type: "signature_pass"; target_ref: string; summary: string }
  | { type: "coverage"; target_ref: string; direction: string; summary: string };

type Status = "idle" | "running" | "awaiting_approval" | "complete" | "error";

function stageLabel(toolName: string): string {
  const map: Record<string, string> = {
    write_script: "Writing the treatment",
    search_reference: "Searching references on the web",
    generate_plate: "Generating plates",
    edit_plate: "Editing plate",
    generate_keyframe: "Composing keyframes",
    generate_image: "Generating image",
    generate_video: "Filming the shot",
    edit_video: "Editing the shot",
    generate_coverage: "Generating coverage",
    apply_signature_pass: "Applying the director's signature",
    apply_director_note: "Applying the director's note",
    generate_music: "Scoring the film",
    generate_voiceover: "Recording voiceover",
    extract_frame: "Extracting frame",
    compose_video: "Cutting the final film",
    cite_lesson: "Citing a film",
    request_approval: "Presenting for approval",
  };
  return map[toolName] || "Working";
}

export function useDirector() {
  const [status, setStatus] = useState<Status>("idle");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activity, setActivity] = useState<ToolActivity[]>([]);
  const [thinking, setThinking] = useState<string>("");
  const [plates, setPlates] = useState<PlateAsset[]>([]);
  const [keyframes, setKeyframes] = useState<KeyframeAsset[]>([]);
  const [shots, setShots] = useState<ShotAsset[]>([]);
  const [finalFilm, setFinalFilm] = useState<FinalFilmAsset | null>(null);
  const [composingNow, setComposingNow] = useState(false);
  const [activeCheckpoint, setActiveCheckpoint] = useState<Checkpoint | null>(null);
  const [spec, setSpec] = useState<{ durationSeconds: number; aspectRatio: string } | null>(null);
  const [treatment, setTreatment] = useState<TreatmentData | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string }>>([]);
  // AUTEUR (May 2026) — director cast + collected teaching cards.
  const [cast, setCast] = useState<{ lead: CastedDirector | null; co: CastedDirector | null }>(
    { lead: null, co: null }
  );
  const [lessons, setLessons] = useState<LessonCard[]>([]);
  const [references, setReferences] = useState<ReferenceCard[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  // Mirror suggestions in a ref so addSuggestion() can dedup against the
  // current list without taking it as a useCallback dep (which would force a
  // new reference every keystroke and break downstream effect deps).
  const suggestionsRef = useRef<Suggestion[]>([]);
  useEffect(() => {
    suggestionsRef.current = suggestions;
  }, [suggestions]);
  // Persisted live-call transcript loaded on resume. Seeded into the active
  // session's priorTranscript via director-shell so the director walks back
  // in mid-conversation across page reloads.
  const [storedTranscript, setStoredTranscript] = useState<
    Array<{ speaker: "user" | "director"; text: string }>
  >([]);
  // Cache the user's pitch text so the avatar persona can be seeded with it
  // at session creation. Stays in memory only; not persisted.
  const [latestBrief, setLatestBrief] = useState<string | null>(null);

  const addReference = useCallback((card: ReferenceCard) => {
    setReferences((cur) => {
      if (cur.some((c) => c.id === card.id)) return cur;
      return [card, ...cur];
    });
  }, []);

  const addLesson = useCallback((card: LessonCard) => {
    setLessons((cur) => {
      if (cur.some((c) => c.id === card.id)) return cur;
      return [...cur, card];
    });
  }, []);

  // Persist suggestions to agent_config.suggestions whenever they change so
  // they survive resume / page reload. Debounced 500ms — many state changes
  // can happen in quick succession (add → applied → directive sent), no need
  // to hammer the DB.
  const generationIdRef = useRef<string | null>(null);
  useEffect(() => {
    generationIdRef.current = generationId;
  }, [generationId]);
  useEffect(() => {
    const gid = generationIdRef.current;
    if (!gid) return;
    if (suggestions.length === 0) return;
    const timer = setTimeout(() => {
      fetch("/api/suggestions/persist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: gid, suggestions }),
      }).catch((err) => console.warn("[suggestions/persist] failed:", err));
    }, 500);
    return () => clearTimeout(timer);
  }, [suggestions]);

  /**
   * Add a pending suggestion. Called when a director fires propose_X via the
   * avatar SDK. The card lands in the Suggestions strip with Apply / Pass.
   */
  const addSuggestion = useCallback(
    (
      input: SuggestionInput,
      director: { id: string; name: string }
    ): Suggestion => {
      // Dedup defense for `treatment`. The director sometimes re-fires
      // propose_treatment while the writer is already running OR while a
      // pending card is on screen. Persona prompt forbids it, but the LLM
      // occasionally slips. Skip the add and return the existing card so the
      // UI shows ONE treatment suggestion at a time.
      if (input.type === "treatment") {
        const existing = suggestionsRef.current.find(
          (s) =>
            s.type === "treatment" &&
            (s.status === "pending" || s.status === "applied")
        );
        if (existing) {
          console.warn(
            "[addSuggestion] propose_treatment ignored — an existing treatment suggestion is already",
            existing.status
          );
          return existing;
        }
      }
      const base = {
        id: crypto.randomUUID(),
        director_id: director.id,
        director_name: director.name,
        summary: input.summary,
        status: "pending" as const,
        created_at: Date.now(),
      };
      let suggestion: Suggestion;
      switch (input.type) {
        case "treatment":
          suggestion = { ...base, type: "treatment", brief: input.brief };
          break;
        case "alternative":
          suggestion = {
            ...base,
            type: "alternative",
            target_ref: input.target_ref,
            direction: input.direction,
          };
          break;
        case "signature_pass":
          suggestion = {
            ...base,
            type: "signature_pass",
            target_ref: input.target_ref,
          };
          break;
        case "coverage":
          suggestion = {
            ...base,
            type: "coverage",
            target_ref: input.target_ref,
            direction: input.direction,
          };
          break;
      }
      setSuggestions((cur) => [...cur, suggestion]);
      return suggestion;
    },
    []
  );

  const pushNotification = useCallback((message: string) => {
    const id = crypto.randomUUID();
    setNotifications((n) => [...n, { id, message }]);
    setTimeout(() => {
      setNotifications((n) => n.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  const abortRef = useRef<AbortController | null>(null);
  const historyRef = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const lastAgentMessageRef = useRef<string>("");

  // Derive workspace state
  const workspace: WorkspaceState = (() => {
    // Final takes priority
    if (finalFilm) {
      return { kind: "final", film: finalFilm, plates, keyframes, shots };
    }

    // If we have any production assets OR a non-treatment checkpoint OR are
    // composing, show production. ALSO catches the gap between treatment-
    // approval and first plate landing — user already approved (no
    // checkpoint), agent is generating plates (status running), but no plate
    // has rendered yet. Without this we'd keep showing the treatment Approve
    // button while plates are being generated, which the user sees as the
    // approval not having registered.
    const hasProduction =
      plates.length > 0 ||
      keyframes.length > 0 ||
      shots.length > 0 ||
      composingNow ||
      (activeCheckpoint && activeCheckpoint.stage !== "treatment") ||
      (!!treatment && !activeCheckpoint && status === "running");

    if (hasProduction) {
      // If the agent didn't call request_approval at the right moment but has
      // stopped running and produced assets, infer the stage from whichever
      // lane is latest so the user can still approve/iterate.
      let effectiveCheckpoint = activeCheckpoint;
      if (
        !effectiveCheckpoint &&
        status !== "running" &&
        (plates.length > 0 || keyframes.length > 0 || shots.length > 0)
      ) {
        let inferredStage: "plates" | "keyframes" | "shots" = "plates";
        if (shots.length > 0) inferredStage = "shots";
        else if (keyframes.length > 0) inferredStage = "keyframes";
        const items =
          inferredStage === "shots"
            ? shots.map((s, i) => ({
                ref: `shot_${i + 1}`,
                label: `Shot ${String(i + 1).padStart(2, "0")}`,
                kind: "shot" as const,
              }))
            : inferredStage === "keyframes"
              ? keyframes.map((k, i) => ({
                  ref: k.tag ? `@${k.tag}` : `keyframe_${i + 1}`,
                  label: k.tag ? `@${k.tag}` : `Keyframe ${i + 1}`,
                  kind: "keyframe" as const,
                }))
              : plates.map((p) => ({
                  ref: `@${p.tag}`,
                  label: `@${p.tag}`,
                  kind: "plate" as const,
                }));
        effectiveCheckpoint = {
          stage: inferredStage,
          summary: `Inferred checkpoint — the agent produced ${items.length} ${inferredStage} but did not call request_approval. Approve below or ask for changes.`,
          items,
        };
      }

      return {
        kind: "production",
        plates,
        keyframes,
        shots,
        composing: composingNow,
        activeCheckpoint:
          effectiveCheckpoint && effectiveCheckpoint.stage !== "treatment"
            ? effectiveCheckpoint
            : null,
        lastAgentMessage: lastAgentMessageRef.current,
      };
    }

    // Treatment state: we have structured treatment data, an explicit
    // treatment checkpoint, or a non-empty agent message.
    if (
      treatment ||
      activeCheckpoint?.stage === "treatment" ||
      lastAgentMessageRef.current
    ) {
      return {
        kind: "treatment",
        treatment,
        text: treatment ? "" : lastAgentMessageRef.current || activeCheckpoint?.summary || "",
        pending: !treatment && status === "running",
      };
    }

    // Running but nothing to show yet — display an animated working state.
    if (status === "running") {
      const runningTool = activity.find((a) => a.status === "running");
      const stage = runningTool?.name || "write_script";
      const label = stageLabel(stage);
      return { kind: "working", stage, label };
    }

    return { kind: "welcome" };
  })();

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((m) => [...m, msg]);
  }, []);

  const appendUser = useCallback(
    (content: string) => {
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        createdAt: Date.now(),
      };
      appendMessage(msg);
      historyRef.current.push({ role: "user", content });
    },
    [appendMessage]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    // Flip the UI to idle immediately so the user sees Stop actually took
    // effect. The server-side loop receives the abort via request.signal
    // and exits at the next turn boundary; the client doesn't wait.
    setStatus("idle");
    setThinking("");
    setActivity((a) =>
      a.map((x) =>
        x.status === "running" ? { ...x, status: "failed" as const, completedAt: Date.now() } : x
      )
    );
  }, []);

  async function streamRun(body: Record<string, unknown>) {
    setStatus("running");
    setThinking("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const raw of events) {
          const lines = raw.split("\n");
          let eventType = "";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventType = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
          }
          if (!eventType || !dataStr) continue;

          let data: unknown;
          try {
            data = JSON.parse(dataStr);
          } catch {
            continue;
          }

          handleEvent(eventType, data);
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") {
        // Client aborted (Stop button). Status already flipped to idle in stop().
        return;
      }
      console.error("[director] stream error", err);
      appendMessage({
        id: crypto.randomUUID(),
        role: "system",
        content: `Stream error: ${(err as Error).message}`,
        createdAt: Date.now(),
      });
      setStatus("error");
    } finally {
      // Safety net: if the stream ended without a terminal SSE event
      // (server crashed, fetch dropped, etc.), don't leave the UI stuck
      // on "running". Only flip to idle if still running.
      setStatus((s) => (s === "running" ? "idle" : s));
    }
  }

  function handleEvent(event: string, data: unknown) {
    switch (event) {
      case "session_start": {
        const d = data as SessionStartEvent;
        setGenerationId(d.generationId);
        setSessionId(d.sessionId);
        if (d.durationSeconds && d.aspectRatio) {
          setSpec({ durationSeconds: d.durationSeconds, aspectRatio: d.aspectRatio });
        }
        return;
      }
      case "thinking": {
        const d = data as { text?: string };
        if (d.text) setThinking((t) => t + d.text);
        return;
      }
      case "agent_message": {
        const d = data as AgentMessageEvent;
        setThinking("");
        if (!d.content || d.content.length === 0) return; // ignore empty ack messages
        // Strip any SYSTEM-style preludes an agent might echo. The real
        // agent never says "Understood. I have access to..." — if it ever
        // shows up, it's stale context that shouldn't reach the chat.
        const cleaned = stripToolNoise(d.content);
        if (!cleaned) return;
        lastAgentMessageRef.current = cleaned;
        appendMessage({
          id: crypto.randomUUID(),
          role: "agent",
          content: cleaned,
          createdAt: Date.now(),
        });
        // Preserve raw in agent-visible history so Claude keeps full context.
        historyRef.current.push({ role: "assistant", content: d.content });
        return;
      }
      case "tool_start": {
        const d = data as { toolCallId?: string; toolName?: string };
        const id = d.toolCallId || crypto.randomUUID();
        const name = d.toolName || "tool";
        setActivity((a) => [
          ...a,
          {
            id,
            name,
            message: "",
            status: "running",
            startedAt: Date.now(),
          },
        ]);
        return;
      }
      case "tool_progress": {
        const d = data as { id?: string; tool?: string; message?: string };
        if (d.tool === "compose_video") setComposingNow(true);
        setActivity((a) =>
          a.map((x) =>
            (d.id && x.id === d.id) || (!d.id && x.name === d.tool && x.status === "running")
              ? { ...x, message: d.message || "" }
              : x
          )
        );
        return;
      }
      case "tool_result": {
        const d = data as { toolCallId?: string; toolName?: string; success?: boolean };
        setActivity((a) =>
          a.map((x) =>
            x.id === d.toolCallId
              ? { ...x, status: d.success ? "success" : "failed", completedAt: Date.now() }
              : x
          )
        );
        return;
      }
      case "asset_ready": {
        const d = data as AssetReadyEvent;
        const role = (d.metadata?.role as string) || "";
        // Edit notification: plate edits + video edits carry edited_from /
        // source_shot_tag in metadata — surface a toast so the user knows it's done.
        const editedFrom =
          (d.metadata?.edited_from as string | undefined) ||
          (d.metadata?.source_shot_tag as string | undefined);
        if (editedFrom) {
          pushNotification(`Edit ready · ${editedFrom}`);
        }
        if (d.type === "image" && role === "plate" && d.url) {
          setPlates((p) => {
            const tag = (d.metadata?.tag as string) || d.assetId;
            // Dedupe by tag AND by id — the old row with the same tag drops,
            // and we never duplicate a row if the server emits twice.
            const filtered = p.filter((x) => x.tag !== tag && x.id !== d.assetId);
            return [
              ...filtered,
              {
                id: d.assetId,
                url: d.url!,
                tag,
                plateKind: (d.metadata?.plate_kind as PlateAsset["plateKind"]) || "prop",
                description: d.metadata?.description as string | undefined,
                aspectRatio: d.metadata?.aspect_ratio as string | undefined,
                parentAssetId: d.metadata?.parent_asset_id as string | undefined,
                editedFrom: editedFrom,
                editInstruction: d.metadata?.edit_instruction as string | undefined,
              },
            ];
          });
        } else if (d.type === "image" && role === "keyframe" && d.url) {
          setKeyframes((k) => {
            const tag = d.metadata?.tag as string | undefined;
            const shotId = d.metadata?.shot_id as string | undefined;
            const keyframeRole = d.metadata?.keyframe_role as
              | "hero"
              | "first_frame"
              | "last_frame"
              | undefined;
            // Three-way dedupe for keyframes: tag match (edit_plate re-uses
            // the same tag), id match (defense against double-emit), AND
            // (shotId, role) match (covers the case where the agent
            // regenerates a keyframe via generate_keyframe without the tag
            // being propagated consistently — e.g. shot_1/last_frame gets
            // a new assetId but should replace the old shot_1/last_frame).
            const filtered = k.filter((x) => {
              if (tag && x.tag === tag) return false;
              if (x.id === d.assetId) return false;
              if (shotId && keyframeRole && x.shotId === shotId && x.role === keyframeRole) {
                return false;
              }
              return true;
            });
            return [
              ...filtered,
              {
                id: d.assetId,
                url: d.url!,
                tag,
                shotId,
                role: keyframeRole,
                prompt: d.metadata?.composition_prompt as string | undefined,
                plateTags: d.metadata?.plate_tags as string[] | undefined,
                aspectRatio: d.metadata?.aspect_ratio as string | undefined,
                parentAssetId: d.metadata?.parent_asset_id as string | undefined,
                editedFrom: editedFrom,
                editInstruction: d.metadata?.edit_instruction as string | undefined,
              },
            ];
          });
        } else if (d.type === "image" && d.url) {
          // Generic image (end cards etc.) — store as keyframe lane
          setKeyframes((k) => [
            ...k,
            {
              id: d.assetId,
              url: d.url!,
              tag: d.metadata?.tag as string | undefined,
              prompt: d.metadata?.prompt as string | undefined,
            },
          ]);
        } else if (d.type === "video" && role === "shot" && d.url) {
          setShots((s) => [
            ...s,
            {
              id: d.assetId,
              videoUrl: d.url!,
              prompt: (d.metadata?.prompt as string) || "",
              mode: (d.metadata?.mode as string) || "",
              durationLabel: (d.metadata?.duration as string) || "",
              aspectRatio: (d.metadata?.aspect_ratio as string) || "",
              imageUrls: (d.metadata?.image_urls as string[]) || null,
            },
          ]);
        } else if (d.type === "video" && role === "final_film" && d.url) {
          setFinalFilm({
            id: d.assetId,
            url: d.url,
            aspectRatio: d.metadata?.aspect_ratio as string | undefined,
          });
          setComposingNow(false);
        }
        return;
      }
      case "treatment_ready": {
        const d = data as TreatmentData;
        setTreatment(d);
        return;
      }
      case "checkpoint_ready": {
        const d = data as CheckpointReadyEvent;
        setActiveCheckpoint({ stage: d.stage, summary: d.summary, items: d.items });
        setStatus("awaiting_approval");
        return;
      }
      case "lesson_added": {
        const card = data as LessonCard;
        setLessons((cur) => {
          // De-dupe by id in case the server re-emits.
          if (cur.some((c) => c.id === card.id)) return cur;
          return [...cur, card];
        });
        // Tiny toast acknowledging the lesson without competing with chat.
        pushNotification(`+ Lesson · ${card.film}`);
        return;
      }
      case "complete": {
        // If we hit a checkpoint, status is already 'awaiting_approval'; don't override.
        setStatus((s) => (s === "awaiting_approval" ? s : finalFilm ? "complete" : "idle"));
        return;
      }
      case "error": {
        const d = data as { message?: string };
        appendMessage({
          id: crypto.randomUUID(),
          role: "system",
          content: d.message || "An error occurred",
          createdAt: Date.now(),
        });
        setStatus("error");
        return;
      }
    }
  }

  // Remove tool-use / tool-result scaffolding lines AND the legacy
  // "[SYSTEM: Previously generated assets..." injection (now deleted server-
  // side, but still present in historic agent_sessions.messages rows, so
  // resumed sessions need client-side filtering too). Also strips the canned
  // "Understood. I have access to all previously generated assets..."
  // assistant reply that paired with it.
  function stripToolNoise(content: string): string {
    const trimmed = content.trim();
    if (
      trimmed.startsWith("[SYSTEM: Previously generated assets") ||
      trimmed.startsWith("[SYSTEM: ") ||
      trimmed ===
        "Understood. I have access to all previously generated assets and will reuse them."
    ) {
      return "";
    }
    return content
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return (
          !/^\[called .+\]$/.test(t) &&
          !/^\[result:/.test(t) &&
          !/^\[SYSTEM:/.test(t)
        );
      })
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const resumeGeneration = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/generations/${id}`);
      if (!res.ok) throw new Error(`Failed to load generation (${res.status})`);
      const { generation, session } = await res.json();
      if (!generation) throw new Error("Generation not found");

      // Reset
      setMessages([]);
      setActivity([]);
      setPlates([]);
      setKeyframes([]);
      setShots([]);
      setFinalFilm(null);
      setComposingNow(false);
      setActiveCheckpoint(null);
      setTreatment(null);
      setLessons([]);
      setReferences([]);
      setSuggestions([]);
      setLatestBrief(generation.prompt || null);
      historyRef.current = [];
      lastAgentMessageRef.current = "";

      setGenerationId(generation.id);
      setSessionId(session?.id || null);

      // Spec from generation row
      const aspect = generation.aspect_ratio || generation.metadata?.aspect_ratio || "16:9";
      const dur = generation.duration_seconds || generation.metadata?.duration_seconds || 30;
      setSpec({ durationSeconds: dur, aspectRatio: aspect });

      // AUTEUR: rehydrate director cast + lesson plan from agent_config (the
      // only jsonb column on generations — there is no `metadata` column).
      // The cast object is the lobby-safe view (no personality/inspiration);
      // we fetch the public director list to fill in name + portrait.
      const cfg = (generation.agent_config || generation.metadata || {}) as Record<string, unknown>;
      const leadId = (cfg.lead_director_id as string | undefined) || undefined;
      const coId = (cfg.co_director_id as string | undefined) || undefined;
      if (leadId || coId) {
        try {
          const dirRes = await fetch("/api/directors");
          const dirJson = (await dirRes.json()) as {
            directors: CastedDirector[];
          };
          const lead =
            (leadId && dirJson.directors.find((d) => d.id === leadId)) || null;
          const co =
            (coId && dirJson.directors.find((d) => d.id === coId)) || null;
          setCast({ lead, co });
        } catch {
          // Non-critical — cast just won't display.
        }
      }
      const storedLessons = (cfg.lesson_plan as LessonCard[] | undefined) || [];
      if (storedLessons.length > 0) setLessons(storedLessons);
      const storedRefs = (cfg.whiteboard_images as ReferenceCard[] | undefined) || [];
      if (storedRefs.length > 0) setReferences(storedRefs);
      const storedSuggestions = (cfg.suggestions as Suggestion[] | undefined) || [];
      if (storedSuggestions.length > 0) setSuggestions(storedSuggestions);
      const storedTranscript =
        (cfg.live_transcript as Array<{
          speaker: "user" | "director";
          text: string;
        }> | undefined) || [];
      if (storedTranscript.length > 0) setStoredTranscript(storedTranscript);

      // Hydrate plates / keyframes / shots / final from stored assets
      const assets = (generation.generation_assets || []) as Array<{
        id: string;
        type: string;
        asset_role?: string | null;
        public_url: string | null;
        tag?: string | null;
        aspect_ratio?: string | null;
        metadata?: Record<string, unknown> | null;
      }>;
      for (const a of assets) {
        if (!a.public_url) continue;
        const meta = a.metadata || {};
        const role = a.asset_role;
        // Plates/keyframes with a NULL tag have been superseded by an edit
        // (edit_plate nulls the parent's tag when creating the new version).
        // Hide them from the workspace so the user only sees the current
        // version of each @tag.
        if (a.type === "image" && role === "plate") {
          const plateTag = a.tag;
          if (!plateTag) continue;
          setPlates((p) => {
            // Dedupe: keep only the latest row per tag.
            const filtered = p.filter((x) => x.tag !== plateTag);
            return [
              ...filtered,
              {
                id: a.id,
                url: a.public_url!,
                tag: plateTag,
                plateKind: (meta.plate_kind as PlateAsset["plateKind"]) || "prop",
                description: meta.description as string | undefined,
                aspectRatio: a.aspect_ratio || undefined,
              },
            ];
          });
        } else if (a.type === "image" && role === "keyframe") {
          const kfTag = a.tag;
          if (!kfTag) continue;
          const kfShotId = meta.shot_id as string | undefined;
          const kfRole = meta.keyframe_role as
            | "hero"
            | "first_frame"
            | "last_frame"
            | undefined;
          setKeyframes((k) => {
            // Dedupe by tag AND by (shotId, role) so regenerated keyframes
            // replace the old one even if they were issued under a slightly
            // different tag.
            const filtered = k.filter((x) => {
              if (x.tag === kfTag) return false;
              if (kfShotId && kfRole && x.shotId === kfShotId && x.role === kfRole) {
                return false;
              }
              return true;
            });
            return [
              ...filtered,
              {
                id: a.id,
                url: a.public_url!,
                tag: kfTag,
                shotId: kfShotId,
                role: kfRole,
                prompt: meta.composition_prompt as string | undefined,
                plateTags: meta.plate_tags as string[] | undefined,
                aspectRatio: a.aspect_ratio || undefined,
              },
            ];
          });
        } else if (a.type === "video" && role === "shot") {
          setShots((s) => [
            ...s,
            {
              id: a.id,
              videoUrl: a.public_url!,
              prompt: (meta.prompt as string) || "",
              mode: (meta.mode as string) || "",
              durationLabel: String(meta.duration ?? ""),
              aspectRatio: a.aspect_ratio || "",
              imageUrls: (meta.image_urls as string[]) || null,
            },
          ]);
        } else if (a.type === "video" && meta.role === "final_film") {
          setFinalFilm({
            id: a.id,
            url: a.public_url!,
            aspectRatio: a.aspect_ratio || undefined,
          });
        } else if (a.type === "script" && meta && (meta.shots || meta.plates)) {
          // Rehydrate the treatment from the script asset's metadata so the
          // Continue-generating / Approve logic knows how many keyframes
          // and shots the film is supposed to have.
          setTreatment({
            title: (meta.title as string) || "",
            logline: (meta.logline as string) || "",
            end_card: (meta.end_card as string) || "",
            duration_seconds: (meta.duration_seconds as number) || 30,
            aspect_ratio: (meta.aspect_ratio as string) || aspect,
            tone: (meta.tone as string) || "",
            color_script: meta.color_script as TreatmentData["color_script"],
            camera_rule: (meta.camera_rule as string) || "",
            reference_films: (meta.reference_films as string[]) || [],
            plates: (meta.plates as TreatmentData["plates"]) || [],
            shots: (meta.shots as TreatmentData["shots"]) || [],
            music: meta.music as TreatmentData["music"],
            voiceover: meta.voiceover as TreatmentData["voiceover"],
          });
        }
      }

      // Synthesize an activeCheckpoint based on the latest stage present, so
      // Approve / Request changes work after resume. Without this, the UI
      // renders an inferred checkpoint card but respondToCheckpoint sees
      // activeCheckpoint=null and short-circuits — the approve button is dead.
      const hydratedPlates = assets.filter(
        (a) => a.type === "image" && a.asset_role === "plate" && a.tag
      );
      const hydratedKeyframes = assets.filter(
        (a) => a.type === "image" && a.asset_role === "keyframe" && a.tag
      );
      const hydratedShots = assets.filter(
        (a) => a.type === "video" && a.asset_role === "shot"
      );
      const hasFinal = assets.some(
        (a) => a.type === "video" && (a.metadata as Record<string, unknown> | null)?.role === "final_film"
      );

      if (hasFinal) {
        setActiveCheckpoint(null);
        setStatus("complete");
      } else if (hydratedShots.length > 0) {
        setActiveCheckpoint({
          stage: "shots",
          summary: `${hydratedShots.length} shot${hydratedShots.length === 1 ? "" : "s"} ready. Approve to compose the final cut, or flag shots to re-shoot.`,
          items: hydratedShots.map((s, i) => ({
            asset_id: s.id,
            ref: `shot_${i + 1}`,
            label: `Shot ${String(i + 1).padStart(2, "0")}`,
            kind: "shot",
          })),
        });
        setStatus("awaiting_approval");
      } else if (hydratedKeyframes.length > 0) {
        setActiveCheckpoint({
          stage: "keyframes",
          summary: `${hydratedKeyframes.length} keyframe${hydratedKeyframes.length === 1 ? "" : "s"} ready. Approve to start rendering shots, or flag items to edit.`,
          items: hydratedKeyframes.map((k) => ({
            asset_id: k.id,
            ref: k.tag ? `@${k.tag}` : "",
            label: k.tag ? `@${k.tag}` : "keyframe",
            kind: "keyframe",
          })),
        });
        setStatus("awaiting_approval");
      } else if (hydratedPlates.length > 0) {
        setActiveCheckpoint({
          stage: "plates",
          summary: `${hydratedPlates.length} plate${hydratedPlates.length === 1 ? "" : "s"} ready. Approve to compose keyframes, or flag plates to edit.`,
          items: hydratedPlates.map((p) => ({
            asset_id: p.id,
            ref: `@${p.tag}`,
            label: `@${p.tag}`,
            kind: "plate",
          })),
        });
        setStatus("awaiting_approval");
      }

      // Hydrate chat from session messages (compact text form). The stored
      // format includes tool scaffolding lines like "[called tool({...})]" and
      // "[result: ...]" — those are internal agent context; strip them from
      // the user-visible chat.
      const stored = (session?.messages || []) as Array<{
        role: "user" | "assistant";
        content: string;
      }>;
      const rendered: ChatMessage[] = stored
        .map((m) => ({
          role: m.role,
          content: stripToolNoise(m.content || ""),
        }))
        .filter((m) => m.content.length > 0)
        .map((m) => ({
          id: crypto.randomUUID(),
          role: m.role === "assistant" ? ("agent" as const) : ("user" as const),
          content: m.content,
          createdAt: Date.now(),
        }));
      setMessages(rendered);
      // Agent-visible history keeps the scaffolding (Claude uses it to
      // understand what happened), but also skips fully-empty entries.
      historyRef.current = stored
        .filter((m) => (m.content || "").trim().length > 0)
        .map((m) => ({ role: m.role, content: m.content }));
      const lastAssistant = [...stored]
        .reverse()
        .find((m) => m.role === "assistant" && stripToolNoise(m.content || "").length > 0);
      lastAgentMessageRef.current = lastAssistant
        ? stripToolNoise(lastAssistant.content)
        : "";

      // Only fall to idle if we didn't already synthesize a checkpoint above.
      setStatus((s) => (s === "awaiting_approval" || s === "complete" ? s : "idle"));
    } catch (err) {
      console.error("[use-director] resume failed:", err);
      appendMessage({
        id: crypto.randomUUID(),
        role: "system",
        content: `Failed to resume session: ${err instanceof Error ? err.message : err}`,
        createdAt: Date.now(),
      });
    }
  }, [appendMessage]);

  const startBrief = useCallback(
    async (input: BriefInput) => {
      setMessages([]);
      setActivity([]);
      setPlates([]);
      setKeyframes([]);
      setShots([]);
      setFinalFilm(null);
      setComposingNow(false);
      setActiveCheckpoint(null);
      setGenerationId(null);
      setSessionId(null);
      setTreatment(null);
      setLessons([]);
      setReferences([]);
      setSuggestions([]);
      setLatestBrief(input.prompt);
      historyRef.current = [];
      lastAgentMessageRef.current = "";
      setSpec({ durationSeconds: input.durationSeconds, aspectRatio: input.aspectRatio });

      // If references were attached, prepend them AS A HARD DIRECTIVE at the
      // top of the prompt so the agent cannot drop them. Agent was ignoring
      // bottom-appended reference blocks — top placement + imperative wording
      // + explicit "you MUST" instruction fixes pass-through.
      const refBlock = input.referenceImages?.length
        ? [
            "CRITICAL — USER-UPLOADED REFERENCE IMAGES (you MUST use these):",
            "",
            ...input.referenceImages.map(
              (r, i) =>
                `  ${i + 1}. ${r.label}\n     URL: ${r.url}`
            ),
            "",
            "RULES for these reference URLs:",
            "  • When generating the plate that represents each reference (e.g. the character plate for a person photo, the prop plate for an object photo, the location_master for a place photo), you MUST pass the matching URL via the `reference_image_urls` field on `generate_plate`.",
            "  • NEVER generate that plate without the reference attached — identity will drift.",
            "  • If the user named the subject (e.g. 'Salim'), the character plate MUST use the reference with the matching label.",
            "  • If multiple generation attempts are needed for the same subject, re-attach the same reference URL every time.",
            "",
            "--- END REFERENCES ---",
            "",
          ].join("\n")
        : "";
      const fullPrompt = refBlock + input.prompt;

      appendUser(input.prompt); // show only the user-visible prompt in chat

      await streamRun({
        brandId: input.brandId,
        prompt: fullPrompt,
        durationSeconds: input.durationSeconds,
        aspectRatio: input.aspectRatio,
        leadDirectorId: input.leadDirectorId,
        coDirectorId: input.coDirectorId,
      });
    },
    [appendUser]
  );

  const sendFollowup = useCallback(
    async (prompt: string) => {
      if (!generationId) {
        await startBrief({ prompt, durationSeconds: 30, aspectRatio: "16:9" });
        return;
      }
      // Clear any active checkpoint — user is moving forward
      setActiveCheckpoint(null);
      appendUser(prompt);
      await streamRun({
        generationId,
        prompt,
        conversationHistory: historyRef.current.slice(0, -1),
        durationSeconds: spec?.durationSeconds,
        aspectRatio: spec?.aspectRatio,
      });
    },
    [generationId, appendUser, startBrief, spec]
  );

  /**
   * Send an internal directive (approval routing, applied-suggestion routing)
   * to the agent WITHOUT showing the verbose directive text in the user-
   * visible chat. The directive still flows into conversation history so the
   * agent has full context — but the user only sees a tiny "↗ {summary}"
   * note instead of paragraphs of internal plumbing like "The user just
   * approved Marcel Vrai's proposal to write the treatment...".
   */
  const sendInternalDirective = useCallback(
    async (prompt: string, displaySummary?: string) => {
      if (!generationId) return;
      setActiveCheckpoint(null);
      // History gets the full directive (agent needs it).
      historyRef.current.push({ role: "user", content: prompt });
      // Chat only gets a short system-style note, if any.
      if (displaySummary) {
        appendMessage({
          id: crypto.randomUUID(),
          role: "system",
          content: `↗ ${displaySummary}`,
          createdAt: Date.now(),
        });
      }
      await streamRun({
        generationId,
        prompt,
        conversationHistory: historyRef.current.slice(0, -1),
        durationSeconds: spec?.durationSeconds,
        aspectRatio: spec?.aspectRatio,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [generationId, appendMessage, spec]
  );

  /**
   * Resolve a suggestion target — either by exact id, OR by latest-pending
   * from a given director. The director's `commit_proposal` may not always
   * carry the right id (verbal flow), so we fall back to the most recent
   * pending suggestion from that director.
   */
  function resolvePending(
    suggestionId?: string,
    directorId?: string
  ): Suggestion | null {
    let pending = suggestions.filter((s) => s.status === "pending");
    if (suggestionId) {
      const exact = pending.find((s) => s.id === suggestionId);
      if (exact) return exact;
    }
    if (directorId) pending = pending.filter((s) => s.director_id === directorId);
    if (pending.length === 0) return null;
    return pending[pending.length - 1]; // most recent
  }

  /** Build the agent directive for an applied suggestion. */
  function buildApplyDirective(s: Suggestion): string {
    switch (s.type) {
      case "treatment":
        return [
          `The user just approved ${s.director_name}'s proposal to write the treatment.`,
          `Use this brief verbatim:`,
          `"""`,
          s.brief,
          `"""`,
          `Call write_script NOW with this brief and the user's film spec. Do not ask follow-up questions; the directors and the user have already discussed.`,
        ].join("\n");
      case "alternative": {
        const isShot = /^shot_/i.test(s.target_ref);
        const isTag = s.target_ref.startsWith("@");
        if (isShot) {
          return [
            `The user just approved ${s.director_name}'s suggestion: change ${s.target_ref}.`,
            `Action: call edit_video(shot_id="${s.target_ref}", source_shot_tag="${s.target_ref}", edit_instruction="${s.direction.replace(/"/g, '\\"')}").`,
            `Then immediately call request_approval(stage="shots") with the full updated items list. Do not ask for confirmation.`,
          ].join("\n");
        }
        const tag = isTag ? s.target_ref.slice(1) : s.target_ref;
        return [
          `The user just approved ${s.director_name}'s suggestion: change @${tag}.`,
          `Action: call edit_plate(target_tag="${tag}", edit_instruction="${s.direction.replace(/"/g, '\\"')}").`,
          `Then immediately call request_approval for the relevant stage (plates or keyframes — pick the right one based on what @${tag} is) with the full updated items list. Do not ask for confirmation.`,
        ].join("\n");
      }
      case "signature_pass":
        return [
          `The user approved ${s.director_name}'s signature pass on ${s.target_ref}.`,
          `Look up the asset id for ${s.target_ref} via list_assets if needed.`,
          `Then call apply_signature_pass(target_asset_id="<that id>", director_id="${s.director_id}", signature_prompt="<one of ${s.director_name}'s alephSignaturePrompts from the DIRECTORS section in your context>").`,
          `Then immediately call request_approval(stage="shots") with the updated list.`,
        ].join("\n");
      case "coverage":
        return [
          `The user approved ${s.director_name}'s coverage suggestion on ${s.target_ref}.`,
          `Action: call generate_coverage(master_shot_id="${s.target_ref}", angle_label="${s.summary.slice(0, 40)}", angle_prompt="${s.direction.replace(/"/g, '\\"')}").`,
          `Then call request_approval(stage="shots") with the updated list.`,
        ].join("\n");
    }
  }

  const applySuggestion = useCallback(
    async (suggestionId?: string, directorId?: string) => {
      const target = resolvePending(suggestionId, directorId);
      if (!target) {
        // Already applied / passed (e.g. user clicked Apply, then said
        // "go ahead" — director fires commit_proposal with the same id but
        // it's no longer pending). Benign; no warning.
        return;
      }
      // Mark applied immediately so the UI updates
      setSuggestions((cur) =>
        cur.map((s) =>
          s.id === target.id ? { ...s, status: "applied" as const } : s
        )
      );
      const directive = buildApplyDirective(target);
      const summary = target.summary || `Applied: ${target.type}`;
      await sendInternalDirective(directive, summary);
    },
    // resolvePending + buildApplyDirective close over `suggestions` via the
    // hook's own closure; we re-create applySuggestion when those change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestions, sendInternalDirective]
  );

  const passSuggestion = useCallback(
    (suggestionId?: string, directorId?: string) => {
      const target = resolvePending(suggestionId, directorId);
      if (!target) return;
      setSuggestions((cur) =>
        cur.map((s) =>
          s.id === target.id ? { ...s, status: "passed" as const } : s
        )
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestions]
  );

  /**
   * Respond to the active checkpoint.
   * - `approve` with empty edits → agent proceeds to next stage
   * - `edits` = { ref: feedback-text } → agent regenerates only the flagged items with notes
   */
  const respondToCheckpoint = useCallback(
    async (edits: Record<string, string>, additionalNote?: string) => {
      if (!activeCheckpoint) return;
      const editRefs = Object.keys(edits).filter((k) => edits[k].trim().length > 0);
      const stage = activeCheckpoint.stage;
      let msg: string;
      let displaySummary: string | undefined;
      if (editRefs.length === 0) {
        // Stage-specific advance directive. Without this the agent has been
        // observed re-running the same stage's tools (e.g. calling
        // write_script again after treatment approval). Spelling out the
        // next-stage tool calls fixes that.
        const stageDirectives: Record<string, string> = {
          treatment: [
            "The TREATMENT is APPROVED. Move to the PLATES stage now. Do NOT call write_script again.",
            "Action: for every plate listed in the approved treatment (the `plates` array on the treatment), call generate_plate with its tag, kind, description, and any reference URLs. Up to 5 generate_plate calls in parallel per turn.",
            "After all plates render across one or more turns, call request_approval(stage=\"plates\") with the full items list. Then stop.",
          ].join("\n"),
          plates: [
            "The PLATES are APPROVED. Move to the KEYFRAMES stage now. Do NOT regenerate plates.",
            "Action: for every shot in the treatment, compose its hero keyframe — execute the shot's `shot_build` chain literally (generate_plate / edit_plate steps in order), terminating with generate_keyframe(role=\"hero\"). Up to 5 shots' chains in parallel per turn.",
            "After every shot has its hero keyframe rendered, call request_approval(stage=\"keyframes\") with the full items list. Then stop.",
          ].join("\n"),
          keyframes: [
            "The KEYFRAMES are APPROVED. Move to the SHOTS stage now. Do NOT regenerate keyframes.",
            "Action: for every keyframe, call generate_video with a ≤25-word mechanical motion prompt and the keyframe_tag. Up to 5 generate_video calls in parallel per turn.",
            "After every keyframe has its rendered shot, call request_approval(stage=\"shots\") with the full items list. Then stop.",
          ].join("\n"),
          shots: [
            "The SHOTS are APPROVED. Move to POST now. Do NOT regenerate shots.",
            "Action this turn — fire all THREE audio tools in parallel: generate_voiceover (if the treatment specifies voiceover), generate_music, and generate_ambient (mode='bed', description tailored to the film's primary location). Once all three return, call compose_video with all rendered shot URLs in shot_id order, voiceover_url, background_music_url, AND ambient_sound_url.",
            "After compose_video succeeds, call request_approval(stage=\"final_cut\", items=[{ref:\"final_film\", ...}]). Then stop.",
          ].join("\n"),
          final_cut: [
            "The FINAL CUT is APPROVED. The film is locked. End the turn — do not call any further tools.",
          ].join("\n"),
        };
        const directive = stageDirectives[stage];
        msg = directive
          ? `${directive}${additionalNote ? `\n\nAdditional note: ${additionalNote}` : ""}`
          : `Approved. Proceed to the next stage.${additionalNote ? ` Note: ${additionalNote}` : ""}`;
        const stageDisplay: Record<string, string> = {
          treatment: "Treatment approved · starting plates",
          plates: "Plates approved · composing keyframes",
          keyframes: "Keyframes approved · shooting",
          shots: "Shots approved · cutting",
          final_cut: "Final cut approved",
        };
        displaySummary = stageDisplay[stage] || "Approved · advancing";
      } else {
        const lines = editRefs.map((r) => `- ${r}: ${edits[r].trim()}`);
        msg =
          `Changes requested. Regenerate ONLY the following items with the notes below — keep everything else exactly as-is, do not touch items not listed here. After you regenerate them, call request_approval again at the SAME stage ('${activeCheckpoint.stage}') so I can review.\n\n` +
          lines.join("\n") +
          (additionalNote ? `\n\nAdditional note: ${additionalNote}` : "");
        displaySummary = `Re-doing ${editRefs.length} item${editRefs.length === 1 ? "" : "s"} at ${stage}`;
      }
      await sendInternalDirective(msg, displaySummary);
    },
    [activeCheckpoint, sendInternalDirective]
  );

  const mentions = useMemo(() => {
    const out: Array<{
      tag: string;
      kind: "plate" | "keyframe" | "shot" | "final";
      hint?: string;
    }> = [];
    for (const p of plates) {
      if (p.tag) out.push({ tag: p.tag, kind: "plate", hint: p.plateKind });
    }
    for (const k of keyframes) {
      if (k.tag) out.push({ tag: k.tag, kind: "keyframe", hint: k.shotId });
    }
    for (let i = 0; i < shots.length; i++) {
      out.push({ tag: `shot_${i + 1}`, kind: "shot" });
    }
    if (finalFilm) {
      out.push({ tag: "final", kind: "final" });
    }
    return out;
  }, [plates, keyframes, shots, finalFilm]);

  return {
    status,
    generationId,
    sessionId,
    messages,
    activity,
    thinking,
    workspace,
    spec,
    activeCheckpoint,
    treatment,
    plates,
    keyframes,
    shots,
    finalFilm,
    mentions,
    notifications,
    pushNotification,
    cast,
    setCast,
    lessons,
    addLesson,
    references,
    addReference,
    storedTranscript,
    suggestions,
    addSuggestion,
    applySuggestion,
    passSuggestion,
    latestBrief,
    startBrief,
    resumeGeneration,
    sendFollowup,
    respondToCheckpoint,
    stop,
  };
}
