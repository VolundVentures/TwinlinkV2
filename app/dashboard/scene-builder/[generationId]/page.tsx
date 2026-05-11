"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { WorkflowCanvas } from "@/components/director/workflow-canvas";
import { AssetModal, type AssetModalInput } from "@/components/director/asset-modal";
import type {
  KeyframeAsset,
  PlateAsset,
  PlateKind,
  ScriptShot,
  ShotAsset,
} from "@/components/director/director-types";

/**
 * Scene Builder — standalone canvas view of a completed (or in-progress)
 * generation's full build graph. Shares the WorkflowCanvas component with
 * the Director workspace pane, but reads from the API rather than the SSE
 * stream so the user can browse any generation after the fact.
 */

type RawAsset = {
  id: string;
  tag: string | null;
  type: string;
  aspect_ratio: string | null;
  asset_role: string | null;
  public_url: string | null;
  parent_asset_id: string | null;
  metadata: {
    plate_kind?: string;
    description?: string;
    tag?: string;
    shot_id?: string;
    keyframe_role?: "hero" | "first_frame" | "last_frame";
    edit_instruction?: string;
    edited_from?: string;
    plate_tags?: string[];
    composition_prompt?: string;
    prompt?: string;
    mode?: string;
    duration?: string;
    plates?: unknown;
    shots?: ScriptShot[];
    title?: string;
  } | null;
};

type RawGeneration = {
  id: string;
  title: string | null;
  generation_assets: RawAsset[];
};

export default function SceneBuilderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const generationId = params.generationId as string;

  const [generation, setGeneration] = useState<RawGeneration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<AssetModalInput>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/generations/${generationId}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as { generation: RawGeneration };
        if (!cancelled) setGeneration(data.generation);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [generationId]);

  // Reshape generation_assets into the canvas-consumed shapes.
  const { plates, keyframes, shots, scriptShots, title } = useMemo(() => {
    const p: PlateAsset[] = [];
    const k: KeyframeAsset[] = [];
    const s: ShotAsset[] = [];
    let t: ScriptShot[] | undefined;
    let filmTitle = generation?.title ?? null;

    for (const a of generation?.generation_assets || []) {
      if (!a) continue;
      const meta = a.metadata || {};
      if (a.asset_role === "script" || a.type === "script") {
        t = (meta.shots as ScriptShot[] | undefined) || t;
        filmTitle = (meta.title as string | undefined) || filmTitle;
        continue;
      }
      if (!a.public_url) continue;
      if (a.asset_role === "plate" && a.type === "image") {
        p.push({
          id: a.id,
          url: a.public_url,
          tag: a.tag || meta.tag || a.id,
          plateKind: (meta.plate_kind as PlateKind) || "prop",
          description: meta.description,
          aspectRatio: a.aspect_ratio || undefined,
          parentAssetId: a.parent_asset_id || undefined,
          editedFrom: meta.edited_from,
          editInstruction: meta.edit_instruction,
        });
      } else if (a.asset_role === "keyframe" && a.type === "image") {
        k.push({
          id: a.id,
          url: a.public_url,
          tag: a.tag || meta.tag,
          shotId: meta.shot_id,
          role: meta.keyframe_role,
          prompt: meta.composition_prompt || meta.prompt,
          plateTags: meta.plate_tags,
          aspectRatio: a.aspect_ratio || undefined,
          parentAssetId: a.parent_asset_id || undefined,
          editedFrom: meta.edited_from,
          editInstruction: meta.edit_instruction,
        });
      } else if (a.asset_role === "shot" && a.type === "video") {
        s.push({
          id: a.id,
          videoUrl: a.public_url,
          prompt: meta.prompt || "",
          mode: meta.mode || "",
          durationLabel: meta.duration || "",
          aspectRatio: a.aspect_ratio || "",
          imageUrls: null,
        });
      }
    }
    return { plates: p, keyframes: k, shots: s, scriptShots: t, title: filmTitle };
  }, [generation]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
        Loading scene…
      </div>
    );
  }
  if (error || !generation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-[13px] text-neutral-700">
        <p>Couldn&apos;t load generation: {error ?? "not found"}</p>
        <Link
          href="/dashboard/scene-builder"
          className="font-mono text-[11px] uppercase tracking-[0.14em] underline"
        >
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 px-5">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/scene-builder"
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft className="h-3 w-3" /> scene builder
          </Link>
          <span className="text-neutral-300">·</span>
          <span className="font-serif text-[14px] tracking-tight text-neutral-900">
            {title || "Untitled"}
          </span>
        </div>
        <button
          onClick={() => router.push(`/dashboard/director?resume=${generationId}`)}
          className="rounded-sm border border-neutral-200 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900"
        >
          open in director →
        </button>
      </header>
      <div className="min-h-0 flex-1">
        <WorkflowCanvas
          plates={plates}
          keyframes={keyframes}
          shots={shots}
          scriptShots={scriptShots}
          onAssetClick={(a) =>
            setModal({
              kind: a.kind === "final" ? "final" : a.kind,
              url: a.url,
              ref: a.ref,
              description: a.description,
            })
          }
        />
      </div>
      <AssetModal
        asset={modal}
        onClose={() => setModal(null)}
        onRequestEdit={(ref, instruction, kind) => {
          // From Scene Builder we can't send a followup in-line — route to the
          // director with a prefilled brief so the agent picks it up from
          // there.
          const stripped = ref.startsWith("@") ? ref : `@${ref}`;
          const qs = new URLSearchParams({
            resume: generationId,
            prefill:
              kind === "shot"
                ? `Re-shoot ${ref}. ${instruction}`
                : `Edit ${stripped}: ${instruction}`,
          });
          router.push(`/dashboard/director?${qs.toString()}`);
        }}
      />
    </div>
  );
}
