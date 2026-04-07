/**
 * TwinLink Studio — Type definitions for the 8-step video production pipeline.
 */

export type StudioStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const STUDIO_STEPS = [
  { step: 1 as const, label: "Story", description: "Describe your vision" },
  { step: 2 as const, label: "Script", description: "Structure your narrative" },
  { step: 3 as const, label: "Style", description: "Set artistic direction" },
  { step: 4 as const, label: "Characters", description: "Design your cast" },
  { step: 5 as const, label: "Frames", description: "Visualize each scene" },
  { step: 6 as const, label: "Scenes", description: "Refine the details" },
  { step: 7 as const, label: "Sound", description: "Design the audio" },
  { step: 8 as const, label: "Export", description: "Render & publish" },
] as const;

export type ScriptScene = {
  id: string;
  sceneNumber: number;
  title: string;
  description: string;
  dialog: string;
  visualDirection: string;
  durationSeconds: number;
  transition: "cut" | "crossfade" | "dissolve" | "fade_to_black" | "wipe";
};

export type StylePreset = {
  id: string;
  name: string;
  description: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  colorPalette: string[];
  promptAnchors: string[];
  bestFor: string[];
};

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "cinematic",
    name: "Cinematic",
    description: "Teal & orange color grade, shallow depth of field, anamorphic lens flares. Epic, premium feel.",
    imageUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=300&fit=crop",
    colorPalette: ["#1a3a4a", "#e87d3e", "#f5f0e8", "#0d1b2a"],
    promptAnchors: ["cinematic color grading", "teal and orange", "anamorphic lens", "shallow DOF", "film grain"],
    bestFor: ["automotive", "luxury", "spirits", "tech"],
  },
  {
    id: "editorial",
    name: "Editorial Minimal",
    description: "Clean backgrounds, generous whitespace, serif headlines. Kinfolk magazine aesthetic.",
    imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop",
    colorPalette: ["#f5f0e8", "#d4c5b0", "#161514", "#8a7e6b"],
    promptAnchors: ["editorial flat lay", "marble surface", "Kinfolk magazine", "generous whitespace", "muted palette"],
    bestFor: ["luxury", "skincare", "fashion", "home"],
  },
  {
    id: "ugc_raw",
    name: "UGC Raw",
    description: "Phone-quality, authentic imperfection, screenshot aesthetic. Feels native to social.",
    imageUrl: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop",
    colorPalette: ["#ffffff", "#f0f0f0", "#333333", "#ff6b35"],
    promptAnchors: ["iPhone 15 Pro screenshot", "messy desk", "candid moment", "natural lighting", "handheld"],
    bestFor: ["DTC", "food", "fitness", "apps"],
  },
  {
    id: "bold_pop",
    name: "Bold Pop",
    description: "Saturated colors, geometric shapes, chunky sans-serif. High energy.",
    imageUrl: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=400&h=300&fit=crop",
    colorPalette: ["#FFD700", "#FF3366", "#00D4AA", "#161514"],
    promptAnchors: ["Memphis design", "bright yellow background", "playful layout", "bold typography", "saturated"],
    bestFor: ["kids", "food", "entertainment", "tech gadgets"],
  },
  {
    id: "dark_premium",
    name: "Dark Premium",
    description: "Deep blacks, rim lighting, metallic accents. Hasselblad-quality.",
    imageUrl: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=400&h=300&fit=crop",
    colorPalette: ["#0a0a0a", "#1a1a1a", "#c0a87d", "#ffffff"],
    promptAnchors: ["studio lighting on black", "chrome reflections", "Hasselblad", "rim light", "metallic"],
    bestFor: ["tech", "automotive", "spirits", "watches"],
  },
  {
    id: "lifestyle_warm",
    name: "Lifestyle Warm",
    description: "Golden hour, earthy tones, real environments. Kodak Portra 400 aesthetic.",
    imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop",
    colorPalette: ["#e8d5b7", "#8b6914", "#5c4a1f", "#f5efe6"],
    promptAnchors: ["golden hour backlight", "Kodak Portra 400", "lived-in space", "earthy tones", "warm"],
    bestFor: ["wellness", "outdoor", "pet", "home"],
  },
  {
    id: "documentary",
    name: "Documentary",
    description: "Observational camera, natural light, 16mm film texture. Authentic storytelling.",
    imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=300&fit=crop",
    colorPalette: ["#2b2b2b", "#8a8a6e", "#d4c5a0", "#f0ebe0"],
    promptAnchors: ["16mm film", "natural light", "observational", "documentary style", "desaturated"],
    bestFor: ["NGO", "brand story", "interview", "cultural"],
  },
  {
    id: "fashion_editorial",
    name: "Fashion Editorial",
    description: "High contrast, dramatic lighting, Vogue-inspired. Structured composition.",
    imageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=300&fit=crop",
    colorPalette: ["#000000", "#ffffff", "#c4a87d", "#8b0000"],
    promptAnchors: ["Vogue editorial", "dramatic lighting", "high contrast", "fashion photography", "structured"],
    bestFor: ["fashion", "beauty", "luxury", "accessories"],
  },
];

