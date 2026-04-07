-- ============================================
-- TwinLink V2 — Phase C: Calendar & Publishing
-- ============================================

-- SCHEDULED POSTS
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  generation_id uuid REFERENCES generations(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES generation_assets(id) ON DELETE SET NULL,
  platform text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  published_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  caption text,
  hashtags text[],
  post_type text NOT NULL DEFAULT 'image',
  carousel_slides jsonb,
  platform_post_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_posts_org ON scheduled_posts(org_id, scheduled_at);
CREATE INDEX idx_scheduled_posts_status ON scheduled_posts(status);

-- PLATFORM CONNECTIONS
CREATE TABLE IF NOT EXISTS platform_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  account_name text,
  account_id text,
  account_avatar_url text,
  scopes text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, platform, account_id)
);

CREATE INDEX idx_platform_connections_org ON platform_connections(org_id);

-- POST METRICS
CREATE TABLE IF NOT EXISTS post_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES scheduled_posts(id) ON DELETE CASCADE,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  saves integer DEFAULT 0,
  clicks integer DEFAULT 0,
  video_views integer DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_metrics_post ON post_metrics(post_id);

-- MARKET EVENTS
CREATE TABLE IF NOT EXISTS market_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  event_type text,
  market text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_market_events_org ON market_events(org_id, event_date);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read own scheduled posts"
  ON scheduled_posts FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can manage own scheduled posts"
  ON scheduled_posts FOR ALL
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can read own platform connections"
  ON platform_connections FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can manage own platform connections"
  ON platform_connections FOR ALL
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can read own post metrics"
  ON post_metrics FOR SELECT
  USING (post_id IN (
    SELECT id FROM scheduled_posts
    WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "Org members can read own market events"
  ON market_events FOR SELECT
  USING (
    org_id IS NULL
    OR org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

CREATE TRIGGER platform_connections_updated_at BEFORE UPDATE ON platform_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
