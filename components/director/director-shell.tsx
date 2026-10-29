"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BriefForm } from "./brief-form";
import { Cast, type CastSelection } from "./cast";
import { ChatPane } from "./chat-pane";
import { WorkspacePane } from "./workspace-pane";
import { AssetModal, type AssetModalInput } from "./asset-modal";
import { RecentFilms } from "./recent-films";
import { useDirector } from "./use-director";
import type { BriefInput, CastedDirector } from "./director-types";

type Brand = { id: string; name: string };

export function DirectorShell({ brands }: { brands: Brand[] }) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState<"cast" | "brief">("cast");
  const [modalAsset, setModalAsset] = useState<AssetModalInput>(null);
  const director = useDirector();
  const searchParams = useSearchParams();
  const resumeId = searchParams?.get("resume");

  useEffect(() => {
    if (!resumeId) return;
    setStarted(true);
    director.resumeGeneration(resumeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId]);

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
    const hasTreatment = !!director.treatment;
    director.sendFollowup(
      hasTreatment
        ? "Not quite. Re-pitch the treatment from a different angle — shift the tone, swap the reference films, cast different."
        : "Stop asking questions. Use your best interpretation of the brief and call write_script NOW. The lead director's school decides any ambiguity. Do not reply with text — call the tool."
    );
  };

  // Expected keyframe count from the treatment: one hero keyframe per scene.
  const expectedCounts = (() => {
    const t = director.treatment;
    if (!t || !Array.isArray(t.shots)) return undefined;
    const keyframes = t.shots.filter((s) => s.keyframe_plan === "hero").length;
    return { keyframes, shots: t.shots.length };
  })();

  const onContinueGenerating = (stage: "keyframes" | "shots") => {
    if (stage === "keyframes") {
      director.sendFollowup(
        "Continue generating the remaining keyframes for every scene that doesn't have one yet. Fire up to 5 generate_keyframe calls in parallel per turn until every scene in the script has its keyframe rendered. After all are done, call request_approval(stage=\"keyframes\")."
      );
    } else {
      director.sendFollowup(
        "Continue rendering the remaining scenes for every keyframe that doesn't have one yet. Fire up to 5 generate_video calls in parallel per turn. After every scene renders, call request_approval(stage=\"shots\")."
      );
    }
  };

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
        director.workspace.kind === "treatment" && "pending" in director.workspace
          ? Boolean(director.workspace.pending)
          : false,
      composingNow:
        director.workspace.kind === "production" && "composing" in director.workspace
          ? Boolean(director.workspace.composing)
          : false,
      plannedShots:
        director.treatment && Array.isArray(director.treatment.shots)
          ? director.treatment.shots.length
          : undefined,
    }
  );

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
              generationId={director.generationId}
              onAssetClick={(a) => setModalAsset(a)}
            />
          </div>
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
              ? `Re-work ${ref} only. Do not touch other scenes. Steps: (1) call edit_video (preferred — in-place edit) OR generate_video for ${ref} with the instruction below${attachedUrls.length > 0 ? " AND reference_image_url populated with the URL listed below" : ""}, (2) then IMMEDIATELY call request_approval(stage="shots") with the full updated items list. Do not ask me for confirmation — just do both steps in one turn.\n\nInstruction: ${cleanedInstruction}${urlsHint}`
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
 * Map the 5-stage internal pipeline (treatment / plates / keyframes / shots /
 * final_cut) to the user-facing room label.
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
  if (kind === "final") return "PREMIERE";

  if (
    !flags.hasTreatment &&
    (flags.treatmentPending ||
      (kind === "working" && (stage === "write_script" || !stage)))
  ) {
    return "WRITING";
  }

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

  if (
    flags.composingNow ||
    stage === "compose_video" ||
    stage === "generate_voiceover" ||
    stage === "generate_music" ||
    stage === "generate_ambient" ||
    stage === "finish_film" ||
    stage === "final_cut"
  ) {
    return "POST";
  }

  if (kind === "production") {
    const totalRendered = flags.plateCount + flags.keyframeCount + flags.shotCount;
    if (totalRendered === 0) return "BETWEEN";
    if (stage === "plates" && flags.plateCount === 0) return "BETWEEN";
    if (stage === "keyframes" && flags.keyframeCount === 0) return "BETWEEN";
    if (stage === "shots" && flags.shotCount === 0) return "BETWEEN";
    if (stage === "plates") return "WORLD";
    if (stage === "keyframes") return "STORYBOARD";
    if (stage === "shots") return "SHOOT";
    const shotsAllRendered =
      flags.plannedShots !== undefined &&
      flags.plannedShots > 0 &&
      flags.shotCount >= flags.plannedShots;
    if (shotsAllRendered && !flags.isAgentRunning) return "CUT";
    if (flags.shotCount > 0) return "SHOOT";
    if (flags.keyframeCount > 0) return "STORYBOARD";
    return "WORLD";
  }

  return undefined;
}
