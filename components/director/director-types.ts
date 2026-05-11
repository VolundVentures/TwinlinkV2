// Director UI types — the split-screen chat + workspace

export type AspectRatio = "16:9" | "9:16" | "1:1" | "21:9" | "4:3" | "3:4";

export type DurationPreset = {
  label: string;
  seconds: number;
};

export const DURATION_PRESETS: DurationPreset[] = [
  { label: "10s", seconds: 10 },
  { label: "15s", seconds: 15 },
  { label: "30s", seconds: 30 },
  { label: "60s", seconds: 60 },
  { label: "90s", seconds: 90 },
  { label: "2 min", seconds: 120 },
];

export const ASPECT_OPTIONS: { value: AspectRatio; label: string; hint: string }[] = [
  { value: "16:9", label: "16:9", hint: "Cinematic" },
  { value: "9:16", label: "9:16", hint: "Vertical / Reels" },
  { value: "1:1", label: "1:1", hint: "Square" },
  { value: "21:9", label: "21:9", hint: "Ultra-wide" },
  { value: "4:3", label: "4:3", hint: "Classic" },
  { value: "3:4", label: "3:4", hint: "Portrait" },
];

export type ReferenceImage = {
  url: string;
  label: string; // short description: "Peugeot emblem", "real actor", etc.
};

export type BriefInput = {
  prompt: string;
  brandId?: string;
  durationSeconds: number;
  aspectRatio: AspectRatio;
  referenceImages?: ReferenceImage[];
  /** AUTEUR — May 2026. Director persona IDs cast in the lobby. */
  leadDirectorId?: string;
  coDirectorId?: string | null;
};

/** Lobby-safe director shape — what the chat / shell hold for display. */
export type CastedDirector = {
  id: string;
  name: string;
  school: string;
  portraitUrl: string;
};

// ----- Messages -----

export type ChatMessage = {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  createdAt: number;
};

// ----- Tool activity (for compact progress indicator in chat) -----

export type ToolActivity = {
  id: string;
  name: string;
  message: string;
  status: "running" | "success" | "failed";
  startedAt: number;
  completedAt?: number;
};

// ----- Assets (driven off asset_ready events + metadata.role) -----

export type PlateKind =
  | "character_sheet"
  | "location_master"
  | "location_variant"
  | "prop"
  | "wardrobe"
  | "vfx_element";

export type PlateAsset = {
  id: string;
  url: string;
  tag: string;
  plateKind: PlateKind;
  description?: string;
  aspectRatio?: string;
  /** Set when this plate came out of edit_plate — points at the source plate's id. */
  parentAssetId?: string;
  /** Parent's @tag — handy when parent_asset_id hasn't been hydrated from DB yet. */
  editedFrom?: string;
  /** The edit_instruction that produced this plate (only on edit-created plates). */
  editInstruction?: string;
};

export type ShotAsset = {
  id: string;
  videoUrl: string;
  prompt: string;
  mode: string;
  durationLabel: string;
  aspectRatio: string;
  imageUrls: string[] | null;
};

export type FinalFilmAsset = {
  id: string;
  url: string;
  duration?: number;
  aspectRatio?: string;
};

// ----- Checkpoints (from `request_approval` tool) -----

export type CheckpointStage =
  | "treatment"
  | "plates"
  | "keyframes"
  | "shots"
  | "final_cut";

export type CheckpointItem = {
  asset_id?: string;
  ref: string;
  label: string;
  kind: string; // plate | keyframe | shot | final
};

export type Checkpoint = {
  stage: CheckpointStage;
  summary: string;
  items: CheckpointItem[];
};

// ----- Treatment (from write_script → treatment_ready event) -----

export type ScriptPlate = {
  tag: string;
  kind: string;
  description: string;
  parent_tag?: string;
};

export type ShotBuildStep =
  | {
      kind: "generate_plate";
      plate_kind: string;
      tag: string;
      description: string;
      parent_tag?: string;
    }
  | {
      kind: "edit_plate";
      target_tag: string;
      edit_instruction: string;
      new_tag?: string;
      reference_tags?: string[];
    }
  | { kind: "compose_keyframe"; role: "hero" | "first_frame" | "last_frame" };

export type ScriptShot = {
  id: string;
  label: string;
  duration_seconds: number;
  model: string;
  plate_refs: string[];
  keyframe_plan: string;
  motion: string;
  shot_build?: ShotBuildStep[];
  notes?: string;
};

export type TreatmentData = {
  title: string;
  logline: string;
  end_card: string;
  duration_seconds: number;
  aspect_ratio: string;
  tone: string;
  color_script: { shadow: string; highlight: string; notes?: string };
  camera_rule: string;
  reference_films: string[];
  plates: ScriptPlate[];
  shots: ScriptShot[];
  music?: { description?: string; mood?: string; has_music?: boolean };
  voiceover?: { full_script?: string | null; direction?: string | null };
};

// ----- Keyframe assets (Layer 2, produced by generate_image with plate refs) -----

export type KeyframeAsset = {
  id: string;
  url: string;
  tag?: string;
  shotId?: string;
  role?: "hero" | "first_frame" | "last_frame";
  prompt?: string;
  plateTags?: string[];
  aspectRatio?: string;
  /** Set when this keyframe came out of edit_plate. */
  parentAssetId?: string;
  editedFrom?: string;
  editInstruction?: string;
};

// ----- Workspace state machine -----

export type WorkspaceState =
  | { kind: "welcome" }
  | { kind: "working"; stage: string; label: string }
  | {
      kind: "treatment";
      treatment: TreatmentData | null;
      text: string;
      pending: boolean;
    }
  | {
      kind: "production";
      plates: PlateAsset[];
      keyframes: KeyframeAsset[];
      shots: ShotAsset[];
      composing: boolean;
      activeCheckpoint: Checkpoint | null;
      lastAgentMessage: string;
    }
  | {
      kind: "final";
      film: FinalFilmAsset;
      plates: PlateAsset[];
      keyframes: KeyframeAsset[];
      shots: ShotAsset[];
    };

// ----- SSE event shapes (what we actually consume) -----

export type SessionStartEvent = {
  generationId: string;
  sessionId: string;
  brandName: string | null;
  language: string;
  durationSeconds?: number;
  aspectRatio?: string;
};

export type ToolStartEvent = {
  id: string;
  tool: string;
  input?: Record<string, unknown>;
};

export type ToolProgressEvent = {
  id?: string;
  tool: string;
  generationId: string;
  status: string;
  message: string;
};

export type ToolResultEvent = {
  id: string;
  tool: string;
  success: boolean;
  summary: string;
};

export type AssetReadyEvent = {
  assetId: string;
  type: "image" | "video" | "audio" | "script" | "thumbnail";
  url?: string;
  metadata: Record<string, unknown>;
};

export type CheckpointReadyEvent = {
  generationId: string;
  stage: CheckpointStage;
  summary: string;
  items: CheckpointItem[];
};

export type AgentMessageEvent = {
  content: string;
};
