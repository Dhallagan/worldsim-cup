create table if not exists tournaments (
  id text primary key,
  name text not null,
  status text not null default 'draft',
  champion_team_id text,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id text primary key,
  tournament_id text not null references tournaments(id) on delete cascade,
  name text not null,
  city text,
  color text,
  group_name text,
  created_at timestamptz not null default now()
);

create table if not exists players (
  id text primary key,
  team_id text references teams(id) on delete set null,
  external_id text,
  name text not null,
  nationality text,
  club text,
  position text,
  overall int,
  pace int,
  shooting int,
  passing int,
  dribbling int,
  defending int,
  physical int,
  potential int,
  source text not null default 'demo',
  created_at timestamptz not null default now()
);

create table if not exists matches (
  id text primary key,
  tournament_id text not null references tournaments(id) on delete cascade,
  stage text not null,
  home_team_id text not null references teams(id),
  away_team_id text not null references teams(id),
  home_goals int not null default 0,
  away_goals int not null default 0,
  played_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists match_events (
  id bigint generated always as identity primary key,
  match_id text not null references matches(id) on delete cascade,
  minute int not null,
  type text not null,
  team_id text references teams(id),
  player_name text,
  text text not null,
  created_at timestamptz not null default now()
);
