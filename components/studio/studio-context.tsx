"use client";

import { createContext, useContext, useReducer, type ReactNode } from "react";
import type { StudioState, StudioAction, StudioStep } from "./studio-types";

const initialState: StudioState = {
  currentStep: 1,
  projectId: null,
  brandId: "",
  storyPrompt: "",
  tone: "cinematic",
  targetPlatform: "tiktok",
  targetDuration: 30,
  scenes: [],
  totalDuration: 0,
  selectedStyle: null,
  customColorPalette: [],
  moodBoardUrls: [],
  characters: [],
  frames: [],
  audioLayers: [],
  compositionUrl: null,
  renderStatus: "idle",
  renderProgress: 0,
};

function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step };

    case "SET_BRAND":
      return { ...state, brandId: action.brandId };

    case "SET_PROJECT_ID":
      return { ...state, projectId: action.projectId };

    case "UPDATE_STORY":
      return { ...state, ...action.payload };

    case "SET_SCENES": {
      const total = action.scenes.reduce((s, sc) => s + sc.durationSeconds, 0);
      return { ...state, scenes: action.scenes, totalDuration: total };
    }

    case "UPDATE_SCENE": {
      const scenes = [...state.scenes];
      scenes[action.index] = { ...scenes[action.index], ...action.scene };
      const total = scenes.reduce((s, sc) => s + sc.durationSeconds, 0);
      return { ...state, scenes, totalDuration: total };
    }

    case "ADD_SCENE": {
      const scenes = [...state.scenes, action.scene];
      const total = scenes.reduce((s, sc) => s + sc.durationSeconds, 0);
      return { ...state, scenes, totalDuration: total };
    }

    case "REMOVE_SCENE": {
      const scenes = state.scenes.filter((_, i) => i !== action.index);
      const total = scenes.reduce((s, sc) => s + sc.durationSeconds, 0);
      return { ...state, scenes, totalDuration: total };
    }

    case "REORDER_SCENES": {
      const scenes = [...state.scenes];
      const [moved] = scenes.splice(action.fromIndex, 1);
      scenes.splice(action.toIndex, 0, moved);
      return { ...state, scenes: scenes.map((s, i) => ({ ...s, sceneNumber: i + 1 })) };
    }

    case "SET_STYLE":
      return { ...state, selectedStyle: action.styleId };

    case "SET_MOOD_BOARD":
      return { ...state, moodBoardUrls: action.urls };

    case "SET_CHARACTERS":
      return { ...state, characters: action.characters };

    case "ASSIGN_CHARACTER": {
      const characters = state.characters.map((c) =>
        c.id === action.characterId
          ? { ...c, assignedScenes: [...new Set([...c.assignedScenes, action.sceneIndex])] }
          : c
      );
      return { ...state, characters };
    }

    case "SET_FRAME": {
      const frames = [...state.frames];
      const existing = frames.find((f) => f.sceneIndex === action.sceneIndex);
      if (existing) {
        if (action.position === "first") {
          existing.firstFrame = { url: action.url, prompt: action.prompt };
        } else {
          existing.lastFrame = { url: action.url, prompt: action.prompt };
        }
      } else {
        frames.push({
          sceneIndex: action.sceneIndex,
          firstFrame: action.position === "first" ? { url: action.url, prompt: action.prompt } : null,
          lastFrame: action.position === "last" ? { url: action.url, prompt: action.prompt } : null,
        });
      }
      return { ...state, frames };
    }

    case "SET_AUDIO_LAYERS":
      return { ...state, audioLayers: action.layers };

    case "ADD_AUDIO_LAYER":
      return { ...state, audioLayers: [...state.audioLayers, action.layer] };

    case "REMOVE_AUDIO_LAYER":
      return { ...state, audioLayers: state.audioLayers.filter((l) => l.id !== action.id) };

    case "UPDATE_AUDIO_LAYER":
      return {
        ...state,
        audioLayers: state.audioLayers.map((l) =>
          l.id === action.id ? { ...l, ...action.updates } : l
        ),
      };

    case "SET_RENDER_STATUS":
      return {
        ...state,
        renderStatus: action.status,
        renderProgress: action.progress ?? state.renderProgress,
        compositionUrl: action.url ?? state.compositionUrl,
      };

    case "RESET":
      return { ...initialState };

    default:
      return state;
  }
}

const StudioContext = createContext<{
  state: StudioState;
  dispatch: React.Dispatch<StudioAction>;
} | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(studioReducer, initialState);
  return (
    <StudioContext.Provider value={{ state, dispatch }}>
      {children}
    </StudioContext.Provider>
  );
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
}
