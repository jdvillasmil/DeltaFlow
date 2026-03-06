import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

// Revalidate every 60 minutes — aligns with hourly Edge Function cron
export const revalidate = 3600

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('exchange_rates')
      .select('currency, rate_ves, source, fetched_at')
      .order('fetched_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ rates: data, timestamp: new Date().toISOString() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch rates'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
