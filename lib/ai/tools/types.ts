import type { Brand } from "@/lib/database.types";
import type { DirectorPersona } from "@/lib/directors/types";

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
  allBrands?: Brand[];
  language: string;
  /** Target film duration in seconds (user-chosen from UI). Falls back to 30 if absent. */
  durationSeconds?: number;
  /** Target aspect ratio (user-chosen from UI): "16:9" | "9:16" | "1:1" | "21:9" | "4:3" | "3:4". */
  aspectRatio?: string;
  budget?: number;
  creditsUsed?: number;
  /** AbortSignal from withTimeout — polling loops should check this to stop when the tool times out */
  signal?: AbortSignal;
  /** Lead director persona (AUTEUR — May 2026). Drives system prompt + image/score modifiers. */
  leadDirector?: DirectorPersona | null;
  /** Co-director persona. Optional — runs single-director mode if absent. */
  coDirector?: DirectorPersona | null;
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
  content: string;
  data?: unknown;
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

/**
 * Format a Supabase Postgres insert error with every diagnostic field.
 * Default `.message` loses the error code / hint / constraint name, which
 * are the fields that actually tell you WHY the insert failed. Use this
 * before returning "DB insert failed" to the agent so the operator can
 * actually fix the root cause.
 */
export function formatDbError(
  err: { message?: string; code?: string; details?: string; hint?: string } | null
): string {
  if (!err) return "unknown error (null)";
  const parts = [
    err.message || "no message",
    err.code ? `code=${err.code}` : null,
    err.details ? `details=${err.details}` : null,
    err.hint ? `hint=${err.hint}` : null,
  ].filter(Boolean);
  return parts.join(" | ");
}

// ============================================
// Credit costs per tool — AUTEUR pipeline (May 2026)
// ============================================
export const TOOL_CREDIT_COSTS: Record<string, number> = {
  // Pre-existing TwinLink tools
  write_script: 1,
  generate_plate: 3,
  edit_plate: 2,
  generate_keyframe: 2,
  generate_image: 3,
  generate_video: 15,           // Gen-4.5 i2v 5s @ 12 cr/s ≈ 60 cr ($0.60)
  edit_video: 12,                // Aleph 5s @ 15 cr/s
  generate_music: 5,
  generate_voiceover: 3,
  generate_ambient: 4,           // Runway eleven_text_to_sound_v2
  extract_frame: 1,
  compose_video: 5,
  search_reference: 1,
  list_assets: 0,
  request_approval: 0,

  // AUTEUR / Runway pipeline (May 2026)
  generate_coverage: 12,         // Aleph 5s alternate angle
  apply_signature_pass: 12,      // Aleph 5s director's grade
  apply_director_note: 12,       // Aleph 5s surgical edit
  cite_lesson: 0,                // accumulator only — free
};

// Timeout per tool (ms). Must be larger than the underlying prediction's
// maxWaitMs + its extensions, so the provider's own timeout wins instead
// of this outer one (which can't cancel a stuck prediction cleanly).
export const TOOL_TIMEOUTS: Record<string, number> = {
  write_script: 600_000,
  generate_plate: 660_000,
  edit_plate: 660_000,
  generate_keyframe: 660_000,
  generate_image: 660_000,
  generate_video: 600_000,       // Gen-4.5 i2v ~30-180s
  edit_video: 600_000,            // Aleph ~30-90s
  generate_music: 660_000,
  generate_voiceover: 120_000,
  generate_ambient: 180_000,
  extract_frame: 180_000,
  compose_video: 300_000,
  search_reference: 60_000,
  list_assets: 10_000,
  request_approval: 5_000,

  // AUTEUR / Runway pipeline
  generate_coverage: 600_000,
  apply_signature_pass: 600_000,
  apply_director_note: 600_000,
  cite_lesson: 5_000,
};
