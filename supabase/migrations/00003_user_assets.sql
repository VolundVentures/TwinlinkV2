-- User-uploaded assets (images, videos, audio)
create table if not exists user_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null,
  name text not null default 'Untitled',
  type text not null default 'image', -- image, video, audio
  url text not null,
  storage_path text,
  file_size bigint,
  mime_type text,
  source text default 'upload', -- upload, chat, generation
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table user_assets enable row level security;

create policy "Users can view org assets" on user_assets
  for select using (org_id = (select org_id from users where id = auth.uid()));

create policy "Users can insert org assets" on user_assets
  for insert with check (org_id = (select org_id from users where id = auth.uid()));

create policy "Users can delete org assets" on user_assets
  for delete using (org_id = (select org_id from users where id = auth.uid()));

-- Index
create index if not exists idx_user_assets_org on user_assets(org_id);
create index if not exists idx_user_assets_type on user_assets(org_id, type);
