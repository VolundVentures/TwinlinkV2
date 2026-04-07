/**
 * Video template definitions for TwinLink.
 * Each template defines a structured workflow that the agent executes step by step.
 * Templates follow an image-first philosophy: generate images → animate → compose.
 */

export type TemplateStep = {
  id: string;
  tool: string;
  description: string;
  params: Record<string, unknown>;
  dependsOn?: string[]; // step IDs this depends on
};

export type VideoTemplate = {
  id: string;
  name: string;
  description: string;
  category: "ugc" | "product" | "testimonial" | "tech" | "social_proof" | "hook";
  platform: "tiktok" | "instagram" | "linkedin" | "youtube" | "all";
  estimatedCredits: number;
  estimatedDuration: string;
  aspectRatio: "9:16" | "16:9" | "1:1" | "4:5";
  steps: TemplateStep[];
  icon: string;
};

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  // === UGC TEMPLATES ===
  {
    id: "ugc-talking-head",
    name: "UGC Talking Head",
    description:
      "Character speaks directly to camera with TikTok-style captions. Classic UGC format that outperforms polished ads by 2-3x.",
    category: "ugc",
    platform: "tiktok",
    estimatedCredits: 28,
    estimatedDuration: "15-30s",
    aspectRatio: "9:16",
    icon: "🎤",
    steps: [
      {
        id: "script",
        tool: "write_script",
        description: "Write a UGC script with hook, problem, solution, CTA",
        params: { duration_seconds: 20, style: "casual" },
      },
      {
        id: "character",
        tool: "generate_character",
        description: "Generate a relatable UGC character",
        params: { style: "ugc_casual", pose: "upper_body", environment: "home", aspect_ratio: "9:16" },
      },
      {
        id: "avatar",
        tool: "generate_avatar_video",
        description: "Generate talking head video with the character",
        params: { talking_style: "expressive", aspect_ratio: "9:16" },
        dependsOn: ["script", "character"],
      },
      {
        id: "compose",
        tool: "compose_video",
        description: "Add captions and brand watermark",
        params: { captions: true, brand_watermark: true, transition: "cut", aspect_ratio: "9:16" },
        dependsOn: ["avatar"],
      },
    ],
  },
  {
    id: "ugc-with-product",
    name: "UGC with Product",
    description:
      "Character holds/uses the actual product while delivering a testimonial. Uses image references for product accuracy.",
    category: "ugc",
    platform: "tiktok",
    estimatedCredits: 28,
    estimatedDuration: "15-25s",
    aspectRatio: "9:16",
    icon: "🛍️",
    steps: [
      {
        id: "script",
        tool: "write_script",
        description: "Write product testimonial script",
        params: { duration_seconds: 15, style: "casual", hook_type: "transformation" },
      },
      {
        id: "character",
        tool: "generate_character",
        description: "Generate character holding the product (uses product image as reference)",
        params: { style: "ugc_casual", pose: "holding_product", environment: "home", aspect_ratio: "9:16" },
      },
      {
        id: "avatar",
        tool: "generate_avatar_video",
        description: "Generate talking head video",
        params: { talking_style: "expressive", aspect_ratio: "9:16" },
        dependsOn: ["script", "character"],
      },
      {
        id: "compose",
        tool: "compose_video",
        description: "Add captions and brand watermark",
        params: { captions: true, brand_watermark: true, aspect_ratio: "9:16" },
        dependsOn: ["avatar"],
      },
    ],
  },
  {
    id: "before-after",
    name: "Before/After Story",
    description:
      "Shows transformation: problem state → solution with product. High-converting format with crossfade transition.",
    category: "ugc",
    platform: "all",
    estimatedCredits: 31,
    estimatedDuration: "15-20s",
    aspectRatio: "9:16",
    icon: "✨",
    steps: [
      {
        id: "before-image",
        tool: "generate_image",
        description: "Generate 'before' scene showing the problem (desaturated, frustrating)",
        params: { aspect_ratio: "9:16", resolution: "2K" },
      },
      {
        id: "after-image",
        tool: "generate_image",
        description: "Generate 'after' scene showing the solution (warm, satisfying)",
        params: { aspect_ratio: "9:16", resolution: "2K" },
      },
      {
        id: "compose",
        tool: "compose_video",
        description: "Compose before → after with crossfade transition and CTA text overlay",
        params: { transition: "crossfade", captions: false, brand_watermark: true, aspect_ratio: "9:16" },
        dependsOn: ["before-image", "after-image"],
      },
    ],
  },

  // === PRODUCT TEMPLATES ===
  {
    id: "product-hero",
    name: "Product Hero",
    description:
      "Cinematic product showcase with orbit animation and brand text overlay. Perfect for e-commerce launches.",
    category: "product",
    platform: "instagram",
    estimatedCredits: 23,
    estimatedDuration: "10-15s",
    aspectRatio: "1:1",
    icon: "📦",
    steps: [
      {
        id: "hero-image",
        tool: "generate_image",
        description: "Generate 2K hero product shot (uses product image as reference)",
        params: { aspect_ratio: "1:1", resolution: "2K" },
      },
      {
        id: "animate",
        tool: "generate_video",
        description: "Animate with Kling orbit shot",
        params: { mode: "broll", duration: 7 },
        dependsOn: ["hero-image"],
      },
      {
        id: "compose",
        tool: "compose_video",
        description: "Add brand text overlay and watermark",
        params: { brand_watermark: true, transition: "cut", aspect_ratio: "1:1" },
        dependsOn: ["animate"],
      },
    ],
  },
  {
    id: "product-in-context",
    name: "Product in Context",
    description:
      "Product placed in a lifestyle scene via AI, then animated with subtle motion. Uses edit endpoint for product accuracy.",
    category: "product",
    platform: "instagram",
    estimatedCredits: 23,
    estimatedDuration: "8-12s",
    aspectRatio: "4:5",
    icon: "🏠",
    steps: [
      {
        id: "lifestyle-image",
        tool: "generate_image",
        description: "Generate lifestyle scene with product via edit endpoint (reference_image_urls)",
        params: { aspect_ratio: "4:5", resolution: "2K" },
      },
      {
        id: "animate",
        tool: "generate_video",
        description: "Animate with subtle Kling motion (parallax, zoom)",
        params: { mode: "animate", duration: 5 },
        dependsOn: ["lifestyle-image"],
      },
    ],
  },
  {
    id: "product-comparison",
    name: "Product Comparison",
    description:
      "Side-by-side comparison: competitor problem vs your solution. Remotion renders the split-screen layout.",
    category: "product",
    platform: "all",
    estimatedCredits: 16,
    estimatedDuration: "10-15s",
    aspectRatio: "9:16",
    icon: "⚡",
    steps: [
      {
        id: "problem-image",
        tool: "generate_image",
        description: "Generate 'the problem' scene (desaturated, messy)",
        params: { aspect_ratio: "1:1", resolution: "1K" },
      },
      {
        id: "solution-image",
        tool: "generate_image",
        description: "Generate 'the solution' scene with product (warm, clean)",
        params: { aspect_ratio: "1:1", resolution: "1K" },
      },
      {
        id: "compose",
        tool: "compose_video",
        description: "Compose as split-screen with text labels and CTA",
        params: { transition: "cut", aspect_ratio: "9:16" },
        dependsOn: ["problem-image", "solution-image"],
      },
    ],
  },

  // === SOCIAL PROOF TEMPLATES ===
  {
    id: "testimonial-story",
    name: "Testimonial Story",
    description:
      "Character tells a customer testimonial with B-roll cutaways. Multi-scene composition.",
    category: "testimonial",
    platform: "all",
    estimatedCredits: 48,
    estimatedDuration: "25-35s",
    aspectRatio: "9:16",
    icon: "💬",
    steps: [
      {
        id: "script",
        tool: "write_script",
        description: "Write testimonial script with problem → discovery → results structure",
        params: { duration_seconds: 30, style: "casual", hook_type: "social_proof" },
      },
      {
        id: "character",
        tool: "generate_character",
        description: "Generate testimonial character",
        params: { style: "ugc_casual", pose: "upper_body", environment: "home" },
      },
      {
        id: "avatar",
        tool: "generate_avatar_video",
        description: "Generate talking head for main narrative",
        params: { talking_style: "expressive" },
        dependsOn: ["script", "character"],
      },
      {
        id: "broll",
        tool: "generate_video",
        description: "Generate product B-roll cutaway",
        params: { mode: "broll", duration: 5 },
      },
      {
        id: "compose",
        tool: "compose_video",
        description: "Compose avatar + B-roll with captions and transitions",
        params: { captions: true, transition: "crossfade", brand_watermark: true, aspect_ratio: "9:16" },
        dependsOn: ["avatar", "broll"],
      },
    ],
  },
  {
    id: "stats-proof",
    name: "Stats Proof",
    description:
      "Animated statistics with count-up effects and voiceover. Perfect for social proof and investor updates.",
    category: "social_proof",
    platform: "linkedin",
    estimatedCredits: 8,
    estimatedDuration: "8-12s",
    aspectRatio: "1:1",
    icon: "📊",
    steps: [
      {
        id: "motion",
        tool: "generate_motion_graphic",
        description: "Generate animated stat counter with brand colors",
        params: { type: "stat_counter", aspect_ratio: "1:1" },
      },
    ],
  },

  // === TECH/SaaS TEMPLATES ===
  {
    id: "feature-launch",
    name: "Feature Launch",
    description:
      "Animated feature highlight with staggered card entrance. Built with Remotion motion design — no AI model needed.",
    category: "tech",
    platform: "linkedin",
    estimatedCredits: 5,
    estimatedDuration: "10-15s",
    aspectRatio: "1:1",
    icon: "🚀",
    steps: [
      {
        id: "motion",
        tool: "generate_motion_graphic",
        description: "Generate feature highlight animation",
        params: { type: "feature_highlight", aspect_ratio: "1:1", style: "tech" },
      },
    ],
  },
  {
    id: "pitch-deck-video",
    name: "Pitch Deck Video",
    description:
      "Animated pitch deck slides with kinetic typography and data visualization. Perfect for investor updates and product launches.",
    category: "tech",
    platform: "youtube",
    estimatedCredits: 5,
    estimatedDuration: "15-30s",
    aspectRatio: "16:9",
    icon: "📑",
    steps: [
      {
        id: "motion",
        tool: "generate_motion_graphic",
        description: "Generate animated pitch deck",
        params: { type: "pitch_deck", aspect_ratio: "16:9", style: "startup" },
      },
    ],
  },
  {
    id: "kinetic-message",
    name: "Kinetic Message",
    description:
      "Bold kinetic typography delivering a key message line by line. High impact for short-form social content.",
    category: "tech",
    platform: "tiktok",
    estimatedCredits: 5,
    estimatedDuration: "6-10s",
    aspectRatio: "9:16",
    icon: "💥",
    steps: [
      {
        id: "motion",
        tool: "generate_motion_graphic",
        description: "Generate kinetic typography animation",
        params: { type: "kinetic_type", aspect_ratio: "9:16", style: "bold" },
      },
    ],
  },
  {
    id: "data-dashboard",
    name: "Data Dashboard",
    description:
      "Animated data visualization with count-up stats and brand colors. Great for quarterly reports and marketing metrics.",
    category: "tech",
    platform: "linkedin",
    estimatedCredits: 5,
    estimatedDuration: "8-12s",
    aspectRatio: "16:9",
    icon: "📈",
    steps: [
      {
        id: "motion",
        tool: "generate_motion_graphic",
        description: "Generate animated data dashboard",
        params: { type: "stat_counter", aspect_ratio: "16:9", style: "corporate" },
      },
    ],
  },

  // === HOOK TEMPLATES ===
  {
    id: "pov-hook",
    name: "POV Hook",
    description:
      "First-person POV video (Sora 2) with text overlay CTA. Pattern-breaking format for TikTok/Reels.",
    category: "hook",
    platform: "tiktok",
    estimatedCredits: 20,
    estimatedDuration: "5-8s",
    aspectRatio: "9:16",
    icon: "👁️",
    steps: [
      {
        id: "pov-video",
        tool: "generate_video",
        description: "Generate first-person POV clip with Sora 2",
        params: { mode: "ugc", duration: 8, aspect_ratio: "9:16" },
      },
      {
        id: "compose",
        tool: "compose_video",
        description: "Add text overlay and CTA",
        params: { transition: "cut", aspect_ratio: "9:16" },
        dependsOn: ["pov-video"],
      },
    ],
  },
  {
    id: "curiosity-gap",
    name: "Curiosity Gap",
    description:
      "Avatar hook → B-roll buildup → reveal with CTA. The open loop format that maximizes watch time.",
    category: "hook",
    platform: "tiktok",
    estimatedCredits: 43,
    estimatedDuration: "15-20s",
    aspectRatio: "9:16",
    icon: "🔮",
    steps: [
      {
        id: "character",
        tool: "generate_character",
        description: "Generate hook character",
        params: { style: "ugc_casual", pose: "upper_body" },
      },
      {
        id: "avatar-hook",
        tool: "generate_avatar_video",
        description: "Generate 5s hook: curiosity-inducing question",
        params: { talking_style: "expressive" },
        dependsOn: ["character"],
      },
      {
        id: "broll",
        tool: "generate_video",
        description: "Generate buildup B-roll",
        params: { mode: "broll", duration: 7 },
      },
      {
        id: "compose",
        tool: "compose_video",
        description: "Compose: hook → buildup → CTA with captions",
        params: { captions: true, transition: "crossfade", brand_watermark: true, aspect_ratio: "9:16" },
        dependsOn: ["avatar-hook", "broll"],
      },
    ],
  },
];

/**
 * Get templates filtered by category and/or platform.
 */
export function getTemplates(filters?: {
  category?: string;
  platform?: string;
}): VideoTemplate[] {
  let templates = VIDEO_TEMPLATES;

  if (filters?.category) {
    templates = templates.filter((t) => t.category === filters.category);
  }
  if (filters?.platform) {
    templates = templates.filter(
      (t) => t.platform === filters.platform || t.platform === "all"
    );
  }

  return templates;
}

/**
 * Get a single template by ID.
 */
export function getTemplateById(id: string): VideoTemplate | undefined {
  return VIDEO_TEMPLATES.find((t) => t.id === id);
}
