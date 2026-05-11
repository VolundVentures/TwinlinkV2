/**
 * Cost tracking for external API calls.
 *
 * Prices below are pulled directly from replicate.com/pricing and the
 * respective model pages as of the cutover to Replicate. Update these
 * when providers change pricing — they print in the generation summary
 * and inform billing/credit exchange rates.
 *
 * Conventions:
 *   - `unit: "image"` → cost per image
 *   - `unit: "second"` → cost per output second of video/audio
 *   - `unit: "token"` → cost per *output* token (we don't separately track input)
 *
 * Every Replicate provider wrapper (lib/generation/replicate-image.ts,
 * replicate-video.ts, music.ts, etc.) calls `trackCost` on success so
 * every generation has a complete cost trail. Tool handlers don't need
 * to call trackCost directly — it happens at the provider entry point.
 */

const MODEL_COSTS: Record<string, { unit: string; costPerUnit: number }> = {
  // -----------------------------------------------------------------------
  // Images — Nano Banana Pro on Replicate (google/nano-banana-pro)
  // Pricing is FLAT per prediction regardless of output_resolution — we
  // confirmed this against invoices (1K and 2K bill identically). If you
  // need to save money, switch to the standard google/nano-banana model
  // (cheaper but 1K-only, edit mode less robust).
  //
  // The $0.04 figure below is the safe estimate; update to exact invoice
  // rate when known. `trackCost` logs a UNKNOWN MODEL warning if this key
  // is ever missed, so a silent $0 can't sneak in.
  // -----------------------------------------------------------------------
  "google/nano-banana-pro": { unit: "image", costPerUnit: 0.04 },
  "google/nano-banana": { unit: "image", costPerUnit: 0.009 },

  // -----------------------------------------------------------------------
  // Video — Kling v3 Omni (kwaivgi/kling-v3-omni-video) on Replicate.
  // Pro mode (1080p) is the product default; standard (720p) is cheaper.
  // -----------------------------------------------------------------------
  "kwaivgi/kling-v3-omni-video-pro": { unit: "second", costPerUnit: 0.28 }, // $0.28/s 1080p
  "kwaivgi/kling-v3-omni-video-standard": { unit: "second", costPerUnit: 0.14 }, // $0.14/s 720p
  "kwaivgi/kling-v3-omni-video": { unit: "second", costPerUnit: 0.28 }, // default pro

  // -----------------------------------------------------------------------
  // Video editing — Kling O1 on Replicate. Billed per source-second.
  // -----------------------------------------------------------------------
  "kwaivgi/kling-o1": { unit: "second", costPerUnit: 0.168 },

  // -----------------------------------------------------------------------
  // Video — Bytedance Seedance 2.0 on Replicate. Secondary model (face-
  // free b-roll, used only for 21:9 / 4:3 / 3:4 aspect ratios).
  // -----------------------------------------------------------------------
  "bytedance/seedance-2.0-720p": { unit: "second", costPerUnit: 0.18 },
  "bytedance/seedance-2.0-480p": { unit: "second", costPerUnit: 0.09 },
  "bytedance/seedance-2.0": { unit: "second", costPerUnit: 0.18 },

  // -----------------------------------------------------------------------
  // Music — Suno (via aiquickdraw proxy, ~30s tracks).
  // -----------------------------------------------------------------------
  "suno-music": { unit: "second", costPerUnit: 0.01 }, // ~$0.30 / 30s track

  // -----------------------------------------------------------------------
  // Voice — ElevenLabs TTS (~$30 / 1M chars on creator plan).
  // -----------------------------------------------------------------------
  "elevenlabs-tts": { unit: "character", costPerUnit: 0.00003 },

  // -----------------------------------------------------------------------
  // Transcription — OpenAI Whisper ($0.006/min → $0.0001/s).
  // -----------------------------------------------------------------------
  "openai/whisper": { unit: "minute", costPerUnit: 0.006 },

  // -----------------------------------------------------------------------
  // Composition — Remotion Lambda (~$0.02-0.05/render, size-dependent).
  // -----------------------------------------------------------------------
  "remotion-lambda": { unit: "render", costPerUnit: 0.03 },

  // -----------------------------------------------------------------------
  // LLM — Anthropic API (weighted blended input+output estimates so
  // callers can track in "output-equivalent" tokens).
  //   Sonnet 4.6: $3/1M input + $15/1M output → $18 blended / 1M / 2 = $9/1M
  //   Opus 4.6:   $15/1M input + $75/1M output → $90 blended / 1M / 2 = $45/1M
  //   Haiku 4.5:  $1/1M input + $5/1M output → $6 blended / 1M / 2 = $3/1M
  // Call trackCost with output tokens, it's an estimate.
  // -----------------------------------------------------------------------
  "claude-sonnet-4-6": { unit: "1K-tokens", costPerUnit: 0.009 },
  "claude-opus-4-6": { unit: "1K-tokens", costPerUnit: 0.045 },
  "claude-haiku-4-5-20251001": { unit: "1K-tokens", costPerUnit: 0.003 },

  // -----------------------------------------------------------------------
  // Runway API (May 2026 — AUTEUR pivot). 1 Runway credit = $0.01.
  // Pricing pulled from docs.dev.runwayml.com/guides/pricing/. The model
  // keys here match the constants in lib/runway/models.ts (RUNWAY_MODELS).
  // Every wrapper in lib/runway/* should call trackCost on success with
  // the appropriate units (image, second).
  // -----------------------------------------------------------------------
  // Image generation
  "runway/gpt_image_2": { unit: "image", costPerUnit: 0.05 },         // 5 cr/image at 720p
  "runway/gpt_image_2_hd": { unit: "image", costPerUnit: 0.08 },      // 8 cr at 1080p
  "runway/gen4_image": { unit: "image", costPerUnit: 0.05 },          // 5 cr at 720p
  "runway/gen4_image_hd": { unit: "image", costPerUnit: 0.08 },       // 8 cr at 1080p
  "runway/gen4_image_turbo": { unit: "image", costPerUnit: 0.02 },    // 2 cr (refs required)
  "runway/gemini_image3_pro": { unit: "image", costPerUnit: 0.20 },   // 20 cr at 1K/2K
  "runway/gemini_2.5_flash": { unit: "image", costPerUnit: 0.05 },    // 5 cr

  // Video generation
  "runway/seedance2": { unit: "second", costPerUnit: 0.36 },          // 36 cr/s
  "runway/gen4.5": { unit: "second", costPerUnit: 0.12 },             // 12 cr/s — character workhorse
  "runway/gen4_turbo": { unit: "second", costPerUnit: 0.05 },         // 5 cr/s
  "runway/gen4_aleph": { unit: "second", costPerUnit: 0.15 },         // 15 cr/s, 5s max
  "runway/act_two": { unit: "second", costPerUnit: 0.05 },            // 5 cr/s — stretch only
  "runway/veo3.1": { unit: "second", costPerUnit: 0.40 },             // 40 cr/s with audio
  "runway/veo3.1_no_audio": { unit: "second", costPerUnit: 0.20 },    // 20 cr/s no audio
  "runway/veo3.1_fast": { unit: "second", costPerUnit: 0.15 },        // 15 cr/s with audio

  // Real-time avatars (Characters API)
  // Pricing is "2 cr upfront + 2 cr per 6s" → ~0.0033/sec runtime + flat 0.02/session
  "runway/gwm1_avatars_session": { unit: "session", costPerUnit: 0.02 },
  "runway/gwm1_avatars_runtime": { unit: "second", costPerUnit: 0.0033 },

  // Audio (ElevenLabs via Runway)
  "runway/eleven_multilingual_v2": { unit: "character", costPerUnit: 0.0002 }, // 1 cr / 50 chars
  "runway/eleven_text_to_sound_v2": { unit: "second", costPerUnit: 0.01 },     // 1 cr/s
  "runway/eleven_voice_isolation": { unit: "second", costPerUnit: 0.00167 },   // 1 cr / 6s
  "runway/eleven_voice_dubbing": { unit: "second", costPerUnit: 0.005 },       // 1 cr / 2s
  "runway/eleven_multilingual_sts_v2": { unit: "second", costPerUnit: 0.0033 }, // 1 cr / 3s

  // Custom voice design (one-shot per persona, async)
  "runway/custom_voice_design": { unit: "voice", costPerUnit: 0.5 }, // ballpark; verify on first run
};

