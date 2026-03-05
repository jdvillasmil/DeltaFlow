import { describe, it, expect } from 'vitest'

describe('Supabase client configuration', () => {
  it('SUPABASE_URL must not contain direct postgres port 5432', () => {
    // This test catches accidental use of direct Postgres URL instead of pooler
    const url = process.env.SUPABASE_URL ?? ''
    expect(url).not.toContain(':5432')
    expect(url).not.toContain('db.YOUR_PROJECT') // direct db URL pattern
  })

  it('SUPABASE_URL environment variable must be set', () => {
    // Will catch missing env in CI/CD before any Supabase call fails at runtime
    expect(process.env.SUPABASE_URL).toBeDefined()
    expect(process.env.SUPABASE_URL).not.toBe('')
  })
})
