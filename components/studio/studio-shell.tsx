"use client";

import { AnimatePresence, motion } from "framer-motion";
import { slideInRight } from "@/lib/motion";
import { StepIndicator } from "./step-indicator";
import { useStudio } from "./studio-context";
import { StoryPrompt } from "./steps/story-prompt";
import { ScriptTimeline } from "./steps/script-timeline";
import { StylePicker } from "./steps/style-picker";
import { CharacterGallery } from "./steps/character-gallery";
import { FrameCanvas } from "./steps/frame-canvas";
import { SceneRefinement } from "./steps/scene-refinement";
import { SoundMixer } from "./steps/sound-mixer";
import { CompositionExport } from "./steps/composition-export";

const STEP_COMPONENTS: Record<number, React.ComponentType> = {
  1: StoryPrompt,
  2: ScriptTimeline,
  3: StylePicker,
  4: CharacterGallery,
  5: FrameCanvas,
  6: SceneRefinement,
  7: SoundMixer,
  8: CompositionExport,
};

export function StudioShell() {
  const { state } = useStudio();
  const StepComponent = STEP_COMPONENTS[state.currentStep];

  return (
    <div className="flex flex-col h-full">
      {/* Step indicator bar */}
      <div className="border-b border-[rgba(22,21,20,0.06)] bg-white">
        <StepIndicator />
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={state.currentStep}
            variants={slideInRight}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="h-full"
          >
            {StepComponent && <StepComponent />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
