"use client";

import { useState } from "react";
import { motion, Reorder } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Clock,
  Film,
  MessageSquare,
  Eye,
} from "lucide-react";
import { useStudio } from "../studio-context";
import { staggerContainer, staggerItem, spring } from "@/lib/motion";
import type { ScriptScene } from "../studio-types";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SceneCard({
  scene,
  index,
  timeOffset,
  onUpdate,
  onDelete,
}: {
  scene: ScriptScene;
  index: number;
  timeOffset: number;
  onUpdate: (updates: Partial<ScriptScene>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Reorder.Item value={scene} id={scene.id}>
      <motion.div
        layout
        className="bg-white border border-[rgba(22,21,20,0.08)] rounded-lg overflow-hidden group"
      >
        {/* Scene header */}
        <div className="flex items-center gap-3 px-4 py-3">
          <GripVertical className="h-4 w-4 text-[#d4d4d4] cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-[#161514] text-white text-[11px] font-semibold shrink-0">
            {index + 1}
          </div>

          <div className="flex-1 min-w-0">
            <input
              value={scene.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              className="text-[14px] font-medium text-[#161514] bg-transparent outline-none w-full"
              placeholder="Scene title..."
            />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="mono text-[11px] text-[#a3a3a3]">
              {formatTime(timeOffset)} – {formatTime(timeOffset + scene.durationSeconds)}
            </span>

            <div className="flex items-center gap-1 border border-[rgba(22,21,20,0.10)] rounded px-2 py-1">
              <Clock className="h-3 w-3 text-[#a3a3a3]" />
              <input
                type="number"
                value={scene.durationSeconds}
                onChange={(e) => onUpdate({ durationSeconds: Math.max(1, parseInt(e.target.value) || 5) })}
                className="w-8 text-[11px] mono text-[#161514] bg-transparent outline-none text-center"
                min={1}
                max={120}
              />
              <span className="text-[10px] text-[#a3a3a3]">s</span>
            </div>

            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[#a3a3a3] hover:text-[#161514] transition-colors"
            >
              <Eye className="h-4 w-4" />
            </button>

            <button
              onClick={onDelete}
              className="text-[#a3a3a3] hover:text-[#ba1a1a] transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring.smooth}
            className="border-t border-[rgba(22,21,20,0.06)] px-4 py-4 space-y-4"
          >
            {/* Description */}
            <div>
              <label className="label-caps text-[10px] mb-1.5 flex items-center gap-1.5">
                <Film className="h-3 w-3" /> Visual Direction
              </label>
              <textarea
                value={scene.visualDirection}
                onChange={(e) => onUpdate({ visualDirection: e.target.value })}
                rows={2}
                className="w-full bg-[#FAF8F5] border border-[rgba(22,21,20,0.06)] rounded px-3 py-2 text-[13px] text-[#161514] placeholder:text-[#a3a3a3] resize-none outline-none"
                placeholder="Camera angle, movement, lighting, composition..."
              />
            </div>

            {/* Dialog */}
            <div>
              <label className="label-caps text-[10px] mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" /> Dialog / Voiceover
              </label>
              <textarea
                value={scene.dialog}
                onChange={(e) => onUpdate({ dialog: e.target.value })}
                rows={2}
                className="w-full bg-[#FAF8F5] border border-[rgba(22,21,20,0.06)] rounded px-3 py-2 text-[13px] text-[#161514] placeholder:text-[#a3a3a3] resize-none outline-none"
                placeholder="What is said or narrated during this scene..."
              />
            </div>

            {/* Transition */}
            <div>
              <label className="label-caps text-[10px] mb-1.5">Transition Out</label>
              <div className="flex gap-1.5">
                {(["cut", "crossfade", "dissolve", "fade_to_black"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => onUpdate({ transition: t })}
                    className={cn(
                      "px-3 py-1.5 rounded text-[11px] border transition-all",
                      scene.transition === t
                        ? "border-[#161514] bg-[#161514] text-white"
                        : "border-[rgba(22,21,20,0.10)] text-[#737373] hover:border-[#161514]/30"
                    )}
                  >
                    {t.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </Reorder.Item>
  );
}

export function ScriptTimeline() {
  const { state, dispatch } = useStudio();
  const scenes = state.scenes;

  function handleReorder(newOrder: ScriptScene[]) {
    dispatch({ type: "SET_SCENES", scenes: newOrder });
  }

  function addScene() {
    const id = `scene-${Date.now()}`;
    dispatch({
      type: "ADD_SCENE",
      scene: {
        id,
        sceneNumber: scenes.length + 1,
        title: `Scene ${scenes.length + 1}`,
        description: "",
        dialog: "",
        visualDirection: "",
        durationSeconds: 5,
        transition: "crossfade",
      },
    });
  }

  // Calculate time offsets
  const timeOffsets = scenes.reduce<number[]>((acc, scene, i) => {
    if (i === 0) return [0];
    return [...acc, acc[i - 1] + scenes[i - 1].durationSeconds];
  }, [0]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <motion.div variants={staggerContainer} initial="hidden" animate="visible">
        {/* Header */}
        <motion.div variants={staggerItem} className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-headline-sm text-[#161514]">Script Timeline</h2>
            <p className="text-[13px] text-[#737373] mt-1">
              {scenes.length} scenes &middot; {formatTime(state.totalDuration)} total
            </p>
          </div>
          <button
            onClick={addScene}
            className="flex items-center gap-2 px-4 py-2 border border-[rgba(22,21,20,0.10)] rounded-lg text-[12px] text-[#161514] hover:bg-[#F3F0EB] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Scene
          </button>
        </motion.div>

        {/* Timeline */}
        <motion.div variants={staggerItem}>
          {scenes.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-[rgba(22,21,20,0.10)] rounded-lg">
              <p className="text-[#a3a3a3] text-[14px]">No scenes yet. The AI will generate them from your story, or add manually.</p>
              <button
                onClick={addScene}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#161514] text-white rounded-lg text-[12px] font-medium"
              >
                <Plus className="h-3.5 w-3.5" /> Add First Scene
              </button>
            </div>
          ) : (
            <Reorder.Group axis="y" values={scenes} onReorder={handleReorder} className="space-y-2">
              {scenes.map((scene, i) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  index={i}
                  timeOffset={timeOffsets[i] || 0}
                  onUpdate={(updates) => dispatch({ type: "UPDATE_SCENE", index: i, scene: updates })}
                  onDelete={() => dispatch({ type: "REMOVE_SCENE", index: i })}
                />
              ))}
            </Reorder.Group>
          )}
        </motion.div>

        {/* Timeline bar */}
        {scenes.length > 0 && (
          <motion.div variants={staggerItem} className="mt-6 bg-[#F3F0EB] rounded-lg p-4">
            <div className="flex items-center h-8 rounded-md overflow-hidden">
              {scenes.map((scene, i) => {
                const widthPercent = (scene.durationSeconds / state.totalDuration) * 100;
                return (
                  <div
                    key={scene.id}
                    style={{ width: `${widthPercent}%` }}
                    className={cn(
                      "h-full flex items-center justify-center text-[10px] font-medium border-r border-white/50 last:border-r-0",
                      i % 2 === 0 ? "bg-[#161514] text-white" : "bg-[#4D5D4B] text-white"
                    )}
                  >
                    {widthPercent > 8 && <span>S{i + 1}</span>}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2">
              <span className="mono text-[10px] text-[#a3a3a3]">0:00</span>
              <span className="mono text-[10px] text-[#a3a3a3]">{formatTime(state.totalDuration)}</span>
            </div>
          </motion.div>
        )}

        {/* Navigation */}
        <motion.div variants={staggerItem} className="flex items-center justify-between mt-8">
          <button
            onClick={() => dispatch({ type: "SET_STEP", step: 1 })}
            className="flex items-center gap-2 px-5 py-2.5 border border-[rgba(22,21,20,0.10)] rounded-lg text-[13px] text-[#737373] hover:text-[#161514] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={() => dispatch({ type: "SET_STEP", step: 3 })}
            disabled={scenes.length === 0}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-lg text-[13px] font-medium transition-all",
              scenes.length > 0
                ? "bg-[#161514] text-white hover:bg-[#2a2928]"
                : "bg-[#F3F0EB] text-[#a3a3a3] cursor-not-allowed"
            )}
          >
            Choose Style <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
