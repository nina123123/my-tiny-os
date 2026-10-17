import { AnimatePresence, motion } from 'motion/react'
import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import {
  addNote,
  isAvailable,
  isGuestbookError,
  LIMITS,
  listNotes,
  NOTE_COLORS,
  validateNote,
  type NoteColor,
} from '../../lib/guestbook'
import { profile } from '../../content/profile'
import { keepForWindow, peekStash } from '../../lib/windowStash'
import type { AppProps } from '../../os/types'
import { useReducedMotion } from '../../os/useMedia'
import {
  COLOR_NAMES,
  cooldownLeft,
  isRude,
  loadDemoNotes,
  markSigned,
  relativeTime,
  SAMPLES,
  saveDemoNote,
  STICKERS,
  tiltFor,
  type WallNote,
} from './local'
import './guestbook.css'

/*
 * Guestbook: write a note on a little sheet of paper and send it in. Notes are
 * pre-moderated: they're saved hidden in Supabase (src/lib/guestbook.ts) and go
 * up on the wall only once approved, so a sent note is never shown as if it were
 * live. Until the guestbook is connected (no env vars, or the table hasn't been
 * created yet) it runs on-device: 3 sample hellos from the owner + notes saved in this
 * browser only, with an "opens soon" banner.
 * The form keeps its own state (<SignForm>), so typing never re-renders the wall.
 */

type LoadState = 'loading' | 'ready' | 'error'

/** Masonry grid: row unit and the vertical gap under each note (px). Keep in sync with guestbook.css. */
const GRID_ROW = 4
const NOTE_GAP = 24
type FieldErrors = { name?: string; message?: string; form?: string }
/** An unsent note, carried across a desktop ⇄ phone shell swap (see lib/windowStash). */
type Draft = { name: string; message: string; sticker: string; color: NoteColor }
const DRAFT_KEY = 'guestbook-draft'

/** The on-device wall: this visitor's own notes, then the owner's sample hellos. */
const localWall = (): WallNote[] => [...loadDemoNotes(), ...SAMPLES]

/** The owner's name as the notes address them */
const host = profile.firstName.toLowerCase()

/** Shown under the form whenever notes really go out. */
const PUBLIC_NOTICE = 'Notes are public and appear after approval. Please don’t include personal info.'

