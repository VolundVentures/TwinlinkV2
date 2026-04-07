/**
 * Cost tracking for external API calls.
 * Logs estimated costs per generation session.
 */

// Estimated costs per model (USD)
const MODEL_COSTS: Record<string, { unit: string; costPerUnit: number }> = {
  // Images — text-to-image
  "fal-ai/nano-banana-2": { unit: "image", costPerUnit: 0.08 }, // ~$0.08 per 1K image
  "fal-ai/nano-banana-2-2K": { unit: "image", costPerUnit: 0.12 }, // ~$0.12 per 2K image
  // Images — edit endpoint (with reference images)
  "fal-ai/nano-banana-2/edit": { unit: "image", costPerUnit: 0.08 },
  "fal-ai/nano-banana-2/edit-2K": { unit: "image", costPerUnit: 0.12 },

  // Video
  "fal-ai/sora-2/text-to-video": { unit: "second", costPerUnit: 0.30 }, // ~$0.30/s at 720p
  "fal-ai/sora-2/image-to-video": { unit: "second", costPerUnit: 0.30 },
  "fal-ai/kling-video/v3/pro/text-to-video": { unit: "second", costPerUnit: 0.168 },
  "fal-ai/kling-video/v3/pro/image-to-video": { unit: "second", costPerUnit: 0.168 },
  "fal-ai/heygen/avatar4/image-to-video": { unit: "second", costPerUnit: 0.10 },

  // Sora Pro variants
  "fal-ai/sora-2/image-to-video/pro": { unit: "second", costPerUnit: 0.30 },
  "fal-ai/sora-2/video-to-video/remix": { unit: "second", costPerUnit: 0.30 },

  // Veo 3.1 variants
  "fal-ai/veo3.1": { unit: "second", costPerUnit: 0.40 },
  "fal-ai/veo3.1/fast": { unit: "second", costPerUnit: 0.10 },
  "fal-ai/veo3.1/reference-to-video": { unit: "second", costPerUnit: 0.40 },
  "fal-ai/veo3.1/fast/first-last-frame-to-video": { unit: "second", costPerUnit: 0.10 },

  // Kling Standard variants
  "fal-ai/kling-video/v3/standard/text-to-video": { unit: "second", costPerUnit: 0.168 },
  "fal-ai/kling-video/v3/standard/image-to-video": { unit: "second", costPerUnit: 0.168 },

  // Veo 3.1 first-last-frame (standard)
  "fal-ai/veo3.1/first-last-frame-to-video": { unit: "second", costPerUnit: 0.40 },

  // Seedance 2.0
  "bytedance/seedance-2.0/image-to-video": { unit: "second", costPerUnit: 0.30 },
  "bytedance/seedance-2.0/reference-to-video": { unit: "second", costPerUnit: 0.30 },

  // Lip-sync
  "fal-ai/sync-lipsync/v3": { unit: "minute", costPerUnit: 8.0 },      // ~$8/min for v3
  "fal-ai/sync-lipsync/v2/pro": { unit: "minute", costPerUnit: 5.0 },  // ~$5/min for Pro
  "fal-ai/sync-lipsync/v2": { unit: "minute", costPerUnit: 3.0 },      // ~$3/min for Standard

  // Composition
  "remotion-lambda": { unit: "render", costPerUnit: 0.03 }, // ~$0.02-0.05 per render

  // Transcription
  "fal-ai/whisper": { unit: "minute", costPerUnit: 0.01 },

  // TTS
  "elevenlabs-tts": { unit: "character", costPerUnit: 0.00003 }, // ~$30/1M chars
  "gemini-tts": { unit: "token", costPerUnit: 0.00002 }, // ~$20/1M output tokens

  // Music
  "suno-music": { unit: "second", costPerUnit: 0.01 }, // ~$0.30 per 30s track

  // LLM
  "claude-sonnet-4-6": { unit: "1K-tokens", costPerUnit: 0.015 },
  "claude-opus-4-6": { unit: "1K-tokens", costPerUnit: 0.075 }, // $15/1M input + $75/1M output
};

type CostEntry = {
  model: string;
  units: number;
  estimatedCost: number;
  timestamp: number;
  description: string;
};

// In-memory cost log per generation
const generationCosts = new Map<string, CostEntry[]>();

export function trackCost(
  generationId: string,
  model: string,
  units: number,
  description: string
): number {
  const modelInfo = MODEL_COSTS[model];
  const estimatedCost = modelInfo
    ? modelInfo.costPerUnit * units
    : 0;

  const entry: CostEntry = {
    model,
    units,
    estimatedCost,
    timestamp: Date.now(),
    description,
  };

  const existing = generationCosts.get(generationId) || [];
  existing.push(entry);
  generationCosts.set(generationId, existing);

  console.log(
    `[cost] ${model} | ${units} ${modelInfo?.unit || "units"} | ~$${estimatedCost.toFixed(4)} | ${description}`
  );

  return estimatedCost;
}

export function getGenerationCostBreakdown(generationId: string): {
  entries: CostEntry[];
  totalCost: number;
} {
  const entries = generationCosts.get(generationId) || [];
  const totalCost = entries.reduce((sum, e) => sum + e.estimatedCost, 0);
  return { entries, totalCost };
}

export function formatCostBreakdown(generationId: string): string {
  const { entries, totalCost } = getGenerationCostBreakdown(generationId);
  if (entries.length === 0) return "No costs tracked.";

  const lines = entries.map(
    (e) => `  ${e.description}: ~$${e.estimatedCost.toFixed(4)} (${e.model})`
  );
  lines.push(`  ─────────────────`);
  lines.push(`  Total: ~$${totalCost.toFixed(4)}`);
  return lines.join("\n");
}

export function clearGenerationCosts(generationId: string): void {
  generationCosts.delete(generationId);
}
