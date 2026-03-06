import 'server-only'

// Source: https://ve.dolarapi.com (MIT license)
// Provides BCV official and parallel (dolar paralelo) rates in JSON.
// Used instead of Binance USDTVES — that symbol does not exist on Binance spot market.

interface DolarApiResponse {
  promedio: number
  fechaActualizacion: string
}

export async function fetchDolarApiParalelo(): Promise<{
  paralelo: number
  fetched_at: string
} | null> {
  try {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      throw new Error(`DolarApi returned HTTP ${response.status}`)
    }

    const data: DolarApiResponse = await response.json()

    if (typeof data.promedio !== 'number' || data.promedio <= 0) {
      throw new Error(`DolarApi returned invalid rate: ${JSON.stringify(data)}`)
    }

    return { paralelo: data.promedio, fetched_at: new Date().toISOString() }
  } catch {
    return null // caller uses last-known-good from Supabase
  }
}
