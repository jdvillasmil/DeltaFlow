---
phase: 01-foundation
plan: 02
subsystem: database
tags: [supabase, postgres, migrations, typescript, vitest, rls, numeric]

# Dependency graph
requires: []
provides:
  - Supabase migration 0001_initial_schema.sql with exchange_rates and transactions tables
  - NUMERIC(24,8) financial columns with no floating-point types
  - UNIQUE (client_id) constraint for offline idempotent inserts
  - RLS policy on transactions (users_own_transactions); no RLS on exchange_rates
  - TypeScript types: ExchangeRate, Transaction, Database, Currency, RateSource, TransactionType, PaymentMethod
  - Automated schema validation test (10 tests passing)
affects:
  - 01-03 (rate aggregator writes to exchange_rates table)
  - 02 (auth uses transactions.user_id FK to auth.users)
  - 03 (transaction UI reads/writes using these types)

# Tech tracking
tech-stack:
  added: [vitest@2.x, "@vitejs/plugin-react"]
  patterns:
    - NUMERIC(24, 8) for all financial columns — never FLOAT/REAL/DOUBLE PRECISION
    - client_id UUID UNIQUE for offline idempotent inserts (ON CONFLICT DO NOTHING)
    - RLS scoping transactions to auth.uid() = user_id
    - Supabase returns NUMERIC as string — TypeScript types use string not number

key-files:
  created:
    - supabase/migrations/0001_initial_schema.sql
    - src/types/database.ts
    - src/tests/schema.test.ts
    - vitest.config.ts
  modified:
    - package.json (added vitest dev dependency)

key-decisions:
  - "NUMERIC(24, 8) for all financial columns — avoids IEEE 754 float drift in VES/crypto amounts"
  - "UNIQUE (client_id) on transactions enables idempotent offline sync retries"
  - "RLS on transactions only — exchange_rates are public read, not user data"
  - "rate_at_time stored immutably on transactions — historical VES values never recalculated"
  - "Supabase JS client returns NUMERIC as string — TypeScript types reflect this (string not number)"

patterns-established:
  - "Pattern: Financial columns always NUMERIC(24, 8) in Postgres — enforced by schema test"
  - "Pattern: client_id UUID generated client-side before any network call — enables offline-first"
  - "Pattern: RLS policy FOR ALL with USING + WITH CHECK — ensures both read and write scoping"

requirements-completed: []

# Metrics
duration: 7min
completed: 2026-03-05
---

# Phase 1 Plan 02: Initial Schema Migration Summary

**Supabase migration with exchange_rates and transactions tables, NUMERIC(24,8) financial columns, UUID UNIQUE client_id for offline idempotency, and RLS policy scoping transactions to their owner — validated by 10 automated tests**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-05T14:23:09Z
- **Completed:** 2026-03-05T14:26:02Z
- **Tasks completed:** 1 of 2 (Task 2 is a human-verify checkpoint)
- **Files created:** 4
- **Files modified:** 1

## Accomplishments

- Wrote 10 schema validation tests (TDD RED) covering NUMERIC precision, UUID uniqueness, RLS, and no-float guarantee
- Created production-grade SQL migration with exchange_rates (no RLS) and transactions (RLS) tables
- All financial columns use NUMERIC(24, 8) — no FLOAT, REAL, or DOUBLE PRECISION anywhere
- TypeScript types mirror the schema with correct string types for NUMERIC columns (Supabase JS client behavior)
- Installed vitest and created vitest.config.ts as test infrastructure for Phase 1
- All 10 automated schema tests pass against the SQL file

## Task Commits

Each task was committed atomically:

1. **Task 1: Create initial Supabase migration and TypeScript database types** - `963ba7c` (feat)

**Plan metadata:** pending (created after checkpoint resolution)

## Files Created/Modified

- `supabase/migrations/0001_initial_schema.sql` - Production SQL migration with exchange_rates and transactions tables, indexes, RLS, and updated_at trigger
- `src/types/database.ts` - TypeScript types: ExchangeRate, Transaction, Database, Currency, RateSource, TransactionType, PaymentMethod
- `src/tests/schema.test.ts` - 10 automated vitest tests validating NUMERIC columns, UNIQUE constraint, RLS, and no-float policy
- `vitest.config.ts` - Vitest configuration for the project (node environment, src/tests glob)
- `package.json` - Added vitest and @vitejs/plugin-react as dev dependencies

## Decisions Made

- NUMERIC(24, 8) across all financial columns — IEEE 754 float drift is unacceptable in financial data; 8 decimal places handles BTC satoshi precision; 24 total handles VES's large nominal values
- client_id UUID UNIQUE enables `ON CONFLICT (client_id) DO NOTHING` for idempotent offline sync retries
- RLS enabled on transactions only — exchange_rates are public (any user can read current rates), only transactions contain user-private financial data
- rate_at_time and amount_ves stored immutably at insert time — historical VES snapshots must never be recalculated from current rates (audit integrity)
- TypeScript types use `string` for NUMERIC fields — the Supabase JS client returns NUMERIC columns as strings to preserve precision; callers must use decimal.js before arithmetic

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SQL comments containing word "FLOAT" triggering test regex**
- **Found during:** Task 1 (GREEN phase verification)
- **Issue:** Test `no FLOAT or DOUBLE PRECISION columns exist` uses `/\bFLOAT\b/` regex which matches the word "FLOAT" in SQL comments (`-- never FLOAT/REAL/DOUBLE PRECISION`), causing false failure
- **Fix:** Replaced comment text to remove the standalone word "FLOAT" — changed to descriptive text ("never use inexact types") and "NUMERIC only, never inexact types"
- **Files modified:** supabase/migrations/0001_initial_schema.sql
- **Verification:** 10/10 tests pass after fix
- **Committed in:** 963ba7c (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Fix corrects a false test failure caused by comment text matching the forbidden pattern. No scope creep.

## Issues Encountered

- vitest was not installed in the project — added vitest and @vitejs/plugin-react as dev dependencies (Rule 3 blocking fix)
- The project had a package.json from an earlier scaffolding attempt but no test framework installed

## User Setup Required

Task 2 (checkpoint:human-verify) is pending — the migration must be applied to the live Supabase project:

**Option A — Supabase CLI:**
1. `npx supabase link --project-ref YOUR_REF`
2. `npx supabase db push`
3. Confirm "Applied 1 migration" with no errors

**Option B — SQL Editor:**
1. Open Supabase dashboard > SQL Editor
2. Paste contents of `supabase/migrations/0001_initial_schema.sql`
3. Click "Run" — confirm "Success. No rows returned."

**Verification after applying:**
- Table Editor: exchange_rates and transactions tables exist with correct columns
- Authentication > Policies: transactions has "users_own_transactions"; exchange_rates has NO policies
- Column types: amount_ves = numeric, client_id = uuid

## Next Phase Readiness

- Schema migration SQL is ready to apply — file is at `supabase/migrations/0001_initial_schema.sql`
- TypeScript types ready for use in Plan 01-03 (rate aggregator) and all subsequent phases
- Test infrastructure (vitest) is installed and configured
- Pending: Live Supabase schema application (Task 2 checkpoint) — Plan 01-03 requires the live tables to upsert rates

---
*Phase: 01-foundation*
*Completed: 2026-03-05*
