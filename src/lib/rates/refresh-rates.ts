import 'server-only'
import Decimal from 'decimal.js'
import { supabaseAdmin } from '@/lib/supabase/server'
import { scrapeBcvRate } from './bcv-scraper'
import { fetchDolarApiParalelo } from './dolarapi'
import { fetchCoinGeckoRates } from './coingecko'

// One-time global config — must be done before any Decimal arithmetic
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP })

/** Convert an amount in any currency to VES using decimal.js. Never use native * operator. */
export function toVes(amount: string | number, rateVes: string | number): string {
  return new Decimal(String(amount)).mul(new Decimal(String(rateVes))).toFixed(8)
}

interface RateUpsertRow {
  currency: string
  rate_ves: string  // Use string to preserve NUMERIC(24,8) precision
  source: string
  fetched_at: string
}

export async function refreshAllRates(): Promise<{
  updated: number
  timestamp: string
  errors: string[]
}> {
  // Run all three fetchers in parallel — partial failure is acceptable
  const [bcvResult, dolarApiResult, coinGeckoResult] = await Promise.allSettled([
    scrapeBcvRate(),
    fetchDolarApiParalelo(),
    fetchCoinGeckoRates(),
  ])

  const upserts: RateUpsertRow[] = []
  const errors: string[] = []

  // BCV official rate
  if (bcvResult.status === 'fulfilled' && bcvResult.value.usd !== null) {
    upserts.push({
      currency: 'USD',
      rate_ves: new Decimal(bcvResult.value.usd).toFixed(8),
      source: 'bcv',
      fetched_at: new Date().toISOString(),
    })
  } else {
    const err =
      bcvResult.status === 'rejected'
        ? String(bcvResult.reason)
        : (bcvResult.value.error ?? 'BCV scrape returned null')
    errors.push(`BCV: ${err}`)
    // Last-known-good BCV rate remains in exchange_rates — no delete, no upsert
  }

  // Parallel market rate (dolarapi.com — NOT Binance, USDTVES does not exist on spot)
  if (dolarApiResult.status === 'fulfilled' && dolarApiResult.value !== null) {
    upserts.push({
      currency: 'USD',
      rate_ves: new Decimal(dolarApiResult.value.paralelo).toFixed(8),
      source: 'dolarapi_paralelo',
      fetched_at: new Date().toISOString(),
    })
  } else {
    errors.push('DolarApi: fetch failed or returned null')
  }

  // CoinGecko BTC + ETH (prices in USD — stored as USD/BTC and USD/ETH rates vs VES)
  if (coinGeckoResult.status === 'fulfilled' && coinGeckoResult.value !== null) {
    const { btc_usd, eth_usd } = coinGeckoResult.value
    upserts.push({
      currency: 'BTC',
      rate_ves: new Decimal(btc_usd).toFixed(8),
      source: 'coingecko',
      fetched_at: new Date().toISOString(),
    })
    upserts.push({
      currency: 'ETH',
      rate_ves: new Decimal(eth_usd).toFixed(8),
      source: 'coingecko',
      fetched_at: new Date().toISOString(),
    })
  } else {
    errors.push('CoinGecko: fetch failed or returned null')
  }

  if (upserts.length > 0) {
    const { error: upsertError } = await supabaseAdmin
      .from('exchange_rates')
      .upsert(upserts, { onConflict: 'currency,source' })

    if (upsertError) {
      throw new Error(`Supabase upsert failed: ${upsertError.message}`)
    }
  }

  return {
    updated: upserts.length,
    timestamp: new Date().toISOString(),
    errors,
  }
}
