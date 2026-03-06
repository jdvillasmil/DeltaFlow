// Supabase Edge Function — called by Supabase cron on hourly schedule
// Triggers the Next.js /api/rates/refresh endpoint
// Docs: https://supabase.com/docs/guides/functions/schedule-functions
//
// Deploy: npx supabase functions deploy refresh-rates --project-ref YOUR_PROJECT_REF
// Set env:
//   npx supabase secrets set NEXTJS_APP_URL=https://your-app.vercel.app --project-ref YOUR_PROJECT_REF
//   npx supabase secrets set CRON_SECRET=your_cron_secret --project-ref YOUR_PROJECT_REF
// Schedule: Supabase dashboard > Edge Functions > refresh-rates > Schedule: 0 * * * *

Deno.serve(async () => {
  const refreshUrl = Deno.env.get('NEXTJS_APP_URL')
  const cronSecret = Deno.env.get('CRON_SECRET')

  if (!refreshUrl) {
    return new Response(JSON.stringify({ error: 'NEXTJS_APP_URL not set' }), { status: 500 })
  }

  try {
    const response = await fetch(`${refreshUrl}/api/rates/refresh`, {
      method: 'GET',
      headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
    })

    const data = await response.json()
    return new Response(JSON.stringify({ triggered: true, result: data }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
