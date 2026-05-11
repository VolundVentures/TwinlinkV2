"use client";

import { useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { Play, ImageIcon, Wand2, Layers, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  KeyframeAsset,
  PlateAsset,
  PlateKind,
  ScriptShot,
  ShotAsset,
  ShotBuildStep,
} from "./director-types";

/**
 * WorkflowCanvas — a node graph of the film's build.
 *
 * What it shows:
 *   • Plates (character / location / prop / ...) as root-ish nodes.
 *   • Edit-produced plates/keyframes as chained nodes (via parentAssetId).
 *   • Keyframes as per-shot compose nodes.
 *   • Shot videos as leaf nodes.
 *   • Planned shot_build steps (from the script) that haven't rendered yet,
 *     drawn as ghost nodes so the user sees the intended chain.
 *
 * Layout: dagre LR (left-to-right hierarchical). Each shot is effectively its
 * own horizontal band because edges flow plate → edits → keyframe → shot.
 *
 * Interaction: click any node to open it in the AssetModal via onAssetClick.
 * The modal already supports "Request edit" which routes back to the agent.
 */

export type WorkflowAssetClick = {
  kind: "plate" | "keyframe" | "shot" | "final";
  url: string;
  ref?: string;
  description?: string;
};

type NodeKind = "plate" | "edit" | "keyframe" | "shot" | "planned";

type WorkflowNodeData = {
  kind: NodeKind;
  title: string;
  subtitle?: string;
  url?: string;
  videoUrl?: string;
  plateKind?: PlateKind | string;
  shotLabel?: string;
  ref?: string;
  ghost?: boolean;
  onOpen?: (click: WorkflowAssetClick) => void;
};

const NODE_WIDTH = 180;
const NODE_HEIGHT = 160;

export function WorkflowCanvas({
  plates,
  keyframes,
  shots,
  scriptShots,
  onAssetClick,
  className,
}: {
  plates: PlateAsset[];
  keyframes: KeyframeAsset[];
  shots: ShotAsset[];
  /** From the treatment — drives planned (ghost) shot_build steps and shot labels. */
  scriptShots?: ScriptShot[];
  onAssetClick: (click: WorkflowAssetClick) => void;
  className?: string;
}) {
  const { nodes, edges } = useMemo(
    () =>
      buildGraph({ plates, keyframes, shots, scriptShots, onAssetClick }),
    [plates, keyframes, shots, scriptShots, onAssetClick]
  );

  const isEmpty = nodes.length === 0;

  if (isEmpty) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center gap-2 bg-neutral-50",
          className
        )}
      >
        <Layers className="h-5 w-5 text-neutral-300" />
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
          Canvas will populate as plates, keyframes, and shots render.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("h-full w-full bg-[#FAFAFA]", className)}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          proOptions={{ hideAttribution: true }}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          minZoom={0.2}
          maxZoom={1.5}
        >
          <Background color="#E5E5E5" gap={24} size={1} />
          <MiniMap
            nodeColor={(n) => {
              const d = n.data as WorkflowNodeData;
              if (d?.kind === "plate") return "#6B7280";
              if (d?.kind === "edit") return "#F59E0B";
              if (d?.kind === "keyframe") return "#1F2937";
              if (d?.kind === "shot") return "#111827";
              return "#D4D4D4";
            }}
            pannable
            zoomable
          />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}

/* ------------------------------------------------
   Graph construction
   ------------------------------------------------ */

type BuildInput = {
  plates: PlateAsset[];
  keyframes: KeyframeAsset[];
  shots: ShotAsset[];
  scriptShots?: ScriptShot[];
  onAssetClick: (click: WorkflowAssetClick) => void;
};

