import { describe, it, expect, vi } from 'vitest'
import { scrapeBcvRate } from '@/lib/rates/bcv-scraper'

// Mock global fetch so tests don't hit live BCV
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('scrapeBcvRate()', () => {
  it('returns usd rate > 0 when HTML contains rate element', async () => {
    // Actual BCV HTML structure discovered during live inspection on 2026-03-06:
    // div#dolar contains a .col-sm-6.centrado div with a <strong> tag holding the rate
    // Rate format: "431,01130000" (comma as decimal separator)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        `<html><body><div id="dolar"><div class="field-content"><div class="row recuadrotsmc"><div class="col-sm-6 col-xs-6"><span> USD</span></div><div class="col-sm-6 col-xs-6 centrado"><strong> 431,01130000 </strong></div></div></div></div></body></html>`,
    })

    const result = await scrapeBcvRate()
    expect(result.usd).toBeGreaterThan(0)
    expect(result.error).toBeUndefined()
    expect(result.scraped_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('returns { usd: null, error } when selector finds nothing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><body><p>No rate here</p></body></html>`,
    })

    const result = await scrapeBcvRate()
    expect(result.usd).toBeNull()
    expect(result.error).toBeDefined()
  })

  it('returns { usd: null, error } when BCV returns non-200', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 })

    const result = await scrapeBcvRate()
    expect(result.usd).toBeNull()
    expect(result.error).toContain('503')
  })

  it('never throws — returns BcvRateResult even on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'))

    await expect(scrapeBcvRate()).resolves.toMatchObject({
      usd: null,
      scraped_at: expect.any(String),
      error: expect.stringContaining('Network timeout'),
    })
  })
})
