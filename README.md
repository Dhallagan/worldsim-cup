# WorldSim Cup

Hackathon boilerplate for an AI-assisted soccer tournament simulator.

## Stack

- Next.js 16
- Vercel Eve
- Vercel AI SDK
- Supabase
- Auth0
- Resend

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Eve currently requires Node 24 or newer. The project declares this in `package.json`.

## Environment

Fill in `.env.local` from `.env.example`.

Auth0 needs:

- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_SECRET`
- `APP_BASE_URL`

Supabase needs:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Resend needs:

- `RESEND_API_KEY`
- `RESEND_FROM`

## Database

Run [schema.sql](/Users/dylan/Development/FIFAHack/supabase/schema.sql) in Supabase SQL Editor to create the starter tournament tables.
