import { profile } from '../content/profile'
import { isConfigured, supabaseEnv, supabaseHeaders } from './supabase'

export { isConfigured }

/*
 * Guestbook client: a tiny Supabase REST (PostgREST) client using plain fetch
 * (the env and key handling live in supabase.ts).
 *
 * Table contract (see supabase/guestbook.sql):
 *   public.guestbook(id uuid, created_at timestamptz, name text 1–40,
 *                    message text 1–280, sticker (one of STICKERS),
 *                    color 'lavender'|'peach'|'butter'|'mint'|'sky'|'pink',
 *                    hidden boolean default true)
 *
 * The guestbook is pre-moderated: every new note is saved hidden and only shows
 * on the wall after it's approved (hidden = false) in the Supabase dashboard.
 * Visitors can't read hidden rows, so posting asks for `return=minimal`.
 *
 * Env: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (+ optional VITE_GUESTBOOK_TABLE,
 * default guestbook). When the URL or key is missing, isConfigured() is
 * false and the UI keeps notes on the visitor's device (no requests are made).
 * When the table doesn't exist yet (the SQL hasn't been run), the first request
 * gets a 404, the client remembers it for the rest of the visit and the UI falls
 * back to the same on-device mode instead of retrying.
 */

export const NOTE_COLORS = ['lavender', 'peach', 'butter', 'mint', 'sky', 'pink'] as const
export type NoteColor = (typeof NOTE_COLORS)[number]

export const LIMITS = { name: 40, message: 280 } as const

/** The stickers a note can carry. supabase/guestbook.sql allows exactly these (or none). */
export const STICKERS = ['🌷', '✨', '🍓', '🦋', '🌈', '🍑', '💌', '🧸'] as const

export type Note = {
  id: string
  name: string
  message: string
  sticker: string
  color: NoteColor
  /** ISO timestamp */
  created_at: string
}

export type NewNote = Pick<Note, 'name' | 'message' | 'sticker' | 'color'>

export type GuestbookErrorKind =
  /** VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set */
  | 'not-configured'
  /** the table isn't there yet (404: the SQL hasn't been run in this project) */
  | 'unavailable'
  /** offline, DNS, CORS, timeout … */
  | 'network'
  /** the note broke a rule (length, color …) — client or database check */
  | 'invalid'
  /** too many notes right now (flood guard, HTTP 429) */
  | 'rate-limited'
  /** 401 / 403: bad key or row level security said no */
  | 'forbidden'
  /** any other non-2xx response */
  | 'http'
  /** the server answered with something we couldn't read */
  | 'bad-response'

export class GuestbookError extends Error {
  readonly kind: GuestbookErrorKind
  readonly status?: number
  constructor(kind: GuestbookErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'GuestbookError'
    this.kind = kind
    this.status = status
  }
}

export const isGuestbookError = (e: unknown): e is GuestbookError => e instanceof GuestbookError

const TIMEOUT_MS = 12_000

/** This site's own moderated table (supabase/guestbook.sql). */
const DEFAULT_TABLE = 'guestbook'
/** A plain Postgres identifier, so the name can't smuggle a path or query into the URL. */
const TABLE_NAME = /^[a-z_][a-z0-9_]{0,62}$/

function env() {
  const wanted = (import.meta.env.VITE_GUESTBOOK_TABLE ?? '').trim()
  const table = TABLE_NAME.test(wanted) ? wanted : DEFAULT_TABLE
  return { ...supabaseEnv(), table }
}

/** Set once a request finds no table, so later opens skip straight to on-device mode. */
let tableMissing = false

/** True when notes can be sent to Supabase: configured, and the table wasn't missing this visit. */
export function isAvailable(): boolean {
  return isConfigured() && !tableMissing
}

const headers = supabaseHeaders

const isColor = (c: unknown): c is NoteColor => typeof c === 'string' && (NOTE_COLORS as readonly string[]).includes(c)

/** Keep only well-formed rows (never trust the network). */
function toNote(row: unknown): Note | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.name !== 'string' || typeof r.message !== 'string') return null
  return {
    id: r.id,
    name: r.name.slice(0, LIMITS.name),
    message: r.message.slice(0, LIMITS.message),
    sticker: typeof r.sticker === 'string' && (STICKERS as readonly string[]).includes(r.sticker) ? r.sticker : '',
    color: isColor(r.color) ? r.color : 'lavender',
    created_at: typeof r.created_at === 'string' ? r.created_at : new Date().toISOString(),
  }
}

