import type { Brand } from "@/lib/database.types";

// ============================================
// Anthropic Tool Use Types
// ============================================

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export type AgentContext = {
  generationId: string;
  orgId: string;
  userId: string;
  brand: Brand | null;
  allBrands?: Brand[]; // All user brands when no specific one is selected
  language: string;
  budget?: number;
  creditsUsed?: number;
  /** AbortSignal from withTimeout — polling loops should check this to stop when the tool times out */
  signal?: AbortSignal;
};

export type SSEEmitter = {
  send: (event: string, data: unknown) => void;
};

export type AssetOutput = {
  assetId?: string;
  type: "image" | "video" | "audio" | "script" | "thumbnail";
  url?: string;
  metadata: Record<string, unknown>;
};

export type ToolResult = {
  success: boolean;
  content: string; // Text summary for Claude
  data?: unknown; // Structured data for DB
  assets?: AssetOutput[];
};

export type ToolHandler = (
  input: Record<string, unknown>,
  context: AgentContext,
  emitter: SSEEmitter
) => Promise<ToolResult>;

// Helper to get next variant number for a generation
export async function getNextVariantNumber(generationId: string): Promise<number> {
  const { db } = await import("@/lib/db");
  const { count } = await db
    .from("generation_assets")
    .select("id", { count: "exact", head: true })
    .eq("generation_id", generationId);
  return (count || 0) + 1;
}

// Credit costs per tool
export const TOOL_CREDIT_COSTS: Record<string, number> = {
  analyze_brand: 0,
  research_competitor: 2,
  generate_creative_brief: 1,
  generate_image: 3,
  generate_video: 15, // Sora 2 or Kling v3
  generate_avatar_video: 20, // HeyGen Avatar4
  write_script: 1,
  generate_voiceover: 3,
  search_trends: 1,
  generate_carousel: 3, // per_slide — actual cost = 3 x num_slides, handled in tool
  propose_content_plan: 0,
  generate_character: 3,
  compose_video: 5,
  generate_motion_graphic: 5,
  use_template: 0,
  generate_music: 5,
  create_storyboard: 0,
  schedule_post: 0,
  replicate_ad: 0,
  search_inspiration: 1,
  lipsync_video: 5,
};

// Timeout per tool (ms)
export const TOOL_TIMEOUTS: Record<string, number> = {
  analyze_brand: 120_000, // Opus + structured JSON can take 60-90s
  research_competitor: 180_000,
  generate_creative_brief: 120_000,
  generate_image: 300_000, // 2K edit with thinking:high can take 2-3 min
  generate_video: 600_000,
  generate_avatar_video: 600_000,
  write_script: 180_000, // Opus structured JSON for complex scripts: 60-120s typical
  generate_voiceover: 120_000, // ElevenLabs + upload can take 30-60s
  search_trends: 60_000,
  generate_carousel: 300_000,
  propose_content_plan: 60_000,
  generate_character: 300_000,
  compose_video: 300_000, // Remotion Lambda render ~10-60s
  generate_motion_graphic: 300_000,
  use_template: 10_000,
  generate_music: 660_000, // Suno V4.5: TEXT_SUCCESS→FIRST_SUCCESS takes 5-8 min, poll for 10min + buffer
  create_storyboard: 10_000,
  schedule_post: 10_000,
  replicate_ad: 10_000,
  search_inspiration: 30_000,
  lipsync_video: 300_000,
};
