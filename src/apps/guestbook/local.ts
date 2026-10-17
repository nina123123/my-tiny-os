import { profile } from '../../content/profile'
import type { Note, NoteColor } from '../../lib/guestbook'

export { STICKERS } from '../../lib/guestbook'

/*
 * Guestbook helpers that live in the browser: on-device storage (used until
 * the guestbook is connected), the one-note-a-minute limit, a mild profanity
 * check and relative times.
 */

export type WallNote = Note & {
  /** Built-in hello from the owner (not a visitor), shown with a "sample" chip */
  sample?: boolean
  /** Saved on this device only (the guestbook isn't connected yet) */
  local?: boolean
}

export const COLOR_NAMES: Record<NoteColor, string> = {
  lavender: 'lavender',
  peach: 'peach',
  butter: 'butter',
  mint: 'mint',
  sky: 'sky',
  pink: 'pink',
}

/**
 * Sample notes for the on-device mode: little hellos from the owner (never a
 * real visitor or friend), always shown with a "sample" chip.
 */
const host = profile.firstName.toLowerCase()
export const SAMPLES: WallNote[] = [
  {
    id: 'sample-1',
    name: host,
    message: 'hi friend! leave me a hello, a wish, a song rec… anything at all ✨',
    sticker: '✨',
    color: 'butter',
    created_at: '',
    sample: true,
  },
  {
    id: 'sample-2',
    name: host,
    message: 'pick a sticker and a paper color, write something nice, then stick it on the wall 💌',
    sticker: '🌷',
    color: 'lavender',
    created_at: '',
    sample: true,
  },
  {
    id: 'sample-3',
    name: host,
    message: 'every note on this wall makes my day. thank you for stopping by 🫶',
    sticker: '🧸',
    color: 'mint',
    created_at: '',
    sample: true,
  },
]

// ── storage (never throws: private mode, blocked storage, previews) ─────────
// GitHub Pages serves all of an account's project sites from one origin, so these
// keys carry this site's own prefix (no other site's notes or timers show up here).
const DEMO_KEY = 'tinyos-guestbook-local'
const LAST_KEY = 'tinyos-guestbook-last-signed'
let memoryLast = 0

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* storage unavailable: on-device notes just won't survive a reload */
  }
}

export function loadDemoNotes(): WallNote[] {
  try {
    const raw = read(DEMO_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(list)) return []
    return list
      .filter((n): n is WallNote => !!n && typeof n === 'object' && typeof (n as WallNote).id === 'string')
      .map((n) => ({ ...n, local: true }))
  } catch {
    return []
  }
}

export function saveDemoNote(note: WallNote) {
  const list = [note, ...loadDemoNotes()].slice(0, 50).map(({ local, sample, ...rest }) => {
    void local
    void sample
    return rest
  })
  write(DEMO_KEY, JSON.stringify(list))
}

// ── one note a minute ───────────────────────────────────────────────────────
export const COOLDOWN_MS = 60_000

/** ms left before this visitor can sign again (0 = go ahead). */
export function cooldownLeft(now = Date.now()) {
  const stored = Number(read(LAST_KEY) ?? 0) || 0
  const last = Math.max(stored, memoryLast)
  return Math.max(0, last + COOLDOWN_MS - now)
}

export function markSigned(now = Date.now()) {
  memoryLast = now
  write(LAST_KEY, String(now))
}

// ── a small, mild profanity check ───────────────────────────────────────────
// Matches whole-ish words with light leetspeak; it asks politely, it doesn't scold.
const WORDS = [
  'f+u+c+k+\\w*',
  'f+u+k+',
  'fck\\w*',
  'sh+i+t+\\w*',
  'b+i+t+c+h+\\w*',
  'a+s+s+h+o+l+e+\\w*',
  'b+a+s+t+a+r+d+\\w*',
  'c+u+n+t+\\w*',
  'd+i+c+k+(head)?s?',
  'p+u+s+s+y+',
  'w+h+o+r+e+\\w*',
  's+l+u+t+\\w*',
  'tw+a+t+s?',
  'wank\\w*',
  'retard\\w*',
  'stfu',
  'kys',
]
const PROFANITY = new RegExp(`(^|[^a-z])(${WORDS.join('|')})(?=$|[^a-z])`, 'i')

function deLeet(s: string) {
  return s
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[7+]/g, 't')
    .replace(/[*]/g, 'u')
}

export function isRude(...texts: string[]) {
  return texts.some((t) => PROFANITY.test(t) || PROFANITY.test(deLeet(t)))
}

// ── little bits ─────────────────────────────────────────────────────────────

/** "just now", "5m ago", "3h ago", "2d ago", "3w ago", "mar 4", "mar 4, 2025" */
export function relativeTime(iso: string, now: number) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  const w = Math.round(d / 7)
  if (d < 35) return `${w}w ago`
  const date = new Date(t)
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return date
    .toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })
    .toLowerCase()
}

/** Stable small tilt per note, in degrees (−2.6 … 2.6). */
export function tiltFor(id: string) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (((h >>> 0) % 1000) / 1000) * 5.2 - 2.6
}
