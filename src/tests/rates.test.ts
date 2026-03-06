import { describe, it, expect, vi } from 'vitest'
import { fetchDolarApiParalelo } from '@/lib/rates/dolarapi'
import { fetchCoinGeckoRates } from '@/lib/rates/coingecko'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('fetchDolarApiParalelo()', () => {
  it('returns paralelo rate when API responds correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ promedio: 40.25, fechaActualizacion: '2026-03-04T12:00:00' }),
    })

    const result = await fetchDolarApiParalelo()
    expect(result).not.toBeNull()
    expect(result!.paralelo).toBe(40.25)
    expect(result!.fetched_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('returns null (not throws) on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const result = await fetchDolarApiParalelo()
    expect(result).toBeNull()
  })

  it('returns null when API returns non-200', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 })
    const result = await fetchDolarApiParalelo()
    expect(result).toBeNull()
  })

  it('returns null when promedio is invalid', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ promedio: -1, fechaActualizacion: '2026-03-04' }),
    })
    const result = await fetchDolarApiParalelo()
    expect(result).toBeNull()
  })
})

describe('fetchCoinGeckoRates()', () => {
  it('returns btc_usd and eth_usd when API responds correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        bitcoin: { usd: 85000 },
        ethereum: { usd: 3200 },
      }),
    })

    const result = await fetchCoinGeckoRates()
    expect(result).not.toBeNull()
    expect(result!.btc_usd).toBe(85000)
    expect(result!.eth_usd).toBe(3200)
  })

  it('returns null (not throws) on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'))
    const result = await fetchCoinGeckoRates()
    expect(result).toBeNull()
  })

  it('appends COINGECKO_API_KEY as x_cg_demo_api_key query param when set', async () => {
    process.env.COINGECKO_API_KEY = 'test-key-123'
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bitcoin: { usd: 85000 }, ethereum: { usd: 3200 } }),
    })

    await fetchCoinGeckoRates()

    const calledUrl = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0] as string
    expect(calledUrl).toContain('x_cg_demo_api_key=test-key-123')

    delete process.env.COINGECKO_API_KEY
  })
})
