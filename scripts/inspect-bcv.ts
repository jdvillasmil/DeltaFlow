// BCV HTML Inspection Script
// Run: npx tsx scripts/inspect-bcv.ts
// Purpose: Discover the actual CSS selector for USD/VES rate before writing production scraper

import * as cheerio from 'cheerio'

async function inspectBcv() {
  console.log('Fetching BCV website...')
  const response = await fetch('https://www.bcv.org.ve/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DeltaFlow/1.0)', 'Accept': 'text/html' },
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    console.error(`BCV returned HTTP ${response.status}`)
    return
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  console.log('--- title ---', $('title').text())
  console.log('\n--- #dolar strong ---', $('div#dolar strong').text())
  console.log('--- #dolar .number ---', $('div#dolar .number').text())
  console.log('--- #dolar ---', $('div#dolar').text().trim().substring(0, 300))
  console.log('--- .tipo-cambio ---', $('.tipo-cambio').text().trim().substring(0, 300))
  console.log('--- #dolar span ---', $('div#dolar span').first().text().trim())
  console.log('--- #euro strong ---', $('div#euro strong').text())

  // Look for any element containing a number that could be a rate (30-100 range for USD/VES)
  const allText = $('body').text()
  const rateMatch = allText.match(/\b[3-9][0-9],\d{2}\b/g)
  console.log('\n--- Potential rate values (XX,YY pattern) ---', rateMatch?.slice(0, 10))

  // Show full #dolar div HTML
  console.log('\n--- Full #dolar div HTML ---')
  console.log($('div#dolar').html()?.substring(0, 500))
}

inspectBcv().catch(console.error)
