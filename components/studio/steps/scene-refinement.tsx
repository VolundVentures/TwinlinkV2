"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Play, Settings2, Volume2 } from "lucide-react";
import { useStudio } from "../studio-context";
import { staggerContainer, staggerItem, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function SceneRefinement() {
  const { state, dispatch } = useStudio();
  const [activeScene, setActiveScene] = useState(0);

  const scene = state.scenes[activeScene];
  const frame = state.frames.find((f) => f.sceneIndex === activeScene);

  if (!scene) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#a3a3a3]">No scenes to refine. Go back and create a script first.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left: Scene list */}
      <div className="w-64 border-r border-[rgba(22,21,20,0.06)] bg-white overflow-y-auto">
        <div className="p-4">
          <p className="label-caps text-[10px] mb-3">Scenes</p>
          {state.scenes.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveScene(i)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all mb-1",
                activeScene === i
                  ? "bg-[#161514] text-white"
                  : "text-[#737373] hover:bg-[#F3F0EB]"
              )}
            >
              <span className={cn(
                "flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-semibold shrink-0",
                activeScene === i ? "bg-white/20 text-white" : "bg-[#F3F0EB] text-[#161514]"
              )}>
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-medium truncate">{s.title}</p>
                <p className={cn("text-[10px] mono", activeScene === i ? "text-white/50" : "text-[#a3a3a3]")}>
                  {s.durationSeconds}s
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Scene detail */}
      <div className="flex-1 overflow-y-auto p-8">
        <motion.div
          key={activeScene}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={spring.smooth}
        >
          {/* Preview area */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="aspect-video bg-black rounded-xl overflow-hidden relative group">
              {frame?.firstFrame ? (
                <img src={frame.firstFrame.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-white/30 text-[13px]">First Frame</div>
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                <Play className="h-8 w-8 text-white" fill="white" />
              </div>
              <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 text-white text-[10px] rounded mono">START</span>
            </div>
            <div className="aspect-video bg-black rounded-xl overflow-hidden relative">
              {frame?.lastFrame ? (
                <img src={frame.lastFrame.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-white/30 text-[13px]">Last Frame</div>
              )}
              <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 text-white text-[10px] rounded mono">END</span>
            </div>
          </div>

          {/* Scene details */}
          <div className="space-y-6">
            <div>
              <label className="label-caps text-[10px] mb-2 block">Scene Title</label>
              <input
                value={scene.title}
                onChange={(e) => dispatch({ type: "UPDATE_SCENE", index: activeScene, scene: { title: e.target.value } })}
                className="w-full bg-white border border-[rgba(22,21,20,0.10)] rounded-lg px-4 py-3 text-[14px] text-[#161514] outline-none focus:border-[#161514]"
              />
            </div>

            <div>
              <label className="label-caps text-[10px] mb-2 flex items-center gap-1.5">
                <Settings2 className="h-3 w-3" /> Visual Direction
              </label>
              <textarea
                value={scene.visualDirection}
                onChange={(e) => dispatch({ type: "UPDATE_SCENE", index: activeScene, scene: { visualDirection: e.target.value } })}
                rows={3}
                className="w-full bg-white border border-[rgba(22,21,20,0.10)] rounded-lg px-4 py-3 text-[13px] text-[#161514] placeholder:text-[#a3a3a3] resize-none outline-none focus:border-[#161514]"
                placeholder="Camera angles, movement, lighting, composition..."
              />
            </div>

            <div>
              <label className="label-caps text-[10px] mb-2 flex items-center gap-1.5">
                <Volume2 className="h-3 w-3" /> Dialog / Voiceover
              </label>
              <textarea
                value={scene.dialog}
                onChange={(e) => dispatch({ type: "UPDATE_SCENE", index: activeScene, scene: { dialog: e.target.value } })}
                rows={3}
                className="w-full bg-white border border-[rgba(22,21,20,0.10)] rounded-lg px-4 py-3 text-[13px] text-[#161514] placeholder:text-[#a3a3a3] resize-none outline-none focus:border-[#161514]"
                placeholder="What is spoken during this scene..."
              />
            </div>

            <div className="flex gap-6">
              <div className="flex-1">
                <label className="label-caps text-[10px] mb-2 block">Duration (seconds)</label>
                <input
                  type="number"
                  value={scene.durationSeconds}
                  onChange={(e) => dispatch({ type: "UPDATE_SCENE", index: activeScene, scene: { durationSeconds: Math.max(1, parseInt(e.target.value) || 5) } })}
                  className="w-full bg-white border border-[rgba(22,21,20,0.10)] rounded-lg px-4 py-3 text-[14px] mono text-[#161514] outline-none focus:border-[#161514]"
                  min={1}
                  max={120}
                />
              </div>
              <div className="flex-1">
                <label className="label-caps text-[10px] mb-2 block">Transition Out</label>
                <select
                  value={scene.transition}
                  onChange={(e) => dispatch({ type: "UPDATE_SCENE", index: activeScene, scene: { transition: e.target.value as ScriptScene["transition"] } })}
                  className="w-full bg-white border border-[rgba(22,21,20,0.10)] rounded-lg px-4 py-3 text-[13px] text-[#161514] outline-none focus:border-[#161514]"
                >
                  <option value="cut">Cut</option>
                  <option value="crossfade">Crossfade</option>
                  <option value="dissolve">Dissolve</option>
                  <option value="fade_to_black">Fade to Black</option>
                </select>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-10">
          <button
            onClick={() => dispatch({ type: "SET_STEP", step: 5 })}
            className="flex items-center gap-2 px-5 py-2.5 border border-[rgba(22,21,20,0.10)] rounded-lg text-[13px] text-[#737373] hover:text-[#161514] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Frames
          </button>
          <button
            onClick={() => dispatch({ type: "SET_STEP", step: 7 })}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#161514] text-white rounded-lg text-[13px] font-medium hover:bg-[#2a2928] transition-colors"
          >
            Sound Design <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Import for the select type
import type { ScriptScene } from "../studio-types";
