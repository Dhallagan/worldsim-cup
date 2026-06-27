# Supabase Player Import

Use this skill when importing real or CSV-based player ratings into Supabase.

## Goal

Turn raw football player rating data into normalized `players` rows that the tournament simulator can use.

## Target Table

`players`

Required fields:

- `id`
- `name`
- `source`

Useful fields:

- `team_id`
- `external_id`
- `nationality`
- `club`
- `position`
- `overall`
- `pace`
- `shooting`
- `passing`
- `dribbling`
- `defending`
- `physical`
- `potential`

## Normalization Rules

- Preserve numeric ratings exactly when provided by a source dataset.
- Convert empty strings to `null`.
- Clamp generated ratings to `0-99`.
- Normalize positions to short labels when possible: `GK`, `CB`, `LB`, `RB`, `CDM`, `CM`, `CAM`, `LW`, `RW`, `ST`.
- Store the original dataset identifier in `external_id` when available.
- Store dataset provenance in `source`, for example `ea-fc-csv`, `api-football`, `manual`, or `generated`.

## Import Procedure

1. Inspect the source columns before mapping.
2. Create a field mapping from source columns to `players`.
3. Validate that each row has at least `id` or `external_id`, `name`, and `source`.
4. Deduplicate by `external_id` first, then by normalized `name + club + position`.
5. Use Supabase `upsert` with a stable conflict target.
6. Report counts for inserted, updated, skipped, and invalid rows.

## Missing Data

If ratings are missing:

- Do not invent values for imported real players unless the user asks.
- Keep missing ratings as `null`.
- If generated fallback players are needed, mark `source = generated`.