function buildGraph(input: BuildInput): {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
} {
  const { plates, keyframes, shots, scriptShots, onAssetClick } = input;

  const nodes: Node<WorkflowNodeData>[] = [];
  const edges: Edge[] = [];
  const edgeSeen = new Set<string>();
  const pushEdge = (from: string, to: string, kind: "plate" | "edit" | "shot" = "plate") => {
    const k = `${from}→${to}`;
    if (edgeSeen.has(k)) return;
    edgeSeen.add(k);
    edges.push({
      id: k,
      source: from,
      target: to,
      type: "smoothstep",
      animated: kind === "edit",
      style: {
        stroke:
          kind === "edit" ? "#F59E0B" : kind === "shot" ? "#111827" : "#A3A3A3",
        strokeWidth: 1.5,
      },
    });
  };

  const plateById = new Map<string, PlateAsset>();
  const plateByTag = new Map<string, PlateAsset>();
  for (const p of plates) {
    plateById.set(p.id, p);
    if (p.tag) plateByTag.set(p.tag, p);
  }
  const keyframeById = new Map<string, KeyframeAsset>();
  const keyframeByTag = new Map<string, KeyframeAsset>();
  for (const k of keyframes) {
    keyframeById.set(k.id, k);
    if (k.tag) keyframeByTag.set(k.tag, k);
  }

  // ---- 1. Plate nodes ----
  for (const p of plates) {
    const isEdit = Boolean(p.parentAssetId || p.editInstruction);
    nodes.push({
      id: nodeIdPlate(p.id),
      type: "workflowNode",
      data: {
        kind: isEdit ? "edit" : "plate",
        title: `@${p.tag}`,
        subtitle: isEdit
          ? p.editInstruction || `edit of @${p.editedFrom || ""}`
          : p.plateKind.replace(/_/g, " "),
        url: p.url,
        plateKind: p.plateKind,
        ref: p.tag,
        onOpen: () =>
          onAssetClick({ kind: "plate", url: p.url, ref: `@${p.tag}`, description: p.description }),
      },
      position: { x: 0, y: 0 }, // dagre overwrites
    });
    if (p.parentAssetId && plateById.has(p.parentAssetId)) {
      pushEdge(nodeIdPlate(p.parentAssetId), nodeIdPlate(p.id), "edit");
    } else if (p.editedFrom && plateByTag.has(p.editedFrom)) {
      pushEdge(
        nodeIdPlate(plateByTag.get(p.editedFrom)!.id),
        nodeIdPlate(p.id),
        "edit"
      );
    }
  }

  // ---- 2. Keyframe nodes ----
  for (const k of keyframes) {
    const isEdit = Boolean(k.parentAssetId || k.editInstruction);
    nodes.push({
      id: nodeIdKeyframe(k.id),
      type: "workflowNode",
      data: {
        kind: isEdit ? "edit" : "keyframe",
        title: k.tag ? `@${k.tag}` : "keyframe",
        subtitle: isEdit
          ? k.editInstruction || "edit"
          : k.role
            ? `compose · ${k.role.replace("_", " ")}`
            : "keyframe",
        url: k.url,
        shotLabel: k.shotId || undefined,
        ref: k.tag,
        onOpen: () =>
          onAssetClick({
            kind: "keyframe",
            url: k.url,
            ref: k.tag ? `@${k.tag}` : undefined,
            description: k.prompt,
          }),
      },
      position: { x: 0, y: 0 },
    });
    // Plate → keyframe edges from plateTags (subject, location, props, ...)
    if (k.plateTags && !isEdit) {
      for (const tag of k.plateTags) {
        const src = plateByTag.get(tag);
        if (src) pushEdge(nodeIdPlate(src.id), nodeIdKeyframe(k.id));
      }
    }
    // Parent lineage (edit_plate on a keyframe tag)
    if (k.parentAssetId) {
      if (keyframeById.has(k.parentAssetId))
        pushEdge(nodeIdKeyframe(k.parentAssetId), nodeIdKeyframe(k.id), "edit");
      else if (plateById.has(k.parentAssetId))
        pushEdge(nodeIdPlate(k.parentAssetId), nodeIdKeyframe(k.id), "edit");
    } else if (k.editedFrom) {
      const srcK = keyframeByTag.get(k.editedFrom);
      if (srcK) pushEdge(nodeIdKeyframe(srcK.id), nodeIdKeyframe(k.id), "edit");
      else {
        const srcP = plateByTag.get(k.editedFrom);
        if (srcP) pushEdge(nodeIdPlate(srcP.id), nodeIdKeyframe(k.id), "edit");
      }
    }
  }

  // ---- 3. Shot video nodes ----
  // Match shots to keyframes by shotId — ShotAsset doesn't carry shot_id
  // directly but the metadata/prompt sometimes does. When we have scriptShots,
  // we can also align by order. The existing ShotAsset shape only has
  // imageUrls which we ignore here; we infer the link via a lookup table.
  // Fallback: render shots in their own lane tied to the most recent keyframe
  // produced before them (by time of arrival).
  const shotKeyframeMap = new Map<string, string>(); // shotAssetId → keyframeNodeId
  if (scriptShots) {
    for (const sh of scriptShots) {
      const kf = keyframes.find(
        (k) => k.shotId === sh.id && (k.role === "hero" || k.role === "first_frame")
      );
      // We'll resolve later when we iterate shots; here we just prep the map
      // via shot.id — which is not the same as ShotAsset.id. The UI treats
      // ShotAsset arrays in insertion order; best-effort linking happens in
      // the shot loop below.
      if (kf) shotKeyframeMap.set(sh.id, nodeIdKeyframe(kf.id));
    }
  }

  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    const sh = scriptShots?.[i];
    nodes.push({
      id: nodeIdShot(s.id),
      type: "workflowNode",
      data: {
        kind: "shot",
        title: sh ? sh.id : `shot ${i + 1}`,
        subtitle: sh?.label || s.prompt.slice(0, 48),
        videoUrl: s.videoUrl,
        shotLabel: sh?.label,
        ref: sh?.id,
        onOpen: () =>
          onAssetClick({
            kind: "shot",
            url: s.videoUrl,
            ref: sh?.id,
            description: s.prompt,
          }),
      },
      position: { x: 0, y: 0 },
    });
    const upstreamKf = sh ? shotKeyframeMap.get(sh.id) : undefined;
    if (upstreamKf) pushEdge(upstreamKf, nodeIdShot(s.id), "shot");
  }

  // ---- 4. Planned (ghost) nodes for shot_build steps not yet rendered ----
  if (scriptShots) {
    for (const sh of scriptShots) {
      if (!sh.shot_build || sh.shot_build.length === 0) continue;
      const plannedChain: string[] = [];
      for (let idx = 0; idx < sh.shot_build.length; idx++) {
        const step = sh.shot_build[idx];
        const plannedId = plannedNodeId(sh.id, idx);
        const isRendered = resolvePlannedStepRendered(step, plateByTag, keyframeByTag, keyframes, sh);
        if (isRendered.rendered) continue; // skip; the real node already exists and edges will carry
        const title = plannedStepTitle(step);
        nodes.push({
          id: plannedId,
          type: "workflowNode",
          data: {
            kind: "planned",
            title,
            subtitle: plannedStepSubtitle(step),
            ghost: true,
            ref: sh.id,
            shotLabel: sh.label,
          },
          position: { x: 0, y: 0 },
        });
        plannedChain.push(plannedId);
        if (plannedChain.length > 1) {
          pushEdge(
            plannedChain[plannedChain.length - 2],
            plannedId,
            step.kind === "edit_plate" ? "edit" : "plate"
          );
        }
      }
    }
  }

  // ---- 5. Auto-layout with dagre ----
  laidOut(nodes, edges);

  return { nodes, edges };
}

