import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const migrationPath = path.resolve(__dirname, '../../supabase/migrations/0001_initial_schema.sql')
const sql = readFileSync(migrationPath, 'utf-8')

describe('Schema: financial column precision', () => {
  it('exchange_rates.rate_ves uses NUMERIC(24, 8)', () => {
    expect(sql).toContain('rate_ves    NUMERIC(24, 8)')
  })

  it('transactions.amount_ves uses NUMERIC(24, 8)', () => {
    expect(sql).toContain('amount_ves        NUMERIC(24, 8)')
  })

  it('transactions.rate_at_time uses NUMERIC(24, 8)', () => {
    expect(sql).toContain('rate_at_time      NUMERIC(24, 8)')
  })

  it('transactions.amount uses NUMERIC(24, 8)', () => {
    expect(sql).toContain('amount            NUMERIC(24, 8)')
  })

  it('no FLOAT or DOUBLE PRECISION columns exist', () => {
    expect(sql).not.toMatch(/\bFLOAT\b/)
    expect(sql).not.toMatch(/\bDOUBLE PRECISION\b/)
    expect(sql).not.toMatch(/\bREAL\b/)
  })
})

describe('Schema: offline idempotency', () => {
  it('transactions.client_id has UNIQUE constraint', () => {
    expect(sql).toContain('UNIQUE (client_id)')
  })

  it('transactions.client_id is of type UUID NOT NULL', () => {
    expect(sql).toMatch(/client_id\s+UUID\s+NOT NULL/)
  })
})

describe('Schema: row level security', () => {
  it('RLS is enabled on transactions', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
  })

  it('users_own_transactions policy exists', () => {
    expect(sql).toContain('users_own_transactions')
  })

  it('RLS is NOT enabled on exchange_rates (public data)', () => {
    // exchange_rates are public — no RLS
    const rlsCount = (sql.match(/ENABLE ROW LEVEL SECURITY/g) || []).length
    expect(rlsCount).toBe(1) // only transactions has RLS
  })
})
