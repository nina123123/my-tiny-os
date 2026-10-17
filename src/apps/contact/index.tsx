import { motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { links } from '../../content/links'
import { profile } from '../../content/profile'
import type { ContactLink } from '../../content/types'
import { isAppOn } from '../../os/apps'
import { getAnchor, rectOf } from '../../os/anchors'
import { notify } from '../../os/notify'
import { useWindows } from '../../os/store'
import type { AppProps, Rect } from '../../os/types'
import { useReducedMotion } from '../../os/useMedia'
import './contact.css'

/*
 * Contact: "say hi 👋". Glass link cards for every entry in
 * src/content/links.ts (email links get a copy button, placeholders a soft
 * "coming soon"), plus a paper plane that loops across the screen and lands
 * in the guestbook.
 */

const isEmail = (l: ContactLink) => l.href.startsWith('mailto:')
const emailOf = (l: ContactLink) => decodeURIComponent(l.href.replace(/^mailto:/, '').split('?')[0])

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

export default function App({ isMobile }: AppProps) {
  const reduced = useReducedMotion()
  const [flight, setFlight] = useState<Flight | null>(null)
  const planeBtn = useRef<HTMLButtonElement>(null)
  const hintId = useId()
  const avatar = profile.avatar
  // any real link yet? (cards with placeholder: true or no href show as "coming soon")
  const ready = links.some((l) => !l.placeholder && !!l.href)

  const openGuestbook = (origin?: Rect | null) => {
    useWindows.getState().open('guestbook', { origin: origin ?? rectOf(planeBtn.current) ?? undefined })
  }

  const sendPlane = () => {
    if (flight) return
    const from = rectOf(planeBtn.current)
    if (reduced || !from) {
      openGuestbook(from)
      return
    }
    const anchor = isMobile ? null : getAnchor('guestbook')
    const onScreen =
      anchor && anchor.width > 0 && anchor.x > -10 && anchor.y > -10 && anchor.x < window.innerWidth && anchor.y < window.innerHeight
    setFlight(planFlight(from, onScreen ? anchor : null))
  }

  const landed = () => {
    const target = flight?.target ?? null
    setFlight(null)
    openGuestbook(target)
  }

  const copy = async (l: ContactLink) => {
    const email = emailOf(l)
    const ok = await copyText(email)
    notify(
      ok
        ? { title: 'copied!', body: email, icon: '📋', duration: 2600 }
        : { title: "couldn't copy", body: email, icon: '🫠', duration: 4000 },
    )
  }

  return (
    <div className="contact" data-mobile={isMobile || undefined}>
      <div className="contact__scroll">
        <div className="contact__inner">
        <header className="contact__hero">
          <div className="contact__connect" aria-hidden="true">
            <span className="contact__me">
              {avatar ? <img src={avatar} alt="" width={64} height={64} decoding="async" /> : <span>{profile.firstName[0]}</span>}
            </span>
            <span className="contact__thread" />
            <span className="contact__knot">💌</span>
            <span className="contact__thread contact__thread--rev" />
            <span className="contact__you hand">you!</span>
          </div>

          <h2 className="contact__title">
            say hi{' '}
            <span className="contact__wave" aria-hidden="true">
              👋
            </span>
          </h2>
          <p className="contact__lede">{ready ? 'here’s where to find me ✨' : 'contact details are coming soon ✨'}</p>
          <p className="contact__name kicker">{profile.fullName}</p>
        </header>

        <ul className="contact__links">
          {links.map((l, i) => (
            <li key={l.id} style={{ '--i': i } as CSSProperties}>
              <LinkCard link={l} index={i} onCopy={copy} />
            </li>
          ))}
        </ul>

        {/* the paper plane flies into the guestbook, so it's only here while the guestbook is on */}
        {isAppOn('guestbook') ? (
          <div className="contact__plane-row">
            <button
              ref={planeBtn}
              type="button"
              className="contact__plane-btn"
              onClick={sendPlane}
              aria-disabled={flight ? true : undefined}
              aria-describedby={hintId}
            >
              <span className="contact__plane-icon" aria-hidden="true">
                <PlaneGlyph />
              </span>
              send a paper plane <span aria-hidden="true">✈️</span>
            </button>
            <p id={hintId} className="contact__plane-hint hand">
              it lands in my guestbook!
            </p>
          </div>
        ) : null}
        </div>
      </div>

      {flight && createPortal(<PlaneFlight flight={flight} onDone={landed} />, document.body)}
    </div>
  )
}

function LinkCard({ link, index, onCopy }: { link: ContactLink; index: number; onCopy: (l: ContactLink) => void }) {
  const soon = link.placeholder || !link.href
  const tone = (['lavender', 'peach', 'butter', 'mint', 'sky', 'pink'] as const)[index % 6]

  if (soon) {
    return (
      <div className="contact__card contact__card--soon">
        <span className="contact__emoji" data-tone={tone} aria-hidden="true">
          {link.emoji}
        </span>
        <span className="contact__text">
          <span className="contact__label">{link.label}</span>
          <span className="contact__handle">{link.handle || 'on its way'}</span>
        </span>
        <span className="contact__soon">coming soon</span>
      </div>
    )
  }

  const external = !isEmail(link)
  return (
    <div className="contact__card" data-email={isEmail(link) || undefined}>
      <a
        className="contact__hit"
        href={link.href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
      >
        <span className="contact__emoji" data-tone={tone} aria-hidden="true">
          {link.emoji}
        </span>
        <span className="contact__text">
          <span className="contact__label">{link.label}</span>
          <span className="contact__handle">{link.handle}</span>
        </span>
        {external && <span className="sr-only"> (opens in a new tab)</span>}
        <span className="contact__go" aria-hidden="true">
          ↗
        </span>
      </a>
      {isEmail(link) && (
        <button type="button" className="contact__copy" onClick={() => onCopy(link)} aria-label={`copy ${emailOf(link)}`}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect x="8.5" y="8.5" width="11" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M15.5 5.5v-.5a2.5 2.5 0 0 0-2.5-2.5H7A2.5 2.5 0 0 0 4.5 5v6A2.5 2.5 0 0 0 7 13.5h.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}

/* ── the paper plane ───────────────────────────────────────────────────── */

type Flight = {
  xs: number[]
  ys: number[]
  rs: number[]
  scale: number[]
  opacity: number[]
  trail: { x: number; y: number; t: number }[]
  duration: number
  target: Rect | null
}

const N = 36

/** A swoopy path from the button, through a loop-de-loop, to the guestbook icon (or off-screen). */
function planFlight(from: Rect, target: Rect | null): Flight {
  const W = window.innerWidth
  const H = window.innerHeight
  const S = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
  const E = target ? { x: target.x + target.width / 2, y: target.y + target.height / 2 } : { x: W + 80, y: Math.max(-80, S.y - H * 0.75) }
  const dx = E.x - S.x
  // swoop out toward the roomier side of the screen, then come back around
  const side = S.x < W / 2 ? 1 : -1
  const sweep = Math.min(W * 0.42, 560) * side
  const lift = Math.min(340, H * 0.4)
  const c1 = { x: S.x + sweep * 0.9, y: S.y - lift * 1.1 }
  const c2 = { x: E.x + sweep * 0.8 + dx * 0.2, y: Math.min(S.y, E.y) - lift * 0.5 }
  const R = Math.max(40, Math.min(84, W * 0.065))
  const bez = (t: number, a: number, b: number, c: number, d: number) =>
    (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d
  const ease = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2

  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < N; i++) {
    const t = ease(i / (N - 1))
    let x = bez(t, S.x, c1.x, c2.x, E.x)
    let y = bez(t, S.y, c1.y, c2.y, E.y)
    const u = (t - 0.34) / 0.3
    if (u > 0 && u < 1) {
      const a = Math.PI * 2 * u
      x += R * Math.sin(a) * side
      y -= R * (1 - Math.cos(a))
    }
    pts.push({ x, y })
  }

  // heading from the path's direction, unwrapped so it never spins the long way round
  const rs: number[] = []
  let prev = 0
  for (let i = 0; i < N; i++) {
    const a = pts[Math.min(i + 1, N - 1)]
    const b = pts[Math.max(i - 1, 0)]
    let deg = (Math.atan2(a.y - b.y, a.x - b.x) * 180) / Math.PI
    if (i > 0) {
      while (deg - prev > 180) deg -= 360
      while (deg - prev < -180) deg += 360
    }
    rs.push(deg)
    prev = deg
  }

  const duration = 1.9
  return {
    xs: pts.map((p) => p.x),
    ys: pts.map((p) => p.y),
    rs,
    scale: pts.map((_, i) => (i === 0 ? 0.6 : target && i > N - 6 ? 1 - ((i - (N - 6)) / 5) * 0.65 : 1)),
    opacity: pts.map((_, i) => (i === 0 ? 0 : i >= N - 1 ? 0 : 1)),
    trail: pts.flatMap((p, i) => (i > 1 && i < N - 2 ? [{ ...p, t: i / (N - 1) }] : [])),
    duration,
    target,
  }
}

function PlaneFlight({ flight, onDone }: { flight: Flight; onDone: () => void }) {
  const onDoneRef = useRef(onDone)
  const landed = useRef(false)
  useEffect(() => {
    onDoneRef.current = onDone
  })
  const done = useRef(() => {
    if (landed.current) return
    landed.current = true
    onDoneRef.current()
  })
  // Safety net: land even if the animation callback never fires (e.g. tab hidden).
  useEffect(() => {
    const t = window.setTimeout(() => done.current(), flight.duration * 1000 + 900)
    return () => window.clearTimeout(t)
  }, [flight])

  return (
    <div className="contact-sky" aria-hidden="true">
      {flight.trail.map((p, i) => (
        <motion.span
          key={i}
          className="contact-sky__puff"
          data-tone={i % 3}
          style={{ left: p.x, top: p.y }}
          initial={{ opacity: 0, scale: 0.2 }}
          animate={{ opacity: [0, 0.95, 0], scale: [0.2, 1, 0.5] }}
          transition={{ duration: 1.1, delay: p.t * flight.duration, ease: 'easeOut', times: [0, 0.15, 1] }}
        />
      ))}
      <motion.div
        className="contact-sky__plane"
        initial={{ x: flight.xs[0], y: flight.ys[0], rotate: flight.rs[0], scale: 0.6, opacity: 0 }}
        animate={{ x: flight.xs, y: flight.ys, rotate: flight.rs, scale: flight.scale, opacity: flight.opacity }}
        transition={{ duration: flight.duration, ease: 'linear' }}
        onAnimationComplete={() => done.current()}
      >
        <PlaneGlyph big />
      </motion.div>
    </div>
  )
}

function PlaneGlyph({ big = false }: { big?: boolean }) {
  const s = big ? 56 : 22
  return (
    <svg viewBox="0 0 48 48" width={s} height={s}>
      {/* a folded paper plane pointing right */}
      <path d="M4 22.5 44 6 30 42 22.5 28.5Z" fill="#fff" stroke="#3b2559" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M44 6 22.5 28.5 20 38.5 26 31.5" fill="#ffcbb3" stroke="#3b2559" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M44 6 4 22.5 22.5 28.5Z" fill="#e9e1ff" stroke="#3b2559" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  )
}