export type StudioCharacter = {
  id: string;
  name: string;
  thumbnailUrl: string;
  assignedScenes: number[];
};

export type FramePair = {
  sceneIndex: number;
  firstFrame: { url: string; prompt: string } | null;
  lastFrame: { url: string; prompt: string } | null;
};

export type AudioLayer = {
  id: string;
  type: "music" | "voiceover" | "sfx";
  url: string;
  label: string;
  volume: number;
  startSeconds: number;
  durationSeconds: number;
};

export type StudioState = {
  currentStep: StudioStep;
  projectId: string | null;
  brandId: string;

  // Step 1: Story
  storyPrompt: string;
  tone: string;
  targetPlatform: string;
  targetDuration: number; // seconds

  // Step 2: Script
  scenes: ScriptScene[];
  totalDuration: number;

  // Step 3: Style
  selectedStyle: string | null;
  customColorPalette: string[];
  moodBoardUrls: string[];

  // Step 4: Characters
  characters: StudioCharacter[];

  // Step 5: Frames
  frames: FramePair[];

  // Step 7: Sound
  audioLayers: AudioLayer[];

  // Step 8: Export
  compositionUrl: string | null;
  renderStatus: "idle" | "rendering" | "done" | "error";
  renderProgress: number;
};

export type StudioAction =
  | { type: "SET_STEP"; step: StudioStep }
  | { type: "SET_BRAND"; brandId: string }
  | { type: "SET_PROJECT_ID"; projectId: string }
  | { type: "UPDATE_STORY"; payload: Partial<Pick<StudioState, "storyPrompt" | "tone" | "targetPlatform" | "targetDuration">> }
  | { type: "SET_SCENES"; scenes: ScriptScene[] }
  | { type: "UPDATE_SCENE"; index: number; scene: Partial<ScriptScene> }
  | { type: "ADD_SCENE"; scene: ScriptScene }
  | { type: "REMOVE_SCENE"; index: number }
  | { type: "REORDER_SCENES"; fromIndex: number; toIndex: number }
  | { type: "SET_STYLE"; styleId: string }
  | { type: "SET_MOOD_BOARD"; urls: string[] }
  | { type: "SET_CHARACTERS"; characters: StudioCharacter[] }
  | { type: "ASSIGN_CHARACTER"; characterId: string; sceneIndex: number }
  | { type: "SET_FRAME"; sceneIndex: number; position: "first" | "last"; url: string; prompt: string }
  | { type: "SET_AUDIO_LAYERS"; layers: AudioLayer[] }
  | { type: "ADD_AUDIO_LAYER"; layer: AudioLayer }
  | { type: "REMOVE_AUDIO_LAYER"; id: string }
  | { type: "UPDATE_AUDIO_LAYER"; id: string; updates: Partial<AudioLayer> }
  | { type: "SET_RENDER_STATUS"; status: StudioState["renderStatus"]; progress?: number; url?: string }
  | { type: "RESET" };
