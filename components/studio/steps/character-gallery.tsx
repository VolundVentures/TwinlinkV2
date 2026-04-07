"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Plus, User, Check } from "lucide-react";
import { useStudio } from "../studio-context";
import { staggerContainer, staggerItem, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Character = {
  id: string;
  name: string;
  thumbnailUrl: string;
  gender: string;
  style: string;
};

// Default characters — will be augmented with API data
const DEFAULT_CHARACTERS: Character[] = [
  { id: "char-1", name: "Amira", thumbnailUrl: "", gender: "Female", style: "Professional" },
  { id: "char-2", name: "Omar", thumbnailUrl: "", gender: "Male", style: "Casual" },
  { id: "char-3", name: "Sarah", thumbnailUrl: "", gender: "Female", style: "Friendly" },
  { id: "char-4", name: "James", thumbnailUrl: "", gender: "Male", style: "Corporate" },
];

export function CharacterGallery() {
  const { state, dispatch } = useStudio();
  const [characters] = useState<Character[]>(DEFAULT_CHARACTERS);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(state.characters.map((c) => c.id))
  );
  const [promptInput, setPromptInput] = useState("");

  function toggleCharacter(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  }

  function handleContinue() {
    const studioChars = characters
      .filter((c) => selected.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        thumbnailUrl: c.thumbnailUrl,
        assignedScenes: [],
      }));
    dispatch({ type: "SET_CHARACTERS", characters: studioChars });
    dispatch({ type: "SET_STEP", step: 5 });
  }

  const hasScenes = state.scenes.length > 0;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <motion.div variants={staggerContainer} initial="hidden" animate="visible">
        {/* Header */}
        <motion.div variants={staggerItem} className="mb-8">
          <h2 className="text-headline-sm text-[#161514]">Cast & Characters</h2>
          <p className="text-[13px] text-[#737373] mt-1">
            Select characters for your video or skip if using B-roll only.
          </p>
        </motion.div>

        {/* Character grid */}
        <motion.div variants={staggerItem} className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {characters.map((char) => {
            const isSelected = selected.has(char.id);
            return (
              <motion.button
                key={char.id}
                onClick={() => toggleCharacter(char.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={spring.snappy}
                className={cn(
                  "relative flex flex-col items-center text-center rounded-xl border p-5 transition-all",
                  isSelected
                    ? "border-[#161514] bg-[#161514] text-white"
                    : "border-[rgba(22,21,20,0.08)] bg-white text-[#161514] hover:border-[rgba(22,21,20,0.20)]"
                )}
              >
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-3 right-3"
                  >
                    <Check className="h-4 w-4" />
                  </motion.div>
                )}

                <div className={cn(
                  "flex items-center justify-center h-16 w-16 rounded-full mb-3 text-xl font-bold",
                  isSelected ? "bg-white/10 text-white" : "bg-[#F3F0EB] text-[#161514]"
                )}>
                  {char.thumbnailUrl ? (
                    <img src={char.thumbnailUrl} alt={char.name} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    char.name[0]
                  )}
                </div>

                <span className="text-[14px] font-medium">{char.name}</span>
                <span className={cn("text-[11px] mt-0.5", isSelected ? "text-white/60" : "text-[#a3a3a3]")}>
                  {char.gender} &middot; {char.style}
                </span>
              </motion.button>
            );
          })}

          {/* Create new character card */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[rgba(22,21,20,0.15)] p-5 text-center">
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-[#F3F0EB] mb-3">
              <Plus className="h-6 w-6 text-[#737373]" />
            </div>
            <span className="text-[13px] font-medium text-[#737373]">Create New</span>
            <p className="text-[10px] text-[#a3a3a3] mt-1">AI-generated character</p>
          </div>
        </motion.div>

        {/* Scene assignment (if characters selected + scenes exist) */}
        {selected.size > 0 && hasScenes && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.smooth}
            className="mb-8 p-5 bg-white border border-[rgba(22,21,20,0.08)] rounded-lg"
          >
            <p className="label-caps text-[10px] mb-3">Assign to Scenes</p>
            <div className="space-y-2">
              {state.scenes.map((scene, i) => (
                <div key={scene.id} className="flex items-center gap-3 py-2">
                  <span className="mono text-[11px] text-[#a3a3a3] w-12">S{i + 1}</span>
                  <span className="text-[13px] text-[#161514] flex-1">{scene.title}</span>
                  <div className="flex gap-1">
                    {characters
                      .filter((c) => selected.has(c.id))
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => dispatch({ type: "ASSIGN_CHARACTER", characterId: c.id, sceneIndex: i })}
                          className={cn(
                            "h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all",
                            state.characters.find((sc) => sc.id === c.id)?.assignedScenes.includes(i)
                              ? "bg-[#161514] text-white border-[#161514]"
                              : "bg-white text-[#737373] border-[rgba(22,21,20,0.15)] hover:border-[#161514]"
                          )}
                        >
                          {c.name[0]}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Navigation */}
        <motion.div variants={staggerItem} className="flex items-center justify-between">
          <button
            onClick={() => dispatch({ type: "SET_STEP", step: 3 })}
            className="flex items-center gap-2 px-5 py-2.5 border border-[rgba(22,21,20,0.10)] rounded-lg text-[13px] text-[#737373] hover:text-[#161514] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Style
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                dispatch({ type: "SET_CHARACTERS", characters: [] });
                dispatch({ type: "SET_STEP", step: 5 });
              }}
              className="text-[13px] text-[#a3a3a3] hover:text-[#161514] transition-colors"
            >
              Skip (B-roll only)
            </button>
            <button
              onClick={handleContinue}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#161514] text-white rounded-lg text-[13px] font-medium hover:bg-[#2a2928] transition-colors"
            >
              Frames <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
