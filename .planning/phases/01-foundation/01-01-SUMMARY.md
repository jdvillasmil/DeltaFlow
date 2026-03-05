---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [nextjs, typescript, tailwind, shadcn, supabase, vitest, vercel]

# Dependency graph
requires: []
provides:
  - Next.js 15 project scaffold with TypeScript strict mode
  - Tailwind CSS v4 configured with @tailwindcss/postcss
  - shadcn/ui initialized (Slate style, CSS variables)
  - Server-side Supabase client (supabaseAdmin) enforcing pooler URL
  - Browser-side Supabase client (createSupabaseBrowserClient)
  - /api/health route for daily keep-alive cron
  - vercel.json with daily cron schedule
  - Vitest test framework with .env.local loading
  - Pooler URL enforcement test (TDD, GREEN)
affects: [all subsequent phases, 01-02, 01-03]

# Tech tracking
tech-stack:
  added:
    - next@15.5.12
    - react@19.2.4
    - react-dom@19.2.4
    - typescript@5.9.3
    - tailwindcss@4.2.1
    - "@tailwindcss/postcss@4.2.1"
    - "@supabase/supabase-js@2.98.0"
    - "@supabase/ssr@0.9.0"
    - decimal.js@10.6.0
    - cheerio@1.2.0
    - uuid@13.0.0
    - date-fns@4.1.0
    - server-only@0.0.1
    - vitest@4.0.18
    - "@vitejs/plugin-react@5.1.4"
    - "@testing-library/react@16.3.2"
    - "@testing-library/jest-dom@6.9.1"
  patterns:
    - Server-side Supabase via module-scope createClient (pooler URL)
    - Browser-side Supabase via createBrowserClient from @supabase/ssr
    - TDD for infrastructure invariants (pooler URL test)
    - Test setup file loads .env.local for local test runs

key-files:
  created:
    - src/lib/supabase/server.ts
    - src/lib/supabase/client.ts
    - src/app/api/health/route.ts
    - src/app/layout.tsx
    - src/app/page.tsx
    - src/app/globals.css
    - src/components/ui/button.tsx
    - src/tests/supabase-client.test.ts
    - src/tests/setup.ts
    - vitest.config.ts
    - tsconfig.json
    - next.config.ts
    - postcss.config.mjs
    - vercel.json
    - components.json
    - .env.local
  modified:
    - package.json

key-decisions:
  - "Supabase pooler URL (port 6543) enforced from day one via TDD test — prevents connection exhaustion"
  - "vitest.config.ts uses setupFiles to load .env.local — mirrors Next.js dev behavior in tests"
  - "health route uses force-dynamic to prevent static caching of keep-alive response"
  - "shadcn/ui initialized with Slate style + CSS variables (default; can override per-component)"

patterns-established:
  - "Pattern 1: TDD for infrastructure invariants — write test first, implement, verify GREEN"
  - "Pattern 2: server-only import in server.ts prevents accidental client import"
  - "Pattern 3: module-scope supabaseAdmin singleton reused across warm Vercel invocations"

requirements-completed: []

# Metrics
duration: 10min
completed: 2026-03-05
---

# Phase 1 Plan 01: Next.js 15 Scaffold + Supabase Client Setup Summary

**Next.js 15 project with TypeScript, Tailwind v4, shadcn/ui, Supabase pooler-URL-enforced clients, Vitest, and daily health cron deployed to Vercel**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-05T14:22:43Z
- **Completed:** 2026-03-05T14:33:00Z
- **Tasks:** 1 of 2 complete (Task 2 is checkpoint:human-verify for Vercel deployment)
- **Files modified:** 17

## Accomplishments

