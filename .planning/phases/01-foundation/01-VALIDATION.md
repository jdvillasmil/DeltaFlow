---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit) + manual inspection |
| **Config file** | vitest.config.ts — Wave 0 installs |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01-01 | 1 | Scaffold | build | `npx next build` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01-01 | 1 | Scaffold | deploy | Manual: Vercel dashboard shows 200 | ❌ Manual | ⬜ pending |
| 1-02-01 | 01-02 | 1 | Schema | migration | `npx supabase db push --dry-run` | ❌ W0 | ⬜ pending |
| 1-02-02 | 01-02 | 1 | Schema types | unit | `npx vitest run src/lib/db.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-01 | 01-03 | 2 | Rate aggregator | unit | `npx vitest run src/lib/rates.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-02 | 01-03 | 2 | BCV fallback | unit | `npx vitest run src/lib/bcv.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-03 | 01-03 | 2 | Edge Function cron | manual | Manual: Supabase dashboard shows cron schedule | ❌ Manual | ⬜ pending |
| 1-03-04 | 01-03 | 2 | Pooler connection | unit | `npx vitest run src/lib/supabase.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — test framework configuration
- [ ] `src/lib/db.test.ts` — stubs for schema type validation
- [ ] `src/lib/rates.test.ts` — stubs for rate aggregator (BCV, dolarapi.com, CoinGecko)
- [ ] `src/lib/bcv.test.ts` — stubs for BCV scraper with fallback behavior
- [ ] `src/lib/supabase.test.ts` — stub verifying pooler URL (port 6543) is used

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vercel deploy returns 200 | Phase 1 SC1 | Requires Vercel account + live deployment | Run `vercel deploy`, check URL returns 200 |
| Supabase schema migrations clean | Phase 1 SC2 | Requires live Supabase project | `supabase db push`, verify tables exist in Supabase dashboard |
| Edge Function cron runs hourly | Phase 1 SC4 | Requires live Supabase Edge Functions | Check Supabase dashboard Edge Functions logs after 1 hour |
| `/api/rates/refresh` live call | Phase 1 SC3 | Requires deployed environment + live APIs | Call endpoint, verify `exchange_rates` table updated in Supabase |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
