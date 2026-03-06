import 'server-only'
import * as cheerio from 'cheerio'

export interface BcvRateResult {
  usd: number | null
  scraped_at: string
  error?: string
}

const BCV_URL = 'https://www.bcv.org.ve/'
const FETCH_TIMEOUT_MS = 6000

// SELECTOR NOTE: Inspected BCV HTML live on 2026-03-06.
// HTML structure: div#dolar > div.field-content > div.row.recuadrotsmc >
//   div.col-sm-6.centrado > strong
// The strong element contains the rate as "431,01130000" (comma as decimal separator).
// Run: npx tsx scripts/inspect-bcv.ts to re-verify if scraping breaks.
const BCV_RATE_SELECTOR = 'div#dolar strong'

export async function scrapeBcvRate(): Promise<BcvRateResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(BCV_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DeltaFlow/1.0)',
        Accept: 'text/html',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`BCV returned HTTP ${response.status}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const rateText = $(BCV_RATE_SELECTOR).text().trim()

    if (!rateText) {
      throw new Error(
        `BCV selector "${BCV_RATE_SELECTOR}" returned empty — HTML structure may have changed`
      )
    }

    // BCV uses comma as decimal separator (e.g. "431,01130000") — normalize before parsing
    const normalized = rateText.replace(/\./g, '').replace(',', '.')
    const usdRate = parseFloat(normalized)

    if (isNaN(usdRate) || usdRate <= 0) {
      throw new Error(`BCV rate parse failed — selector returned: "${rateText}"`)
    }

    return { usd: usdRate, scraped_at: new Date().toISOString() }
  } catch (err) {
    return {
      usd: null,
      scraped_at: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    clearTimeout(timeout)
  }
}