export default function App({ isMobile, windowId }: AppProps) {
  /** Notes go to Supabase (false: not connected yet, notes stay on this device). */
  const [live, setLive] = useState(isAvailable)
  const reduced = useReducedMotion()
  const ids = useId()
  const wallTitleId = `${ids}-wall`

  const [notes, setNotes] = useState<WallNote[]>(() => (live ? [] : localWall()))
  const [load, setLoad] = useState<LoadState>(live ? 'loading' : 'ready')
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [justAdded, setJustAdded] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const wallRef = useRef<HTMLElement>(null)
  const wallTitleRef = useRef<HTMLHeadingElement>(null)

  /** The table isn't there yet: quietly switch to the on-device guestbook. */
  const goLocal = useCallback(() => {
    setLive(false)
    setNotes(localWall())
    setLoad('ready')
  }, [])

  // ── load the wall (approved notes only) ───────────────────────────────────
  useEffect(() => {
    if (!live) return
    const ctrl = new AbortController()
    listNotes({ signal: ctrl.signal })
      .then((list) => {
        if (ctrl.signal.aborted) return // superseded by a retry, or the app closed
        setNotes(list)
        setLoad('ready')
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return
        if (isGuestbookError(err) && err.kind === 'unavailable') {
          goLocal()
          return
        }
        setLoadError(isGuestbookError(err) ? err.message : "couldn't load the wall")
        setLoad('error')
      })
    return () => ctrl.abort()
  }, [live, attempt, goLocal])

  const retry = () => {
    setLoad('loading')
    setLoadError('')
    setAttempt((a) => a + 1)
  }

  // ── masonry: each card spans as many 4px grid rows as it is tall ──────────
  const roRef = useRef<ResizeObserver | null>(null)
  const measure = useCallback((el: HTMLElement | null) => {
    if (!el || typeof ResizeObserver === 'undefined') return
    if (!roRef.current) {
      roRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const h = entry.borderBoxSize?.[0]?.blockSize ?? (entry.target as HTMLElement).offsetHeight
          ;(entry.target as HTMLElement).style.gridRowEnd = `span ${Math.ceil((h + NOTE_GAP) / GRID_ROW)}`
        }
      })
    }
    const ro = roRef.current
    ro.observe(el)
    return () => ro.unobserve(el)
  }, [])
  useEffect(() => () => roRef.current?.disconnect(), [])

  // Relative times tick over once a minute.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  // ── an on-device note lands on the wall (sent notes wait for approval instead) ──
  const onSigned = useCallback(
    (note: WallNote) => {
      setNotes((list) => [note, ...list.filter((n) => n.id !== note.id)])
      setJustAdded(note.id)
      setNow(Date.now())
      // Let the new card mount, then bring it into view.
      requestAnimationFrame(() => {
        const el = scrollRef.current?.querySelector<HTMLElement>(`[data-note-id="${CSS.escape(note.id)}"]`)
        el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
      })
    },
    [reduced],
  )

  const readWall = () => {
    wallRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    // Keyboard and screen-reader users land on the wall too, not back in the form.
    wallTitleRef.current?.focus({ preventScroll: true })
  }

  const count = notes.filter((n) => !n.sample).length

  return (
    <div className="gb" data-mobile={isMobile || undefined}>
      <div className="gb__scroll" ref={scrollRef}>
        <header className="gb__hero">
          <p className="kicker">
            guestbook · {live ? (load === 'ready' ? `${count} ${count === 1 ? 'note' : 'notes'}` : 'say hi') : 'opening soon'}
          </p>
          <h2 className="gb__title">
            sign my <em>guestbook</em> <span aria-hidden="true">✍️</span>
          </h2>
          <p className="gb__lede">
            say hi, leave a wish, or tell me what you liked.{live && ' every note is read before it goes up on the wall.'}
          </p>
          <button type="button" className="gb__peek" onClick={readWall}>
            read the wall <span aria-hidden="true">↓</span>
          </button>
          {!live && (
            <p className="gb__demo" role="note">
              the guestbook opens soon ✨ for now, notes you write here stay on your device 💌
            </p>
          )}
        </header>

        <div className="gb__layout">
          {/* ── the form: a sheet of paper you write on ─────────── */}
          <SignForm live={live} reduced={reduced} windowId={windowId} onSigned={onSigned} onUnavailable={goLocal} />

          {/* ── the wall ──────────────────────────────────────── */}
          <section ref={wallRef} className="gb__wall-wrap" aria-labelledby={wallTitleId} aria-busy={load === 'loading' || undefined}>
            <div className="gb__wall-head">
              <h3 id={wallTitleId} ref={wallTitleRef} className="gb__wall-title" tabIndex={-1}>
                the wall
              </h3>
              {load === 'ready' && notes.length > 0 && (
                <span className="gb__wall-count">
                  {notes.length} {notes.length === 1 ? 'note' : 'notes'}
                </span>
              )}
            </div>

            {load === 'loading' && (
              <div className="gb__wall" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="gb__skeleton"
                    style={
                      {
                        '--i': i,
                        height: 110 + i * 26,
                        gridRowEnd: `span ${Math.ceil((110 + i * 26 + NOTE_GAP) / GRID_ROW)}`,
                      } as CSSProperties
                    }
                  />
                ))}
                <span className="sr-only">loading notes…</span>
              </div>
            )}

            {load === 'error' && (
              <div className="gb__state" role="alert">
                <span className="gb__state-emoji" aria-hidden="true">
                  🫠
                </span>
                <p className="gb__state-title">couldn’t load the wall</p>
                <p className="gb__state-body">{loadError}</p>
                <button type="button" className="gb__retry" onClick={retry}>
                  try again
                </button>
              </div>
            )}

            {load === 'ready' && notes.length === 0 && (
              <div className="gb__state gb__state--empty">
                <span className="gb__state-emoji" aria-hidden="true">
                  📝
                </span>
                <p className="gb__state-title">the wall is empty… for now</p>
                <p className="gb__state-body">be the first to sign it! notes show up here once they’re approved.</p>
              </div>
            )}

            {load === 'ready' && notes.length > 0 && (
              <ul className="gb__wall">
                <AnimatePresence initial={false}>
                  {notes.map((n, i) => (
                    <NoteCard
                      key={n.id}
                      note={n}
                      now={now}
                      fresh={n.id === justAdded}
                      index={i}
                      reduced={reduced}
                      measure={measure}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

/** The sheet of paper. Owns every bit of form state, so a keystroke only re-renders this. */
function SignForm({
  live,
  reduced,
  windowId,
  onSigned,
  onUnavailable,
}: {
  live: boolean
  reduced: boolean
  windowId: string
  /** An on-device note was saved: put it on the wall. */
  onSigned: (note: WallNote) => void
  /** Sending found no guestbook table: switch the whole app to on-device mode. */
  onUnavailable: () => void
}) {
  const ids = useId()
  const nameId = `${ids}-name`
  const msgId = `${ids}-msg`
  const counterId = `${ids}-counter`
  const formTitleId = `${ids}-form`
  const noticeId = `${ids}-notice`

  // Back from a shell swap? Keep the half-written note.
  const [saved] = useState(() => peekStash<Draft>(windowId, DRAFT_KEY) ?? null)
  const [name, setName] = useState(() => saved?.name ?? '')
  const [message, setMessage] = useState(() => saved?.message ?? '')
  const [sticker, setSticker] = useState<string>(() => saved?.sticker ?? STICKERS[0])
  const [color, setColor] = useState<NoteColor>(() => saved?.color ?? 'lavender')
  const [honey, setHoney] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('')

  const nameRef = useRef<HTMLInputElement>(null)
  const msgRef = useRef<HTMLTextAreaElement>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  // Mirror the draft for the other shell's copy of this form (cleared when the window closes).
  useLayoutEffect(() => {
    keepForWindow<Draft>(windowId, DRAFT_KEY, { name, message, sticker, color })
  }, [windowId, name, message, sticker, color])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (sending) return
    setStatus('')

    // Bots fill every field; people never see this one.
    if (honey) {
      setMessage('')
      setStatus('thank you! 💌')
      return
    }

    const draft = { name: name.trim(), message: message.trim(), sticker, color }
    const next: FieldErrors = {}
    if (!draft.name) next.name = `add your name so ${host} knows who it’s from`
    else if (draft.name.length > LIMITS.name) next.name = `names can be up to ${LIMITS.name} characters`
    if (!draft.message) next.message = 'write a little message first'
    else if (draft.message.length > LIMITS.message) next.message = `notes can be up to ${LIMITS.message} characters`
    if (!next.name && !next.message) {
      if (isRude(draft.name, draft.message)) {
        next.message = 'could you say that a little more kindly? try rephrasing 🌷'
      } else {
        const problem = validateNote(draft)
        if (problem) next.form = problem
      }
    }
    if (next.name || next.message || next.form) {
      setErrors(next)
      // the first field that needs fixing, in reading order (the note comes before the name)
      ;(next.message ? msgRef : nameRef).current?.focus()
      return
    }

    const wait = cooldownLeft()
    if (wait > 0) {
      setErrors({ form: `you just signed! give it ${Math.ceil(wait / 1000)}s before the next note ⏳` })
      return
    }

    setErrors({})
    setSending(true)
    try {
      let fellBack = false
      if (live) {
        try {
          // Saved hidden: it shows on the wall only after it's approved.
          await addNote(draft)
          markSigned()
          if (!alive.current) return
          setMessage('')
          setStatus('thank you! 💌 your note will appear on the wall once it’s approved.')
          return
        } catch (err) {
          if (!(isGuestbookError(err) && err.kind === 'unavailable')) throw err
          // No table yet: keep the note on this device instead of losing it.
          onUnavailable()
          fellBack = true
        }
      }
      const note: WallNote = { ...draft, id: `local-${Date.now().toString(36)}`, created_at: new Date().toISOString(), local: true }
      saveDemoNote(note)
      markSigned()
      if (!alive.current) return
      onSigned(note)
      setMessage('')
      setStatus(
        fellBack
          ? 'the guestbook isn’t open yet, so your note stays on this device for now 💌'
          : 'your note is on the wall (on this device) 💌',
      )
    } catch (err) {
      if (!alive.current) return
      setErrors({ form: isGuestbookError(err) ? err.message : 'something went wrong. try again?' })
    } finally {
      if (alive.current) setSending(false)
    }
  }

  const remaining = LIMITS.message - message.length

  return (
    <form className="gb__form" onSubmit={submit} noValidate aria-labelledby={formTitleId} aria-describedby={noticeId}>
      <h3 id={formTitleId} className="gb__form-title">
        write a note
      </h3>

      <div className="gb__paper" data-color={color}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={sticker}
            className="gb__paper-sticker"
            aria-hidden="true"
            initial={reduced ? { opacity: 0 } : { scale: 0.2, rotate: -40, opacity: 0 }}
            animate={{ scale: 1, rotate: 12, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { scale: 0.2, opacity: 0, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 18 }}
          >
            {sticker}
          </motion.span>
        </AnimatePresence>

        <label htmlFor={msgId} className="gb__label">
          your note
        </label>
        <textarea
          ref={msgRef}
          id={msgId}
          className="gb__msg"
          required
          aria-required="true"
          rows={4}
          maxLength={LIMITS.message}
          placeholder={`dear ${host}, …`}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value)
            if (errors.message) setErrors((x) => ({ ...x, message: undefined }))
          }}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={`${counterId}${errors.message ? ` ${msgId}-err` : ''}`}
        />
        <div className="gb__paper-foot">
          <label htmlFor={nameId} className="gb__sign-label">
            signed,
          </label>
          <input
            ref={nameRef}
            id={nameId}
            className="gb__name"
            type="text"
            required
            aria-required="true"
            maxLength={LIMITS.name}
            autoComplete="nickname"
            placeholder="name or nickname"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (errors.name) setErrors((x) => ({ ...x, name: undefined }))
            }}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${nameId}-err` : undefined}
          />
          <span id={counterId} className="gb__counter" data-low={remaining <= 20 || undefined}>
            <span aria-hidden="true">
              {message.length}/{LIMITS.message}
            </span>
            <span className="sr-only">{remaining} characters left</span>
          </span>
        </div>
      </div>

      {(errors.message || errors.name) && (
        <div className="gb__field-errors">
          {errors.message && (
            <p id={`${msgId}-err`} className="gb__error">
              {errors.message}
            </p>
          )}
          {errors.name && (
            <p id={`${nameId}-err`} className="gb__error">
              {errors.name}
            </p>
          )}
        </div>
      )}

      <fieldset className="gb__pick">
        <legend className="gb__legend">sticker</legend>
        <div className="gb__options gb__options--stickers">
          {STICKERS.map((s) => (
            <label key={s} className="gb__sticker-opt">
              <input
                type="radio"
                name={`${ids}-sticker`}
                value={s}
                checked={sticker === s}
                onChange={() => setSticker(s)}
                className="gb__radio"
              />
              <span className="gb__sticker-face">{s}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="gb__pick">
        <legend className="gb__legend">paper</legend>
        <div className="gb__options">
          {NOTE_COLORS.map((c) => (
            <label key={c} className="gb__color-opt" title={COLOR_NAMES[c]}>
              <input
                type="radio"
                name={`${ids}-color`}
                value={c}
                checked={color === c}
                onChange={() => setColor(c)}
                className="gb__radio"
              />
              <span className="gb__swatch" data-color={c}>
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="sr-only">{COLOR_NAMES[c]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* honeypot: hidden from people and assistive tech */}
      <div className="gb__hp" aria-hidden="true">
        <label>
          leave this empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honey} onChange={(e) => setHoney(e.target.value)} />
        </label>
      </div>

      <div className="gb__actions">
        <button type="submit" className="gb__submit" disabled={sending} aria-busy={sending || undefined}>
          {sending ? (
            <>
              <span className="gb__spinner" aria-hidden="true" /> {live ? 'sending…' : 'sticking…'}
            </>
          ) : live ? (
            <>
              send my note <span aria-hidden="true">💌</span>
            </>
          ) : (
            <>
              stick it on the wall <span aria-hidden="true">📌</span>
            </>
          )}
        </button>
        <div className="gb__feedback" aria-live="polite">
          {errors.form && (
            <p className="gb__error" role="alert">
              {errors.form}
            </p>
          )}
          {status && !errors.form && <p className="gb__ok">{status}</p>}
        </div>
      </div>

      <p id={noticeId} className="gb__notice">
        {live ? PUBLIC_NOTICE : 'For now, notes stay on this device. Please don’t include personal info.'}
      </p>
    </form>
  )
}

const NoteCard = memo(function NoteCard({
  note,
  now,
  fresh,
  index,
  reduced,
  measure,
}: {
  note: WallNote
  now: number
  fresh: boolean
  index: number
  reduced: boolean
  measure: (el: HTMLElement | null) => (() => void) | undefined
}) {
  const liRef = useRef<HTMLLIElement>(null)
  useEffect(() => measure(liRef.current), [measure])
  const tilt = tiltFor(note.id)
  const when = note.sample ? '' : relativeTime(note.created_at, now)
  const initial = reduced
    ? { opacity: 0 }
    : fresh
      ? { opacity: 0, y: -140, scale: 1.18, rotate: tilt - 14 }
      : { opacity: 0, y: 14, rotate: tilt }
  return (
    <motion.li
      ref={liRef}
      layout={reduced ? false : 'position'}
      className="gb__note"
      data-color={note.color}
      data-note-id={note.id}
      data-fresh={fresh || undefined}
      initial={initial}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: tilt }}
      whileHover={reduced ? undefined : { rotate: 0, y: -4, transition: { type: 'spring', stiffness: 400, damping: 22 } }}
      transition={
        fresh
          ? { type: 'spring', stiffness: 240, damping: 15, mass: 1.1 }
          : { type: 'spring', stiffness: 260, damping: 26, delay: Math.min(index, 12) * 0.035 }
      }
    >
      <span className="gb__tape" aria-hidden="true" style={{ rotate: `${-tilt * 2}deg` } as CSSProperties} />
      {note.sticker && (
        <span className="gb__note-sticker" aria-hidden="true">
          {note.sticker}
        </span>
      )}
      <p className="gb__note-msg">{note.message}</p>
      <footer className="gb__note-foot">
        <span className="gb__note-name">
          <span className="sr-only">from </span>— {note.name}
        </span>
        {note.sample ? (
          <span className="gb__chip">sample</span>
        ) : (
          when && (
            <time className="gb__note-time" dateTime={note.created_at}>
              {when}
            </time>
          )
        )}
      </footer>
    </motion.li>
  )
})
