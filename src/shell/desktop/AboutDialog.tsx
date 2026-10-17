import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Logo } from '../../components/Logo'
import { links } from '../../content/links'
import { osName, profile } from '../../content/profile'
import { isAppOn } from '../../os/apps'
import { useReducedMotion } from '../../os/useMedia'
import { CloseGlyph } from './Glyphs'
import { useShellUI } from './shellStore'
import './about.css'

/**
 * "About {osName}": a small modal glass card with a one-line blurb and a short
 * privacy note. Rendered by both shells; the menu bar's "Privacy" item and the
 * phone home screen's "about & privacy" link open it at the privacy note.
 */
export function AboutDialog() {
  const open = useShellUI((s) => s.aboutOpen)
  return <AnimatePresence>{open && <AboutCard key="about" />}</AnimatePresence>
}

/** What the site does with visitors' data. Keep it short, plain and true. */
function PrivacyList() {
  return (
    <ul className="aboutos__plist">
      <li>
        <span aria-hidden="true">🏠</span>
        <span>
          Hosted on <b>GitHub Pages</b>, which keeps standard server logs (such as IP addresses).
        </span>
      </li>
      <li>
        <span aria-hidden="true">🍪</span>
        <span>No ads, analytics or tracking cookies. Your settings, like the mood, stay in this browser.</span>
      </li>
      {isAppOn('guestbook') ? (
        <li>
          <span aria-hidden="true">💌</span>
          <span>
            Guestbook notes are stored with <b>Supabase</b> and appear only after approval, so please leave personal
            info out.
          </span>
        </li>
      ) : null}
      <li>
        <span aria-hidden="true">▶️</span>
        <span>
          <b>YouTube</b> players load only when you press play (video thumbnails come from YouTube).
        </span>
      </li>
      <li>
        <span aria-hidden="true">✉️</span>
        <span>
          Questions, or a note you'd like taken down?{' '}
          {links.some((l) => !l.placeholder && !!l.href) ? 'Get in touch through Contact.' : 'Contact details are coming soon.'}
        </span>
      </li>
    </ul>
  )
}

function AboutCard() {
  const close = useShellUI((s) => s.closeAbout)
  const atPrivacy = useShellUI((s) => s.aboutPrivacy)
  const reduced = useReducedMotion()
  // while fading out, let clicks fall through to the desktop behind
  const present = useIsPresent()
  const cardRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const privacyRef = useRef<HTMLDetailsElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const [privacyOpen, setPrivacyOpen] = useState(atPrivacy)

  useEffect(() => {
    if (!returnTo.current) {
      const a = document.activeElement
      returnTo.current = a instanceof HTMLElement && a !== document.body ? a : null
    }
    closeRef.current?.focus({ preventScroll: true })
    const back = returnTo.current
    return () => {
      if (back?.isConnected && !back.closest('[inert]')) back.focus({ preventScroll: true })
    }
  }, [])

  // Opened from "Privacy": the note starts unfolded (privacyOpen's initial value); bring it
  // into view and put focus on its toggle. (Unfolding the element fires onToggle, which keeps
  // the state in step should this ever run on a dialog that's already open.)
  useEffect(() => {
    if (!atPrivacy) return
    const el = privacyRef.current
    if (!el) return
    el.open = true
    el.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true })
    const id = requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }))
    return () => cancelAnimationFrame(id)
  }, [atPrivacy, reduced])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
      return
    }
    if (e.key !== 'Tab') return
    // keep focus inside the dialog
    const f = Array.from(
      cardRef.current?.querySelectorAll<HTMLElement>('button, a[href], summary, [tabindex]:not([tabindex="-1"])') ?? [],
    )
    if (!f.length) return
    const first = f[0]
    const last = f[f.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="aboutos" style={present ? undefined : { pointerEvents: 'none' }}>
      <motion.div
        className="aboutos__scrim"
        aria-hidden="true"
        onPointerDown={close}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.18 } }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        ref={cardRef}
        className="aboutos__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.88, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8, transition: { duration: 0.16 } }}
        transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 420, damping: 28 }}
      >
        <button ref={closeRef} type="button" className="aboutos__close" aria-label={`Close About ${osName}`} onClick={close}>
          <CloseGlyph size={10} />
        </button>

        <div className="aboutos__logo" aria-hidden="true">
          <span className="aboutos__halo" />
          <Logo size={88} />
        </div>

        <h2 id={titleId} className="aboutos__title">
          {osName}
        </h2>
        <p className="aboutos__version">
          1.0 · first edition
        </p>

        <p className="aboutos__blurb">
          {profile.firstName}&rsquo;s little corner of the internet: projects, stories
          {isAppOn('guestbook') ? ' and a guestbook' : ' and the things behind them'}.
        </p>

        <details
          ref={privacyRef}
          className="aboutos__privacy"
          open={privacyOpen}
          onToggle={(e) => setPrivacyOpen(e.currentTarget.open)}
        >
          <summary className="aboutos__psum">
            <span className="aboutos__pic" aria-hidden="true">
              🔒
            </span>
            <span className="aboutos__ptitle kicker">privacy</span>
            <span className="aboutos__phint">your data, in plain words</span>
            <span className="aboutos__chev" aria-hidden="true" />
          </summary>
          <PrivacyList />
        </details>

        <p className="aboutos__made hand">
          made with <span className="aboutos__heart">♡</span> by {profile.firstName.toLowerCase()}
        </p>
      </motion.div>
    </div>
  )
}
