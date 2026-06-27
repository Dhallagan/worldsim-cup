# Supabase Troubleshooting

Use this skill when Supabase reads or writes fail.

## Checks

1. Confirm `NEXT_PUBLIC_SUPABASE_URL` is set.
2. Confirm the operation is server-side before using `SUPABASE_SERVICE_ROLE_KEY`.
3. Confirm `SUPABASE_SERVICE_ROLE_KEY` is set for admin writes.
4. Confirm the target table exists in `supabase/schema.sql`.
5. Confirm foreign keys are written in order.

## Common Failures

### Missing Environment Variables

Return a clear setup message and point to `.env.example`.

### Foreign Key Error

Write parent rows first:

- tournament before teams
- teams before matches
- matches before match events

### Row Level Security Error

For hackathon backend writes, use the server-side admin client from `lib/supabase.ts`. Do not move the service role key into browser code.

### Duplicate Key Error

Prefer stable IDs and `upsert` for generated or imported entities.

### Bad Rating Data

Reject non-numeric rating values unless they can be safely parsed. Keep unknown values as `null`.