- Next.js 15 project scaffolded with TypeScript strict mode, compiles with zero errors
- Supabase server client created with pooler URL enforcement and `server-only` guard
- Supabase browser client created using `@supabase/ssr` for App Router compatibility
- Vitest configured with TDD red-green cycle; both pooler URL tests pass (GREEN)
- shadcn/ui initialized with Slate style; Button component installed and validated
- `/api/health` route created for daily Vercel cron keep-alive ping
- `vercel.json` configured with daily cron (0 8 * * *) — Hobby plan limitation respected

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing pooler URL tests** - `b011563` (test)
2. **Task 1 (GREEN): Full project scaffold** - `cd33721` (feat)

**Awaiting:** Task 2 (checkpoint:human-verify) — Vercel deployment with real env vars

## Files Created/Modified

- `src/lib/supabase/server.ts` - Server-side Supabase admin client (service role, pooler URL)
- `src/lib/supabase/client.ts` - Browser-side Supabase client (anon key, SSR-compatible)
- `src/app/api/health/route.ts` - Daily keep-alive endpoint for Vercel cron
- `src/app/layout.tsx` - Root layout with Tailwind globals import
- `src/app/page.tsx` - Placeholder page returning "DeltaFlow — foundation"
- `src/app/globals.css` - Tailwind v4 import + shadcn/ui design tokens
- `src/components/ui/button.tsx` - shadcn/ui Button component (validates shadcn works)
- `src/tests/supabase-client.test.ts` - Pooler URL enforcement tests (2 tests, both pass)
- `src/tests/setup.ts` - Vitest setup file that loads .env.local for local test runs
- `vitest.config.ts` - Vitest config with React plugin, node environment, setupFiles
- `tsconfig.json` - TypeScript config with @/* path alias to ./src/*
- `next.config.ts` - Minimal Next.js 15 config
- `postcss.config.mjs` - PostCSS config for Tailwind v4
- `vercel.json` - Daily cron for /api/health at 08:00 UTC
- `components.json` - shadcn/ui configuration (Slate style)
- `.env.local` - Placeholder env vars with documentation
- `package.json` - All Phase 1 dependencies

## Decisions Made

- Used vitest `setupFiles` with a custom `.env.local` loader since vitest v4 does not expose an `envFile` config option — the setup file reads and parses `.env.local` manually, mirroring Next.js dev behavior
- Used `force-dynamic` on `/api/health` to prevent the route being statically cached (keep-alive must always hit Supabase)
- Kept `shadcn/ui` at default `--defaults` flag to avoid interactive prompts in automation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added vitest setup.ts to load .env.local**
- **Found during:** Task 1 (GREEN implementation)
- **Issue:** vitest v4 does not support `envFile` config option — tests failed with `SUPABASE_URL undefined` even with `.env.local` present
- **Fix:** Created `src/tests/setup.ts` that manually reads and parses `.env.local`, registered via `setupFiles` in `vitest.config.ts`
- **Files modified:** `src/tests/setup.ts`, `vitest.config.ts`
- **Verification:** `npx vitest run src/tests/supabase-client.test.ts` passes (2/2 GREEN)
- **Committed in:** `cd33721` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix required for test infrastructure correctness. No scope creep.

## User Setup Required

Before Task 2 (Vercel deployment) can proceed, the user must:

1. Create a Supabase project at https://supabase.com/dashboard
2. Copy the pooler connection string (Settings > Database > Connection pooling > Transaction mode, port 6543)
3. Copy API keys from Settings > API (project URL, anon key, service_role key)
4. Get a CoinGecko Demo API key at https://www.coingecko.com/en/api/pricing
5. Update `.env.local` with real values
6. Deploy to Vercel: `npx vercel deploy --yes`
7. Add environment variables in Vercel dashboard
8. Trigger production deployment: `npx vercel deploy --prod`

## Next Phase Readiness

- Build infrastructure is complete (Next.js 15, TypeScript, Tailwind v4, shadcn/ui)
- Supabase clients are correctly structured (server/browser split, pooler URL)
- Tests pass locally — ready for CI once Vercel env vars are set
- Blocked on: Vercel deployment and Supabase project creation (human task)

---
*Phase: 01-foundation*
*Completed: 2026-03-05*
