/*
 * Supabase settings shared by the site's tiny Supabase client (plain fetch
 * against Supabase's REST API, no SDK; see guestbook.ts).
 *
 * Env: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (the publishable key, public
 * by design: row level security decides what it may do). Without both,
 * isConfigured() is false and nothing is ever sent: the guestbook keeps notes
 * on the visitor's own device instead. The table is made by supabase/guestbook.sql.
 */

export function supabaseEnv() {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '')
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  return { url, key }
}

/** True when both Supabase env vars are present. */
export function isConfigured(): boolean {
  const { url, key } = supabaseEnv()
  return Boolean(url && key)
}

export function supabaseHeaders(extra?: Record<string, string>): HeadersInit {
  const { key } = supabaseEnv()
  // Legacy anon keys are JWTs ("eyJ…") and also go in Authorization. Newer
  // publishable keys (sb_publishable_…) are not JWTs: sending them as a Bearer
  // token gets rejected, so they travel in `apikey` only.
  const auth: Record<string, string> = key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}
  return { apikey: key, ...auth, Accept: 'application/json', ...extra }
}