function laidOut(nodes: Node<WorkflowNodeData>[], edges: Edge[]): void {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 30, ranksep: 60, marginx: 20, marginy: 20 });
  for (const n of nodes)
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  for (const n of nodes) {
    const pos = g.node(n.id);
    if (pos) {
      n.position = {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      };
    }
  }
}

/* ------------------------------------------------
   Planned-step helpers
   ------------------------------------------------ */

function resolvePlannedStepRendered(
  step: ShotBuildStep,
  plateByTag: Map<string, PlateAsset>,
  keyframeByTag: Map<string, KeyframeAsset>,
  keyframes: KeyframeAsset[],
  sh: ScriptShot
): { rendered: boolean } {
  if (step.kind === "generate_plate") {
    return { rendered: plateByTag.has(step.tag) };
  }
  if (step.kind === "edit_plate") {
    const targetTag = step.new_tag || step.target_tag;
    return { rendered: plateByTag.has(targetTag) || keyframeByTag.has(targetTag) };
  }
  if (step.kind === "compose_keyframe") {
    const match = keyframes.find((k) => k.shotId === sh.id && k.role === step.role);
    return { rendered: Boolean(match) };
  }
  return { rendered: false };
}

function plannedStepTitle(step: ShotBuildStep): string {
  if (step.kind === "generate_plate") return `gen @${step.tag}`;
  if (step.kind === "edit_plate")
    return step.new_tag ? `edit → @${step.new_tag}` : `edit @${step.target_tag}`;
  return `compose · ${step.role.replace("_", " ")}`;
}

