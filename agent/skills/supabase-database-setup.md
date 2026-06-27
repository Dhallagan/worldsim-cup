# Supabase Database Setup

Use this skill when setting up or checking the WorldSim Cup Supabase database.

## Goal

Prepare the database so the app can store tournaments, teams, players, matches, and streamed match events.

## Required Environment

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Use the service role key only in server-side code, API routes, Eve tools, or local scripts. Never expose it to client components.

## Schema Source

The canonical starter schema is `supabase/schema.sql`.

Before writing database code, confirm the target tables exist:

- `tournaments`
- `teams`
- `players`
- `matches`
- `match_events`

## Setup Procedure

1. Ask the operator to run `supabase/schema.sql` in the Supabase SQL Editor if tables do not exist.
2. Confirm environment variables are present.
3. Use `createSupabaseAdmin()` from `lib/supabase.ts` for privileged server-side operations.
4. Prefer `upsert` for seeded or imported records with stable IDs.
5. Return a short summary of rows created or updated.

## Safety Rules

- Do not run destructive operations unless the user explicitly requests them.
- Do not delete player, team, match, or event data during setup.
- Do not invent table names; use the schema in this repository.
- Do not write generated player ratings into the database without setting `source` to a clear value such as `generated`, `csv-import`, or `demo`.
