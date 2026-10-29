/**
 * Cost tracking for external API calls.
 *
 * Prices are pulled from Runway's pricing page. Update these when Runway
 * changes pricing — they print in the generation summary and inform
 * billing/credit exchange rates.
 *
 * Conventions:
 *   - `unit: "image"` → cost per image
 *   - `unit: "second"` → cost per output second of video/audio
 *   - `unit: "token"` → cost per *output* token (we don't separately track input)
 *
 * Every Runway wrapper (lib/runway/*) calls `trackCost` on success so every
 * generation has a complete cost trail. Tool handlers don't need to call
 * trackCost directly — it happens at the provider entry point.
 */

const MODEL_COSTS: Record<string, { unit: string; costPerUnit: number }> = {
  // -----------------------------------------------------------------------
  // Runway API — the only generation provider. 1 Runway credit = $0.01.
  // Pricing from docs.dev.runwayml.com/guides/pricing/ (Sept 2026). Keys
  // match RUNWAY_MODELS in lib/runway/models.ts. Every wrapper in
  // lib/runway/* calls trackCost on success.
  // -----------------------------------------------------------------------
  // Images — GPT Image 2.5. Billed 1–76 cr by quality × resolution, +1 cr per
  // reference image. Figures below are the `high` quality tier at 1K (default)
  // and 4K (_hd). Update from invoices when known.
  "runway/gpt_image_2_5_sunburst": { unit: "image", costPerUnit: 0.12 },
  "runway/gpt_image_2_5_sunburst_hd": { unit: "image", costPerUnit: 0.4 },
  "runway/gpt_image_2_5_flare": { unit: "image", costPerUnit: 0.06 },
  "runway/gpt_image_2_5_flare_hd": { unit: "image", costPerUnit: 0.2 },

  // Scenes — Seedance 2.5. Output seconds + input/reference video seconds.
  "runway/seedance2_5": { unit: "second", costPerUnit: 0.3 },              // 30 cr/s @720p
  "runway/seedance2_5_input": { unit: "second", costPerUnit: 0.15 },       // 15 cr/s reference video
  "runway/seedance2_5_1080p": { unit: "second", costPerUnit: 0.68 },       // 68 cr/s
  "runway/seedance2_5_1080p_input": { unit: "second", costPerUnit: 0.34 }, // 34 cr/s

  // Finish — Magnific video upscaler (per frame, 4K tier).
  "runway/magnific_video_upscaler_4k": { unit: "frame", costPerUnit: 0.012 },

  // Audio
  "runway/eleven_v3": { unit: "character", costPerUnit: 0.0002 },              // 1 cr / 50 chars
  "runway/eleven_text_to_sound_v2": { unit: "second", costPerUnit: 0.01 },     // 1 cr/s
  "runway/seed_audio": { unit: "second", costPerUnit: 0.0025 },                // 0.25 cr/s

  // -----------------------------------------------------------------------
  // Composition — Remotion Lambda (~$0.02-0.05/render, size-dependent).
  // -----------------------------------------------------------------------
  "remotion-lambda": { unit: "render", costPerUnit: 0.03 },

  // -----------------------------------------------------------------------
  // LLM — OpenAI Responses API (blended input+output estimates, per 1K
  // output-equivalent tokens). Call trackCost with output tokens.
  //   gpt-6-astra: $10/$50 per MTok · gpt-6-sol: $2/$10 · gpt-6-luna: $0.1/$0.5
  // -----------------------------------------------------------------------
  "gpt-6-astra": { unit: "1K-tokens", costPerUnit: 0.03 },
  "gpt-6-sol": { unit: "1K-tokens", costPerUnit: 0.006 },
  "gpt-6-luna": { unit: "1K-tokens", costPerUnit: 0.0003 },
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
