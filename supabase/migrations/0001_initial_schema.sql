-- Migration: 0001_initial_schema
-- Phase 1 Foundation — DeltaFlow
-- Created: 2026-03-05
--
-- CRITICAL DECISIONS (do not change without a new migration):
-- • NUMERIC(24, 8) for all financial columns — never use inexact types (floating point, etc.)
-- • client_id UUID UNIQUE on transactions — enables ON CONFLICT DO NOTHING for offline idempotency
-- • RLS on transactions only — exchange_rates are public data
-- • rate_at_time stored on transactions — historical VES values must never be recalculated from current rates

-- ============================================================
-- exchange_rates
-- One row per currency/source pair. Upserted hourly by rate aggregator.
-- No RLS — rates are not user-specific data; anon key can read.
-- ============================================================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  currency    TEXT NOT NULL,                   -- 'USD', 'BTC', 'ETH', 'USDT', 'EUR'
  rate_ves    NUMERIC(24, 8) NOT NULL,         -- price in VES — NUMERIC only, never inexact types
  source      TEXT NOT NULL,                   -- 'bcv', 'dolarapi_paralelo', 'coingecko'
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (currency, source)                    -- upsert conflict target: ON CONFLICT (currency, source) DO UPDATE
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_fetched
  ON exchange_rates (fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_currency_source
  ON exchange_rates (currency, source);

-- ============================================================
-- transactions
-- User-scoped financial records. RLS enforced.
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id         UUID NOT NULL,                   -- client-generated before any network call
  user_id           UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  amount            NUMERIC(24, 8) NOT NULL,         -- original amount in original_currency
  currency          TEXT NOT NULL,                   -- 'USD', 'VES', 'EUR', 'BTC', 'ETH', 'USDT'
  amount_ves        NUMERIC(24, 8),                  -- VES snapshot at write time — immutable after insert
  rate_at_time      NUMERIC(24, 8),                  -- rate used for VES snapshot (audit trail)
  rate_source       TEXT,                            -- 'bcv', 'dolarapi_paralelo', 'coingecko'
  type              TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category          TEXT NOT NULL,
  payment_method    TEXT CHECK (
                      payment_method IN (
                        'zelle', 'usdt', 'pagomovil', 'usd_cash', 'transfer', 'other'
                      )
                    ),
  description       TEXT,
  transaction_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id)                                 -- idempotent insert: ON CONFLICT (client_id) DO NOTHING
);

-- Row Level Security — users can only access their own transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_transactions"
  ON transactions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON transactions (user_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_category
  ON transactions (user_id, category);

CREATE INDEX IF NOT EXISTS idx_transactions_client_id
  ON transactions (client_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
