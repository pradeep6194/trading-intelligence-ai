create table if not exists public.option_greek_snapshots (
  snapshot_at timestamptz not null,
  underlying_key text not null,
  expiry date not null,
  instrument_key text not null,
  option_type text not null check (option_type in ('CE','PE')),
  strike numeric not null,
  spot numeric,
  ltp numeric,
  bid numeric,
  ask numeric,
  volume bigint,
  oi bigint,
  iv numeric,
  delta numeric,
  gamma numeric,
  theta numeric,
  vega numeric,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (snapshot_at, instrument_key)
);

create index if not exists option_greek_snapshots_underlying_expiry_time_idx
  on public.option_greek_snapshots (underlying_key, expiry, snapshot_at desc);
create index if not exists option_greek_snapshots_instrument_time_idx
  on public.option_greek_snapshots (instrument_key, snapshot_at desc);

alter table public.option_greek_snapshots enable row level security;