/** fetch with a timeout, an optional caller signal, and typed errors. */
async function request(path: string, init: RequestInit & { signal?: AbortSignal } = {}): Promise<unknown> {
  if (!isConfigured()) throw new GuestbookError('not-configured', 'the guestbook is not connected yet')
  const { url } = env()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const onAbort = () => ctrl.abort()
  init.signal?.addEventListener('abort', onAbort, { once: true })

  // The timeout covers the body too: a connection can stall after the headers
  // (phones switching networks), and that must end in an error, not a forever-skeleton.
  let res: Response
  let text: string
  try {
    res = await fetch(`${url}/rest/v1/${path}`, { ...init, signal: ctrl.signal })
    text = await res.text()
  } catch (err) {
    if (init.signal?.aborted) throw err // caller cancelled: let them ignore it
    throw new GuestbookError('network', "couldn't reach the guestbook. check your connection?")
  } finally {
    clearTimeout(timer)
    init.signal?.removeEventListener('abort', onAbort)
  }

  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  if (!res.ok) {
    const info = (body && typeof body === 'object' ? body : {}) as { message?: string; code?: string }
    const msg = typeof info.message === 'string' ? info.message : ''
    // PGRST205 (PostgREST 12+) / 42P01 (older): no such table. Any 404 here means the
    // same thing, since every request names the table.
    if (res.status === 404 || info.code === 'PGRST205' || info.code === '42P01') {
      tableMissing = true
      throw new GuestbookError('unavailable', 'the guestbook opens soon', res.status)
    }
    if (res.status === 429 || /flood|too many|busy/i.test(msg)) {
      throw new GuestbookError('rate-limited', 'the guestbook is extra busy right now. try again in a minute?', res.status)
    }
    if (res.status === 401 || res.status === 403) {
      throw new GuestbookError('forbidden', 'the guestbook said no. its keys might be misconfigured.', res.status)
    }
    // 23514 = check_violation, 22001 = string too long, 23502 = not null
    if (res.status === 400 && (info.code === '23514' || info.code === '22001' || info.code === '23502')) {
      throw new GuestbookError('invalid', "that note doesn't fit the rules (1–40 char name, 1–280 char message).", res.status)
    }
    // 42501 = row level security said no (e.g. an older policy on the table)
    if (info.code === '42501') {
      throw new GuestbookError('forbidden', 'the guestbook said no. its keys might be misconfigured.', res.status)
    }
    throw new GuestbookError('http', `the guestbook hiccuped (${res.status}). try again?`, res.status)
  }
  return body
}

/** Latest 100 approved notes, newest first. */
export async function listNotes(opts: { signal?: AbortSignal } = {}): Promise<Note[]> {
  const { table } = env()
  const body = await request(
    `${table}?select=id,name,message,sticker,color,created_at&hidden=eq.false&order=created_at.desc&limit=100`,
    { method: 'GET', headers: headers(), signal: opts.signal },
  )
  if (!Array.isArray(body)) throw new GuestbookError('bad-response', 'the guestbook sent something odd back')
  return body.map(toNote).filter((n): n is Note => n !== null)
}

/** Client-side mirror of the table's check constraints. Returns an error message or null. */
export function validateNote(n: NewNote): string | null {
  const name = n.name.trim()
  const message = n.message.trim()
  if (!name) return `add your name so ${profile.firstName.toLowerCase()} knows who it is from`
  if (name.length > LIMITS.name) return `names can be up to ${LIMITS.name} characters`
  if (!message) return 'write a little message first'
  if (message.length > LIMITS.message) return `messages can be up to ${LIMITS.message} characters`
  if (n.sticker && !(STICKERS as readonly string[]).includes(n.sticker)) return 'pick one of the stickers'
  if (!isColor(n.color)) return 'pick a paper color'
  return null
}

/**
 * Sign the guestbook. The note is saved hidden and waits for approval, so there is
 * nothing to read back: visitors can't see unapproved rows (`return=minimal`).
 */
export async function addNote(note: NewNote, opts: { signal?: AbortSignal } = {}): Promise<void> {
  const problem = validateNote(note)
  if (problem) throw new GuestbookError('invalid', problem)
  const { table } = env()
  await request(table, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({
      name: note.name.trim(),
      message: note.message.trim(),
      sticker: note.sticker,
      color: note.color,
    }),
    signal: opts.signal,
  })
}
