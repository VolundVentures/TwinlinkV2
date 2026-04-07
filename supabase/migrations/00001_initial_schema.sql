-- ============================================
-- TwinLink V2 — Initial Schema
-- ============================================

-- ORGANIZATIONS
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'free',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- USERS
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  email text unique not null,
  name text,
  role text not null default 'member',
  avatar_url text,
  preferred_language text not null default 'en',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_users_org on users(org_id);

-- BRANDS
create table brands (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  logo_url text,
  website_url text,
  description text,
  primary_color text,
  secondary_color text,
  accent_color text,
  font_family text,
  industry text,
  target_audience text,
  brand_voice text,
  products jsonb not null default '[]',
  scraped_data jsonb not null default '{}',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_brands_org on brands(org_id);

-- GENERATIONS
create type generation_type as enum (
  'static_ad', 'video_ad', 'ugc_video', 'campaign', 'script', 'competitor_research'
);

create type generation_status as enum (
  'queued', 'processing', 'generating', 'completed', 'failed', 'cancelled'
);

create table generations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id),
  brand_id uuid references brands(id) on delete set null,
  type generation_type not null,
  status generation_status not null default 'queued',
  title text,
  language text not null default 'en',
  prompt text,
  agent_config jsonb not null default '{}',
  creative_brief jsonb not null default '{}',
  credits_used integer not null default 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_generations_org on generations(org_id, created_at desc);
create index idx_generations_user on generations(user_id, created_at desc);

-- GENERATION ASSETS
create type asset_type as enum ('image', 'video', 'audio', 'script', 'thumbnail');
create type aspect_ratio as enum ('1:1', '4:5', '9:16', '16:9');

create table generation_assets (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references generations(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  type asset_type not null,
  aspect_ratio aspect_ratio,
  storage_path text not null,
  public_url text,
  thumbnail_url text,
  file_size_bytes bigint,
  duration_seconds float,
  width integer,
  height integer,
  metadata jsonb not null default '{}',
  creative_rationale text,
  variant_number integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_assets_generation on generation_assets(generation_id);

-- AGENT SESSIONS
create table agent_sessions (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references generations(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id),
  current_step integer not null default 0,
  total_steps integer not null default 4,
  status text not null default 'active',
  messages jsonb not null default '[]',
  step_results jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CHARACTERS (AI avatars)
create table characters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  description text,
  voice_id text,
  voice_provider text not null default 'elevenlabs',
  thumbnail_url text,
  preview_video_url text,
  language text not null default 'en',
  gender text,
  age_range text,
  style text,
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_characters_org on characters(org_id);
create index idx_characters_language on characters(language);

-- VIDEO TEMPLATES
create table video_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null default 'ugc',
  thumbnail_url text,
  preview_url text,
  aspect_ratio aspect_ratio not null default '9:16',
  duration_range text,
  steps jsonb not null default '{}',
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);

-- COMPETITOR PROFILES
create table competitor_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  website_url text,
  meta_page_id text,
  logo_url text,
  industry text,
  analysis jsonb not null default '{}',
  ad_count integer not null default 0,
  avg_score float,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_competitors_org on competitor_profiles(org_id);

-- COMPETITOR ADS
create table competitor_ads (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitor_profiles(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  meta_ad_id text,
  creative_url text,
  ad_type text,
  body_text text,
  headline text,
  cta text,
  score integer,
  analysis jsonb not null default '{}',
  started_running timestamptz,
  created_at timestamptz not null default now()
);

-- CREDIT BALANCES
create table credit_balances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid unique not null references organizations(id) on delete cascade,
  balance integer not null default 500,
  updated_at timestamptz not null default now()
);

-- CREDIT TRANSACTIONS
create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  amount integer not null,
  type text not null,
  description text,
  balance_after integer not null,
  created_at timestamptz not null default now()
);

create index idx_credit_tx_org on credit_transactions(org_id, created_at desc);

-- COLLECTIONS (asset organization)
create table collections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table collection_assets (
  collection_id uuid not null references collections(id) on delete cascade,
  asset_id uuid not null references generation_assets(id) on delete cascade,
  primary key (collection_id, asset_id)
);

-- ============================================
-- RLS POLICIES
-- ============================================

alter table organizations enable row level security;
alter table users enable row level security;
alter table brands enable row level security;
alter table generations enable row level security;
alter table generation_assets enable row level security;
alter table agent_sessions enable row level security;
alter table characters enable row level security;
alter table video_templates enable row level security;
alter table competitor_profiles enable row level security;
alter table competitor_ads enable row level security;
alter table credit_balances enable row level security;
alter table credit_transactions enable row level security;
alter table collections enable row level security;

-- Org members can read their own org data
create policy "Org members can read own org"
  on organizations for select
  using (id in (select org_id from users where id = auth.uid()));

create policy "Org members can read own users"
  on users for select
  using (org_id in (select org_id from users where id = auth.uid()));

create policy "Org members can read own brands"
  on brands for select
  using (org_id in (select org_id from users where id = auth.uid()));

create policy "Org members can manage own brands"
  on brands for all
  using (org_id in (select org_id from users where id = auth.uid()));

create policy "Org members can read own generations"
  on generations for select
  using (org_id in (select org_id from users where id = auth.uid()));

create policy "Org members can read own assets"
  on generation_assets for select
  using (org_id in (select org_id from users where id = auth.uid()));

create policy "Org members can read own sessions"
  on agent_sessions for select
  using (org_id in (select org_id from users where id = auth.uid()));

create policy "Anyone can read global characters"
  on characters for select
  using (org_id is null);

create policy "Org members can read own characters"
  on characters for select
  using (org_id in (select org_id from users where id = auth.uid()));

create policy "Authenticated users can read templates"
  on video_templates for select
  using (true);

create policy "Org members can read own competitors"
  on competitor_profiles for select
  using (org_id in (select org_id from users where id = auth.uid()));

create policy "Org members can read own competitor ads"
  on competitor_ads for select
  using (org_id in (select org_id from users where id = auth.uid()));

create policy "Org members can read credit balance"
  on credit_balances for select
  using (org_id in (select org_id from users where id = auth.uid()));

create policy "Org members can read credit transactions"
  on credit_transactions for select
  using (org_id in (select org_id from users where id = auth.uid()));

create policy "Org members can read own collections"
  on collections for select
  using (org_id in (select org_id from users where id = auth.uid()));

-- Enable Realtime for agent sessions
alter publication supabase_realtime add table agent_sessions;

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger organizations_updated_at before update on organizations
  for each row execute function update_updated_at();
create trigger users_updated_at before update on users
  for each row execute function update_updated_at();
create trigger brands_updated_at before update on brands
  for each row execute function update_updated_at();
create trigger generations_updated_at before update on generations
  for each row execute function update_updated_at();
create trigger competitor_profiles_updated_at before update on competitor_profiles
  for each row execute function update_updated_at();
create trigger credit_balances_updated_at before update on credit_balances
  for each row execute function update_updated_at();
create trigger collections_updated_at before update on collections
  for each row execute function update_updated_at();
