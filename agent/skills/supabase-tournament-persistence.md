# Supabase Tournament Persistence

Use this skill when saving tournament state, match results, or event streams to Supabase.

## Goal

Persist the structured state of a WorldSim Cup tournament without relying on generated text as source of truth.

## Tables

- `tournaments`: one row per tournament.
- `teams`: teams participating in a tournament.
- `players`: player profiles and ratings.
- `matches`: scheduled or completed matches.
- `match_events`: minute-by-minute events for a match.

## Write Order

1. Upsert `tournaments`.
2. Upsert `teams` with `tournament_id`.
3. Upsert or assign `players` with `team_id`.
4. Upsert `matches` with team references.
5. Insert `match_events` after the match row exists.

## Event Rules

Each `match_events` row must include:

- `match_id`
- `minute`
- `type`
- `text`

Use `team_id` and `player_name` when available.

## Consistency Rules

- The deterministic simulator owns scores, winners, standings, and bracket advancement.
- AI commentary may describe events but must not create different scores or winners.
- If an event changes the score, ensure the final `matches.home_goals` and `matches.away_goals` agree with the event log.
- For knockout matches, persist the resolved winner through the match score, not through prose.

## Status Values

Recommended `tournaments.status` values:

- `draft`
- `scheduled`
- `running`
- `simulated`
- `complete`
- `archived`
