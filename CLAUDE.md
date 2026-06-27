# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**WorldSim Cup** (package name `fifa-hack`) — an AI **odds engine** answering "can the USA win the World Cup?" It Monte Carlo–simulates USA's fixed knockout gauntlet (Bosnia R32 → Belgium R16 → Spain QF → France SF → Argentina Final) to produce per-round win % + cumulative title odds (~1.2%), framed as a **MiroFish** swarm with a 5-stage agent lifecycle. Built for a Vercel hackathon; all five sponsors (Vercel, Anthropic, Supabase, Auth0, Resend) are wired.

Core flow: hit **Run the swarm** → `app/api/agent/route.ts` runs the MiroFish lifecycle (Graph Building → Environment Setup → Simulation Execution → Report Generation → Complete) and **streams NDJSON** consumed by `app/components/Dashboard.tsx`, which drives a split-screen **AgentConsole** + FIFA-match-center UI (path/odds, live match replay modal, persona cards).

Key principle: **agents narrate, deterministic code computes.** The odds come from a seeded Monte Carlo (`lib/sim/montecarlo.ts` + `lib/sim/engine.ts`, mulberry32 RNG) — NOT from the LLM. Claude (**Haiku** via `lib/ai.ts`) generates player personas (`lib/personas.ts`) and the ReportAgent verdict (`lib/report.ts`), each with a deterministic **template fallback** so the app runs with no API key. Persistence (`lib/persist.ts` → Supabase `sim_runs`, schema `supabase/worldsim.sql`) and recap email (`lib/recap.ts` → Resend) are best-effort and surfaced as agent tool events. Auth0 is non-blocking (`proxy.ts` guards on `hasAuth0Config`; set `DEMO_BYPASS=1`). The original concept notes are in `brainstorm/`.

## Commands

```bash
npm run dev     # next dev — local dev server at http://localhost:3000
npm run build   # next build
npm run start   # next start — serve production build
npm run lint    # next lint (eslint-config-next)
```

There is no test framework configured yet. Not a git repository.

## Architecture

Next.js 16 (App Router) + React 19, TypeScript strict mode. Import alias `@/*` maps to the repo root (e.g. `@/lib/auth0`).

The app integrates five external services, each isolated behind a thin client module in `lib/` (plus the agent):

- **Auth0** (`lib/auth0.ts`) — session/login via `@auth0/nextjs-auth0`. Enforced globally by `proxy.ts`, which runs `auth0.middleware` on all routes except static assets. Server components read the session with `auth0.getSession()`.
- **Supabase** (`lib/supabase.ts`) — primary datastore. `createSupabaseAdmin()` returns a service-role client (server-only, no session persistence). The full relational schema lives in `supabase/schema.sql`: `tournaments → teams → players` and `matches → match_events`, all keyed by text IDs with cascade deletes.
- **Resend** (`lib/resend.ts`) — `createResend()` for champion/recap emails.
- **Vercel AI SDK** (`ai`, `@ai-sdk/anthropic`) — commentary and structured generation. Model is set via `AI_MODEL` env (default `anthropic/claude-sonnet-4.6`), routed through the Vercel AI Gateway (`AI_GATEWAY_API_KEY`).
- **Eve agent** (`agent/agent.ts`, `agent/instructions.md`) — the durable "tournament director" agent (Vercel `eve`). `instructions.md` defines its operating rules: use deterministic tools/DB writes for tournament *state*, use language generation only for flavor (rosters, commentary, summaries, recaps), and **never alter final scores after the simulator produces them**.

The `lib/` clients follow a consistent pattern: a `createX()` factory that throws if required env vars are missing, plus a `hasXConfig()` predicate so callers can degrade gracefully when a service isn't configured. Follow this pattern when adding new service integrations.

## Environment

Copy `.env.example` to `.env.local` and fill in credentials for Auth0, Supabase, Resend, and the AI gateway/Anthropic. Generate `AUTH0_SECRET` with `openssl rand -hex 32`. The app expects these to be set; `lib/` factories throw on missing config.

## Conventions

- Tournament/team/player/match IDs are application-generated `text` primary keys, not DB-generated UUIDs (see `supabase/schema.sql`).
- Per the agent contract: structured match facts (scores, events) come from deterministic code; LLM output is for narrative copy only and must not mutate those facts.