type CostEntry = {
  model: string;
  units: number;
  estimatedCost: number;
  timestamp: number;
  description: string;
};

// In-memory cost log per generation. Flushed when the generation completes
// (see formatCostBreakdown + clearGenerationCosts in agent/run).
const generationCosts = new Map<string, CostEntry[]>();

export function trackCost(
  generationId: string,
  model: string,
  units: number,
  description: string
): number {
  const modelInfo = MODEL_COSTS[model];
  if (!modelInfo) {
    // Surface unknown model keys loudly so we notice when a new provider
    // ships without a pricing entry, instead of silently charging $0.
    console.warn(
      `[cost] UNKNOWN MODEL "${model}" — ${units} units — charged $0.0000 — ${description}. ` +
        `Add this model to MODEL_COSTS in lib/generation/cost-tracker.ts.`
    );
  }
  const estimatedCost = modelInfo ? modelInfo.costPerUnit * units : 0;

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

  // Collapse by model so a run with 12 plate calls doesn't print 12 lines.
  const byModel = new Map<
    string,
    { units: number; cost: number; unit: string }
  >();
  for (const e of entries) {
    const prev = byModel.get(e.model);
    const unit = MODEL_COSTS[e.model]?.unit || "units";
    if (prev) {
      prev.units += e.units;
      prev.cost += e.estimatedCost;
    } else {
      byModel.set(e.model, { units: e.units, cost: e.estimatedCost, unit });
    }
  }

  const lines: string[] = [];
  for (const [model, agg] of byModel) {
    lines.push(
      `  ${model}: ${agg.units.toFixed(2)} ${agg.unit} · ~$${agg.cost.toFixed(4)}`
    );
  }
  lines.push("  ─────────────────");
  lines.push(`  Total: ~$${totalCost.toFixed(4)} across ${entries.length} calls`);
  return lines.join("\n");
}

export function clearGenerationCosts(generationId: string): void {
  generationCosts.delete(generationId);
}
