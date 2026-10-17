/// <reference types="vite/client" />

/*
 * Environment variables read by the site (all optional). The two Supabase ones
 * serve the guestbook (lib/supabase.ts, lib/guestbook.ts).
 * The live values go in the committed `.env.production` (or the repo's Actions
 * Variables); for local dev put them in `.env.local` (never committed).
 * See docs/GUESTBOOK.md.
 *
 *   VITE_SUPABASE_URL=<your project's URL>
 *   VITE_SUPABASE_ANON_KEY=sb_publishable_...
 *   VITE_GUESTBOOK_TABLE=guestbook
 *
 * Without the URL and key the guestbook keeps notes on the visitor's device.
 */
interface ImportMetaEnv {
  /** Supabase project URL (Project Settings → Data API → Project URL) */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon / publishable (public) key. Safe to ship: row level security guards the table. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Guestbook table name (default guestbook, created by supabase/guestbook.sql) */
  readonly VITE_GUESTBOOK_TABLE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
