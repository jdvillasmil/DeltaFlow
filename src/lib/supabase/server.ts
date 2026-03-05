import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Module-scope initialization — reused across warm Vercel invocations.
// CRITICAL: SUPABASE_URL MUST be the Supabase pooler URL (port 6543).
// Never use the direct Postgres URL (port 5432) — it exhausts free-tier connections.
// In Supabase dashboard: Settings > Database > Connection pooling > Connection string (Transaction mode)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
