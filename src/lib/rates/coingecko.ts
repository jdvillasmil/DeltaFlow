import 'server-only'

// Source: https://docs.coingecko.com/reference/simple-price
// REQUIRES: COINGECKO_API_KEY env var (free Demo key from coingecko.com/en/api/pricing)
// The x_cg_demo_api_key param is added when the env var is set.
// CoinGecko rate-limits unauthenticated requests heavily — always include the Demo key.

export async function fetchCoinGeckoRates(): Promise<{
  btc_usd: number
  eth_usd: number
} | null> {
  const apiKey = process.env.COINGECKO_API_KEY
  const url = new URL('https://api.coingecko.com/api/v3/simple/price')
  url.searchParams.set('ids', 'bitcoin,ethereum')
  url.searchParams.set('vs_currencies', 'usd')
  if (apiKey) url.searchParams.set('x_cg_demo_api_key', apiKey)

  try {
    const response = await fetch(url.toString(), {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      throw new Error(`CoinGecko returned HTTP ${response.status}`)
    }

    const data = await response.json()
    const btc_usd = data?.bitcoin?.usd
    const eth_usd = data?.ethereum?.usd

    if (typeof btc_usd !== 'number' || typeof eth_usd !== 'number') {
      throw new Error(`CoinGecko response missing prices: ${JSON.stringify(data)}`)
    }

    return { btc_usd, eth_usd }
  } catch {
    return null // caller uses last-known-good from Supabase
  }
}
