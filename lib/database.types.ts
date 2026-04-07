export type GenerationType =
  | "static_ad"
  | "video_ad"
  | "ugc_video"
  | "campaign"
  | "script"
  | "competitor_research";

export type GenerationStatus =
  | "queued"
  | "processing"
  | "generating"
  | "completed"
  | "failed"
  | "cancelled";

export type AssetType = "image" | "video" | "audio" | "script" | "thumbnail";

export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type User = {
  id: string;
  org_id: string;
  email: string;
  name: string | null;
  role: string;
  avatar_url: string | null;
  preferred_language: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Brand = {
  id: string;
  org_id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  description: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_family: string | null;
  industry: string | null;
  target_audience: string | null;
  brand_voice: string | null;
  products: Array<{
    name: string;
    description: string;
    image_url?: string;
    type?: string;
  }>;
  scraped_data: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type Generation = {
  id: string;
  org_id: string;
  user_id: string;
  brand_id: string | null;
  type: GenerationType;
  status: GenerationStatus;
  title: string | null;
  language: string;
  prompt: string | null;
  agent_config: Record<string, unknown>;
  creative_brief: Record<string, unknown>;
  credits_used: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GenerationAsset = {
  id: string;
  generation_id: string;
  org_id: string;
  type: AssetType;
  aspect_ratio: AspectRatio | null;
  storage_path: string;
  public_url: string | null;
  thumbnail_url: string | null;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  metadata: Record<string, unknown>;
  creative_rationale: string | null;
  variant_number: number;
  created_at: string;
};

export type AgentSession = {
  id: string;
  generation_id: string;
  org_id: string;
  user_id: string;
  current_step: number;
  total_steps: number;
  status: string;
  messages: Array<{
    role: "user" | "agent" | "system";
    content: string;
    timestamp: string;
  }>;
  step_results: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Character = {
  id: string;
  org_id: string | null;
  name: string;
  description: string | null;
  voice_id: string | null;
  voice_provider: string;
  thumbnail_url: string | null;
  preview_video_url: string | null;
  language: string;
  gender: string | null;
  age_range: string | null;
  style: string | null;
  is_premium: boolean;
  created_at: string;
};

export type VideoTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  thumbnail_url: string | null;
  preview_url: string | null;
  aspect_ratio: AspectRatio;
  duration_range: string | null;
  steps: Record<string, unknown>;
  is_premium: boolean;
  created_at: string;
};

export type CreditBalance = {
  id: string;
  org_id: string;
  balance: number;
  updated_at: string;
};

export type CreditTransaction = {
  id: string;
  org_id: string;
  amount: number;
  type: string;
  description: string | null;
  balance_after: number;
  created_at: string;
};

export type CompetitorProfile = {
  id: string;
  org_id: string;
  name: string;
  website_url: string | null;
  meta_page_id: string | null;
  logo_url: string | null;
  industry: string | null;
  analysis: Record<string, unknown>;
  ad_count: number;
  avg_score: number | null;
  created_at: string;
  updated_at: string;
};

// ────── Campaigns ──────

export type CampaignStatus =
  | "briefing" | "planning" | "plan_review" | "approved"
  | "production" | "paused" | "completed" | "cancelled";

export type CampaignItemStatus =
  | "planned" | "approved" | "queued" | "in_production"
  | "completed" | "pending_review" | "approved_final" | "failed" | "cancelled";

export type CampaignBrief = {
  budget: number;
  timeframe_start: string;
  timeframe_end: string;
  goals: string[];
  platforms: string[];
  content_mix: "image_heavy" | "video_focused" | "balanced" | "custom";
  key_dates: Array<{ date: string; label: string }>;
  product_ids: string[];
  notes: string;
};

export type Campaign = {
  id: string;
  org_id: string;
  user_id: string;
  brand_id: string;
  name: string;
  status: CampaignStatus;
  brief: CampaignBrief;
  budget_credits: number;
  credits_used: number;
  credits_reserved: number;
  autonomy_level: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignItem = {
  id: string;
  campaign_id: string;
  org_id: string;
  generation_id: string | null;
  item_type: string;
  platform: string;
  scheduled_at: string;
  creative_brief: Record<string, unknown>;
  estimated_cost: number;
  actual_cost: number;
  status: CampaignItemStatus;
  sort_order: number;
  review_notes: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type CompetitorAd = {
  id: string;
  competitor_id: string;
  org_id: string;
  meta_ad_id: string | null;
  creative_url: string | null;
  ad_type: string | null;
  body_text: string | null;
  headline: string | null;
  cta: string | null;
  score: number | null;
  analysis: Record<string, unknown>;
  started_running: string | null;
  created_at: string;
};
