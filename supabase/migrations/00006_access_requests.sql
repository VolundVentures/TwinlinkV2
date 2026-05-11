-- Access request form submissions from the marketing landing page.
-- Anonymous visitors submit name / email / company / role / use case.
-- Inserts are performed server-side with the service role, so RLS stays off
-- for writes — nothing else (including the anon key) can read or write.

create table if not exists public.access_requests (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text not null,
  email        text not null,
  company      text,
  role         text,
  use_case     text,
  referrer     text,
  user_agent   text,
  ip_hash      text,
  status       text not null default 'new',
  constraint access_requests_email_valid check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create index if not exists access_requests_created_at_idx
  on public.access_requests (created_at desc);

create unique index if not exists access_requests_email_lower_idx
  on public.access_requests ((lower(email)));

alter table public.access_requests enable row level security;

-- No policies → anon + authenticated cannot select/insert.
-- The /api/access-requests route uses the service role key which bypasses RLS.
