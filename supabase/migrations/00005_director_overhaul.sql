-- Phase A of director overhaul:
-- 1. Drop peripheral tables (MENA/UGC era, content planning, social scheduling, competitor research)
--    Guarded — only drops if the table is empty so no user work is lost.
-- 2. Extend generation_assets for @tag protocol, parent/variant tracking, and asset_role classification.

-- =============================================================================
-- 1. Drop peripheral tables if empty
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'post_metrics')
     AND NOT EXISTS (SELECT 1 FROM post_metrics LIMIT 1) THEN
    DROP TABLE post_metrics CASCADE;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'scheduled_posts')
     AND NOT EXISTS (SELECT 1 FROM scheduled_posts LIMIT 1) THEN
    DROP TABLE scheduled_posts CASCADE;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'platform_connections')
     AND NOT EXISTS (SELECT 1 FROM platform_connections LIMIT 1) THEN
    DROP TABLE platform_connections CASCADE;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaign_items')
     AND NOT EXISTS (SELECT 1 FROM campaign_items LIMIT 1) THEN
    DROP TABLE campaign_items CASCADE;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaigns')
     AND NOT EXISTS (SELECT 1 FROM campaigns LIMIT 1) THEN
    DROP TABLE campaigns CASCADE;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'competitor_ads')
     AND NOT EXISTS (SELECT 1 FROM competitor_ads LIMIT 1) THEN
    DROP TABLE competitor_ads CASCADE;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'competitor_profiles')
     AND NOT EXISTS (SELECT 1 FROM competitor_profiles LIMIT 1) THEN
    DROP TABLE competitor_profiles CASCADE;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'characters')
     AND NOT EXISTS (SELECT 1 FROM characters LIMIT 1) THEN
    DROP TABLE characters CASCADE;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'video_templates')
     AND NOT EXISTS (SELECT 1 FROM video_templates LIMIT 1) THEN
    DROP TABLE video_templates CASCADE;
  END IF;
END $$;

-- =============================================================================
-- 2. Extend generation_assets for the new methodology
-- =============================================================================

ALTER TABLE generation_assets
  ADD COLUMN IF NOT EXISTS tag text,                          -- @tag for cross-reference ("@orlando", "@bathroom_wide")
  ADD COLUMN IF NOT EXISTS parent_asset_id uuid REFERENCES generation_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS asset_role text,                   -- 'plate' | 'keyframe' | 'shot' | 'final' | 'music' | 'voiceover'
  ADD COLUMN IF NOT EXISTS prediction_id text,                -- Replicate prediction ID for webhook routing
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'ready';       -- 'pending' | 'ready' | 'failed'

-- @tag must be unique per generation
CREATE UNIQUE INDEX IF NOT EXISTS idx_generation_assets_tag_unique
  ON generation_assets(generation_id, tag)
  WHERE tag IS NOT NULL;

-- Fast lookup by role
CREATE INDEX IF NOT EXISTS idx_generation_assets_role
  ON generation_assets(generation_id, asset_role);

-- Fast webhook lookup by prediction id
CREATE INDEX IF NOT EXISTS idx_generation_assets_prediction_id
  ON generation_assets(prediction_id)
  WHERE prediction_id IS NOT NULL;

-- Variants traversal
CREATE INDEX IF NOT EXISTS idx_generation_assets_parent
  ON generation_assets(parent_asset_id)
  WHERE parent_asset_id IS NOT NULL;
