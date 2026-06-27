# Part Two Build Plan

## Product

WorldSim Cup is a full AI-assisted soccer tournament simulator. The app creates rosters, simulates a full tournament, streams match events, stores results in Supabase, and sends recap emails.

## Stack

- Next.js on Vercel for the dashboard and API routes.
- Vercel Eve for the durable tournament director agent.
- Vercel AI SDK for commentary and structured generation.
- Supabase for tournaments, teams, players, matches, and events.
- Auth0 for user login.
- Resend for champion and tournament recap emails.

## Demo Flow

1. User signs in with Auth0.
2. User opens the WorldSim Cup dashboard.
3. App shows an 8-team tournament with two groups.
4. Simulator runs 12 group matches, 2 semifinals, and 1 final.
5. Supabase stores the tournament state.
6. AI SDK generates live commentary and recap copy.
7. Resend sends the tournament recap.
