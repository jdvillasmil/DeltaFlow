import { NextResponse } from 'next/server'
import { refreshAllRates } from '@/lib/rates/refresh-rates'

// Never cache this route — it must always execute live
export const dynamic = 'force-dynamic'

// Accept both GET (for Supabase Edge Function cron) and POST (for manual triggers)
export async function GET(request: Request) {
  return handleRefresh(request)
}

export async function POST(request: Request) {
  return handleRefresh(request)
}

async function handleRefresh(request: Request) {
  // Protect against unauthorized calls using CRON_SECRET
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const result = await refreshAllRates()
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refresh failed'
    console.error('[/api/rates/refresh]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