function plannedStepSubtitle(step: ShotBuildStep): string {
  if (step.kind === "generate_plate") return step.description;
  if (step.kind === "edit_plate") return step.edit_instruction;
  return "pending";
}

function plannedNodeId(shotId: string, idx: number): string {
  return `planned:${shotId}:${idx}`;
}

function nodeIdPlate(id: string): string {
  return `plate:${id}`;
}
function nodeIdKeyframe(id: string): string {
  return `keyframe:${id}`;
}
function nodeIdShot(id: string): string {
  return `shot:${id}`;
}

/* ------------------------------------------------
   Custom node
   ------------------------------------------------ */

const NODE_TYPES = {
  workflowNode: WorkflowNode,
};

function WorkflowNode({ data }: NodeProps<Node<WorkflowNodeData>>) {
  const { kind, title, subtitle, url, videoUrl, ghost, onOpen } = data;
  const Icon =
    kind === "plate"
      ? ImageIcon
      : kind === "edit"
        ? Wand2
        : kind === "keyframe"
          ? Layers
          : kind === "shot"
            ? Film
            : ImageIcon;
  const accent =
    kind === "plate"
      ? "border-neutral-300 bg-white"
      : kind === "edit"
        ? "border-amber-300 bg-amber-50/40"
        : kind === "keyframe"
          ? "border-neutral-800 bg-white"
          : kind === "shot"
            ? "border-neutral-900 bg-neutral-900 text-white"
            : "border-dashed border-neutral-300 bg-white/60";

  return (
    <div
      className={cn(
        "group relative flex w-[180px] overflow-hidden rounded-sm border shadow-sm transition-all",
        accent,
        ghost ? "opacity-55" : "hover:shadow-md"
      )}
      style={{ height: NODE_HEIGHT }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "#a3a3a3", width: 6, height: 6 }}
      />
      <div className="flex w-full flex-col">
        <button
          onClick={() =>
            onOpen?.({
              kind: kind === "edit" ? "plate" : (kind as "plate" | "keyframe" | "shot"),
              url: url || videoUrl || "",
            })
          }
          disabled={!url && !videoUrl}
          className="relative flex h-[90px] w-full items-center justify-center overflow-hidden bg-neutral-100"
        >
          {videoUrl ? (
            <>
              <video src={videoUrl} muted playsInline className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                <Play className="h-5 w-5 text-white" />
              </div>
            </>
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={title} className="h-full w-full object-cover" />
          ) : (
            <Icon className="h-4 w-4 text-neutral-300" />
          )}
        </button>
        <div className="flex min-h-0 flex-1 flex-col justify-between px-2 py-1.5">
          <div className="truncate font-mono text-[12px] uppercase tracking-[0.16em]">
            {title}
          </div>
          {subtitle && (
            <div
              className={cn(
                "line-clamp-2 text-[10px] leading-tight",
                kind === "shot" ? "text-neutral-300" : "text-neutral-500"
              )}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "#a3a3a3", width: 6, height: 6 }}
      />
    </div>
  );
}
