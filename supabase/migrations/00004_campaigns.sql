-- ============================================
-- TwinLink V2 — Phase D: Autonomous Campaigns
-- ============================================

-- CAMPAIGNS
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'briefing',
    -- briefing | planning | plan_review | approved | production | paused | completed | cancelled
  brief jsonb NOT NULL DEFAULT '{}',
  budget_credits integer NOT NULL DEFAULT 0,
  credits_used integer NOT NULL DEFAULT 0,
  credits_reserved integer NOT NULL DEFAULT 0,
  autonomy_level text NOT NULL DEFAULT 'semi',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_org ON campaigns(org_id, created_at DESC);
CREATE INDEX idx_campaigns_status ON campaigns(status);

-- CAMPAIGN ITEMS (each planned deliverable)
CREATE TABLE IF NOT EXISTS campaign_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  generation_id uuid REFERENCES generations(id) ON DELETE SET NULL,
  item_type text NOT NULL,
    -- static_image | ugc_video | carousel | avatar_video | broll_video | cinematic_video
  platform text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  creative_brief jsonb NOT NULL DEFAULT '{}',
  estimated_cost integer NOT NULL DEFAULT 0,
  actual_cost integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned',
    -- planned | approved | queued | in_production | completed | pending_review | approved_final | failed | cancelled
  sort_order integer NOT NULL DEFAULT 0,
  review_notes text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_items_campaign ON campaign_items(campaign_id, sort_order);
CREATE INDEX idx_campaign_items_status ON campaign_items(status);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read own campaigns"
  ON campaigns FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can manage own campaigns"
  ON campaigns FOR ALL
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can read own campaign items"
  ON campaign_items FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can manage own campaign items"
  ON campaign_items FOR ALL
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER campaign_items_updated_at BEFORE UPDATE ON campaign_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
