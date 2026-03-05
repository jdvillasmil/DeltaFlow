// TypeScript types mirroring the Supabase schema.
// Supabase returns NUMERIC columns as strings to preserve precision — do not use number.
// Always pass NUMERIC values through decimal.js before arithmetic.

export interface ExchangeRate {
  id: string
  currency: string  // 'USD' | 'BTC' | 'ETH' | 'USDT' | 'EUR'
  rate_ves: string  // NUMERIC(24,8) returned as string by Supabase JS client
  source: string    // 'bcv' | 'dolarapi_paralelo' | 'coingecko'
  fetched_at: string
}

export type RateSource = 'bcv' | 'dolarapi_paralelo' | 'coingecko'
export type Currency = 'USD' | 'VES' | 'EUR' | 'BTC' | 'ETH' | 'USDT'
export type TransactionType = 'income' | 'expense'
export type PaymentMethod = 'zelle' | 'usdt' | 'pagomovil' | 'usd_cash' | 'transfer' | 'other'

export interface Transaction {
  id: string
  client_id: string       // UUID, client-generated before any network call
  user_id: string
  amount: string          // NUMERIC(24,8) as string
  currency: Currency
  amount_ves: string | null   // NUMERIC(24,8) as string; null for VES-native transactions
  rate_at_time: string | null // NUMERIC(24,8) as string; null for VES-native transactions
  rate_source: RateSource | null
  type: TransactionType
  category: string
  payment_method: PaymentMethod | null
  description: string | null
  transaction_date: string  // DATE as ISO string
  created_at: string
  updated_at: string
}

// Supabase Database type for use with createClient<Database>() in later phases
export interface Database {
  public: {
    Tables: {
      exchange_rates: {
        Row: ExchangeRate
        Insert: Omit<ExchangeRate, 'id' | 'fetched_at'> & { fetched_at?: string }
        Update: Partial<Omit<ExchangeRate, 'id'>>
      }
      transactions: {
        Row: Transaction
        Insert: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Transaction, 'id' | 'client_id' | 'user_id' | 'created_at'>>
      }
    }
  }
}
