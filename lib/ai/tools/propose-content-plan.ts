import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { getCredits } from "@/lib/credits";

/* ------------------------------------------------------------------ */
/*  Credit costs per content type                                      */
/* ------------------------------------------------------------------ */

const CONTENT_COSTS = {
  static_image: 3,
  carousel_5_slides: 15,
  ugc_video_sora2: 15,
  avatar_video_heygen: 20,
  broll_video_kling: 15,
  voiceover: 3,
  research: 2,
} as const;

/* ------------------------------------------------------------------ */
/*  Definition                                                         */
/* ------------------------------------------------------------------ */

export const proposeContentPlanDefinition: ToolDefinition = {
  name: "propose_content_plan",
  description:
    "Propose a content plan based on the user's available credit budget. Returns 3 plan options (image-heavy, video-focused, balanced) with a detailed credit breakdown. Costs 0 credits — it's just planning.",
  input_schema: {
    type: "object",
    properties: {
      goals: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional campaign goals (e.g. 'brand awareness', 'product launch', 'lead generation').",
      },
      num_days: {
        type: "number",
        description:
          "Number of days the plan should cover. Defaults to 7.",
      },
      platforms: {
        type: "array",
        items: { type: "string" },
        description:
          "Target platforms (e.g. 'instagram', 'tiktok', 'youtube'). Defaults to ['instagram', 'tiktok'].",
      },
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Plan generation helpers                                            */
/* ------------------------------------------------------------------ */

type PlanItem = { type: string; qty: number; unitCost: number };

function buildOptionA(budget: number): { items: PlanItem[]; total: number } {
  // Image-heavy: maximize static images + carousels
  const items: PlanItem[] = [];
  let remaining = budget;

  // Allocate 1 research first if affordable
  if (remaining >= CONTENT_COSTS.research) {
    items.push({ type: "Research", qty: 1, unitCost: CONTENT_COSTS.research });
    remaining -= CONTENT_COSTS.research;
  }

  // Allocate carousels (up to 2)
  const maxCarousels = Math.min(2, Math.floor(remaining / CONTENT_COSTS.carousel_5_slides));
  if (maxCarousels > 0) {
    items.push({ type: "Carousel (5 slides)", qty: maxCarousels, unitCost: CONTENT_COSTS.carousel_5_slides });
    remaining -= maxCarousels * CONTENT_COSTS.carousel_5_slides;
  }

  // Fill the rest with static images
  const maxImages = Math.floor(remaining / CONTENT_COSTS.static_image);
  if (maxImages > 0) {
    items.push({ type: "Static image", qty: maxImages, unitCost: CONTENT_COSTS.static_image });
    remaining -= maxImages * CONTENT_COSTS.static_image;
  }

  const total = budget - remaining;
  return { items, total };
}

function buildOptionB(budget: number): { items: PlanItem[]; total: number } {
  // Video-focused: maximize videos
  const items: PlanItem[] = [];
  let remaining = budget;

  // Allocate 1 research first if affordable
  if (remaining >= CONTENT_COSTS.research) {
    items.push({ type: "Research", qty: 1, unitCost: CONTENT_COSTS.research });
    remaining -= CONTENT_COSTS.research;
  }

  // Allocate avatar videos (up to 2)
  const maxAvatar = Math.min(2, Math.floor(remaining / CONTENT_COSTS.avatar_video_heygen));
  if (maxAvatar > 0) {
    items.push({ type: "Avatar video (HeyGen)", qty: maxAvatar, unitCost: CONTENT_COSTS.avatar_video_heygen });
    remaining -= maxAvatar * CONTENT_COSTS.avatar_video_heygen;
  }

  // Allocate UGC videos
  const maxUgc = Math.min(2, Math.floor(remaining / CONTENT_COSTS.ugc_video_sora2));
  if (maxUgc > 0) {
    items.push({ type: "UGC video (Sora 2)", qty: maxUgc, unitCost: CONTENT_COSTS.ugc_video_sora2 });
    remaining -= maxUgc * CONTENT_COSTS.ugc_video_sora2;
  }

  // Allocate B-roll
  const maxBroll = Math.min(2, Math.floor(remaining / CONTENT_COSTS.broll_video_kling));
  if (maxBroll > 0) {
    items.push({ type: "B-roll video (Kling)", qty: maxBroll, unitCost: CONTENT_COSTS.broll_video_kling });
    remaining -= maxBroll * CONTENT_COSTS.broll_video_kling;
  }

  // Voiceovers
  const maxVo = Math.min(2, Math.floor(remaining / CONTENT_COSTS.voiceover));
  if (maxVo > 0) {
    items.push({ type: "Voiceover", qty: maxVo, unitCost: CONTENT_COSTS.voiceover });
    remaining -= maxVo * CONTENT_COSTS.voiceover;
  }

  // Fill leftover with images
  const maxImages = Math.floor(remaining / CONTENT_COSTS.static_image);
  if (maxImages > 0) {
    items.push({ type: "Static image", qty: maxImages, unitCost: CONTENT_COSTS.static_image });
    remaining -= maxImages * CONTENT_COSTS.static_image;
  }

  const total = budget - remaining;
  return { items, total };
}

function buildOptionC(budget: number): { items: PlanItem[]; total: number } {
  // Balanced mix
  const items: PlanItem[] = [];
  let remaining = budget;

  // Research
  if (remaining >= CONTENT_COSTS.research) {
    items.push({ type: "Research", qty: 1, unitCost: CONTENT_COSTS.research });
    remaining -= CONTENT_COSTS.research;
  }

  // 1 avatar video
  if (remaining >= CONTENT_COSTS.avatar_video_heygen) {
    items.push({ type: "Avatar video (HeyGen)", qty: 1, unitCost: CONTENT_COSTS.avatar_video_heygen });
    remaining -= CONTENT_COSTS.avatar_video_heygen;
  }

  // 1 carousel
  if (remaining >= CONTENT_COSTS.carousel_5_slides) {
    items.push({ type: "Carousel (5 slides)", qty: 1, unitCost: CONTENT_COSTS.carousel_5_slides });
    remaining -= CONTENT_COSTS.carousel_5_slides;
  }

  // 1 UGC video
  if (remaining >= CONTENT_COSTS.ugc_video_sora2) {
    items.push({ type: "UGC video (Sora 2)", qty: 1, unitCost: CONTENT_COSTS.ugc_video_sora2 });
    remaining -= CONTENT_COSTS.ugc_video_sora2;
  }

  // 1 voiceover
  if (remaining >= CONTENT_COSTS.voiceover) {
    items.push({ type: "Voiceover", qty: 1, unitCost: CONTENT_COSTS.voiceover });
    remaining -= CONTENT_COSTS.voiceover;
  }

  // Fill leftover with static images
  const maxImages = Math.floor(remaining / CONTENT_COSTS.static_image);
  if (maxImages > 0) {
    items.push({ type: "Static image", qty: maxImages, unitCost: CONTENT_COSTS.static_image });
    remaining -= maxImages * CONTENT_COSTS.static_image;
  }

  const total = budget - remaining;
  return { items, total };
}

function formatOption(
  label: string,
  description: string,
  option: { items: PlanItem[]; total: number },
  budget: number
): string {
  const lines: string[] = [];
  lines.push(`### ${label}: ${description}`);
  lines.push("");

  for (const item of option.items) {
    const lineCost = item.qty * item.unitCost;
    lines.push(`- ${item.qty}x ${item.type} — ${lineCost} credits (${item.unitCost} each)`);
  }

  lines.push("");
  lines.push(`**Total: ${option.total} / ${budget} credits** (${budget - option.total} remaining)`);
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Handler                                                            */
/* ------------------------------------------------------------------ */

export const proposeContentPlanTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const goals = (input.goals as string[] | undefined) ?? [];
  const numDays = (input.num_days as number | undefined) ?? 7;
  const platforms = (input.platforms as string[] | undefined) ?? ["instagram", "tiktok"];

  console.log(
    "[tool:propose_content_plan] goals:", goals,
    "days:", numDays,
    "platforms:", platforms
  );

  emitter.send("tool_progress", {
    tool: "propose_content_plan",
    generationId: context.generationId,
    status: "planning",
    message: "Fetching credit balance and building plan options...",
  });

  try {
    const balance = await getCredits(context.orgId);

    if (balance <= 0) {
      return {
        success: true,
        content:
          "The organisation has 0 credits remaining. No content can be produced until credits are added. Please ask the user to purchase more credits.",
      };
    }

    const optionA = buildOptionA(balance);
    const optionB = buildOptionB(balance);
    const optionC = buildOptionC(balance);

    const header = [
      `## Content Plan Proposal`,
      "",
      `**Available budget**: ${balance} credits`,
      `**Plan duration**: ${numDays} days`,
      `**Platforms**: ${platforms.join(", ")}`,
      goals.length > 0 ? `**Goals**: ${goals.join(", ")}` : "",
      "",
      "### Credit Reference",
      `- Static image: ${CONTENT_COSTS.static_image} credits`,
      `- Carousel (5 slides): ${CONTENT_COSTS.carousel_5_slides} credits`,
      `- UGC video (Sora 2): ${CONTENT_COSTS.ugc_video_sora2} credits`,
      `- Avatar video (HeyGen): ${CONTENT_COSTS.avatar_video_heygen} credits`,
      `- B-roll video (Kling): ${CONTENT_COSTS.broll_video_kling} credits`,
      `- Voiceover: ${CONTENT_COSTS.voiceover} credits`,
      `- Research: ${CONTENT_COSTS.research} credits`,
      "",
    ]
      .filter(Boolean)
      .join("\n");

    const planA = formatOption("Option A", "Image-Heavy (maximize static + carousels)", optionA, balance);
    const planB = formatOption("Option B", "Video-Focused (maximize videos)", optionB, balance);
    const planC = formatOption("Option C", "Balanced Mix", optionC, balance);

    const content = [header, planA, "", planB, "", planC].join("\n");

    emitter.send("tool_progress", {
      tool: "propose_content_plan",
      generationId: context.generationId,
      status: "complete",
      message: "Content plan ready",
    });

    return {
      success: true,
      content,
      data: {
        balance,
        numDays,
        platforms,
        goals,
        options: {
          A: { description: "Image-Heavy", items: optionA.items, total: optionA.total },
          B: { description: "Video-Focused", items: optionB.items, total: optionB.total },
          C: { description: "Balanced Mix", items: optionC.items, total: optionC.total },
        },
      },
    };
  } catch (error) {
    console.error("[tool:propose_content_plan] Error:", error);
    return {
      success: false,
      content: `Failed to build content plan: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
