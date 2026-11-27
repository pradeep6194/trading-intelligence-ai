-- Run this once in Supabase SQL Editor.
create table if not exists public.trading_state (
  id integer primary key check (id = 1),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.trading_state enable row level security;
-- Do not create anon/authenticated policies. The worker and server use the service-role key only.
