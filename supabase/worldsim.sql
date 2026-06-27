-- WorldSim Cup — run this once in the Supabase SQL editor to enable persistence.
-- Stores each MiroFish swarm run: the odds report, the featured playthrough, and the verdict.

create table if not exists sim_runs (
  id uuid primary key default gen_random_uuid(),
  title_pct numeric not null,
  runs int not null,
  champion boolean not null default false,
  rounds jsonb not null,
  playthrough jsonb,
  report text,
  created_at timestamptz not null default now()
);

-- Service-role writes from the server bypass RLS; enable it so anon stays locked down.
alter table sim_runs enable row level security;
