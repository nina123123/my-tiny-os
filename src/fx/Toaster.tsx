import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { rectOf } from '../os/anchors'
import { getApp } from '../os/apps'
import { osName } from '../content/profile'
import { useNotify, type Notice } from '../os/notify'
import { useWindows } from '../os/store'
import { useIsMobile, useReducedMotion } from '../os/useMedia'
import './toaster.css'

/*
 * Renders useNotify() notices inside one aria-live="polite" region.
 *  - desktop: glass cards top-right under the menu bar; newest on top, the rest
 *    slide down. Auto-dismiss after `duration` (default 4500ms), paused while
 *    hovered or focused. Clicking a notice with an appId opens that app.
 *  - mobile: a banner under the status bar (10px side margins); older notices
 *    tuck in behind it as a little stack. Swipe up to dismiss.
 */

const DEFAULT_DURATION = 4500

/** Gradient for the emoji bubble, picked from the notice so it stays stable. */
const BUBBLES = [
  ['var(--lavender-300)', 'var(--peach-300)'],
  ['var(--peach-300)', 'var(--butter-300)'],
  ['var(--pink-300)', 'var(--lavender-300)'],
  ['var(--mint-300)', 'var(--sky-300)'],
  ['var(--butter-300)', 'var(--coral-300)'],
] as const

function bubbleFor(n: Notice) {
  let h = 0
  for (const ch of n.title) h = (h * 31 + ch.charCodeAt(0)) | 0
  return BUBBLES[Math.abs(h) % BUBBLES.length]
}

export function Toaster() {
  const notices = useNotify((s) => s.notices)
  const isMobile = useIsMobile()
  const reduced = useReducedMotion()
  const ordered = [...notices].reverse() // newest first

  return (
    <section className="toaster" data-mobile={isMobile || undefined} aria-live="polite" aria-label="Notifications">
      <AnimatePresence initial={false} mode="popLayout">
        {ordered.map((n, i) => (
          <Toast key={n.id} notice={n} index={i} mobile={isMobile} reduced={reduced} />
        ))}
      </AnimatePresence>
    </section>
  )
}

const spring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 } as const

function Toast({ notice, index, mobile, reduced }: { notice: Notice; index: number; mobile: boolean; reduced: boolean }) {
  const dismiss = useNotify((s) => s.dismiss)
  const duration = notice.duration ?? DEFAULT_DURATION
  const ref = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const dragged = useRef(false)
  // the same id can be re-notified with new content → restart the timer
  const [shown, setShown] = useState(notice)
  const [version, setVersion] = useState(0)
  if (shown !== notice) {
    setShown(notice)
    setVersion((v) => v + 1)
  }
  const remaining = useRef({ version: 0, ms: duration })

  // background stack items (mobile) never count down; only the front banner does
  const paused = hovered || focused || (mobile && index > 0)

  useEffect(() => {
    if (paused) return
    if (remaining.current.version !== version) remaining.current = { version, ms: duration }
    const started = performance.now()
    const t = window.setTimeout(() => dismiss(notice.id), Math.max(0, remaining.current.ms))
    return () => {
      window.clearTimeout(t)
      remaining.current.ms -= performance.now() - started
    }
  }, [paused, version, duration, dismiss, notice.id])

  const app = notice.appId ? getApp(notice.appId) : null
  const [g1, g2] = bubbleFor(notice)

  const openApp = () => {
    if (dragged.current || !notice.appId) return
    useWindows.getState().open(notice.appId, { origin: rectOf(ref.current) ?? undefined })
    dismiss(notice.id)
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y < -36 || info.velocity.y < -380) dismiss(notice.id)
    // let the click that ends a drag be ignored
    window.setTimeout(() => {
      dragged.current = false
    }, 0)
  }

  const content = (
    <>
      <span className="toast__icon" aria-hidden="true" style={{ '--g1': g1, '--g2': g2 } as CSSProperties}>
        <span>{notice.icon ?? '✨'}</span>
      </span>
      <span className="toast__text">
        <span className="toast__meta" aria-hidden="true">
          {app ? app.name : osName} · now
        </span>
        <span className="toast__title">{notice.title}</span>
        {notice.body ? <span className="toast__body">{notice.body}</span> : null}
      </span>
    </>
  )

  // motion targets
  const desktopIn = { x: 0, y: 0, opacity: 1, scale: 1 }
  const stackDepth = Math.min(index, 2)
  const mobileIn = {
    x: 0,
    y: stackDepth * 10,
    opacity: index > 2 ? 0 : 1 - stackDepth * 0.18,
    scale: 1 - stackDepth * 0.05,
  }
  const initial = reduced ? { opacity: 0 } : mobile ? { y: -90, opacity: 0, scale: 0.96 } : { x: 380, opacity: 0, scale: 0.96 }
  const exit = reduced
    ? { opacity: 0, transition: { duration: 0.15 } }
    : mobile
      ? { y: -120, opacity: 0, transition: { duration: 0.22 } }
      : { x: 380, opacity: 0, transition: { type: 'spring', stiffness: 380, damping: 36 } as const }

  return (
    <motion.div
      ref={ref}
      layout={mobile ? false : 'position'}
      className="toast glass"
      data-front={index === 0 || undefined}
      data-appid={notice.appId}
      data-paused={paused || undefined}
      style={mobile ? { zIndex: 10 - index } : undefined}
      initial={initial}
      animate={mobile ? mobileIn : desktopIn}
      exit={exit}
      transition={reduced ? { duration: 0.15 } : spring}
      drag={mobile && index === 0 && !reduced ? 'y' : false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.9, bottom: 0.12 }}
      dragSnapToOrigin
      onDragStart={() => {
        dragged.current = true
      }}
      onDragEnd={onDragEnd}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
      aria-hidden={mobile && index > 0 ? true : undefined}
      inert={mobile && index > 0 ? true : undefined}
    >
      {notice.appId ? (
        <button type="button" className="toast__main" onClick={openApp} aria-label={`${notice.title}${notice.body ? `. ${notice.body}` : ''}. Open ${app?.name ?? 'app'}`}>
          {content}
        </button>
      ) : (
        <div className="toast__main">{content}</div>
      )}
      <button type="button" className="toast__close" onClick={() => dismiss(notice.id)} aria-label={`Dismiss notification: ${notice.title}`}>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
      {!reduced && (!mobile || index === 0) ? (
        <span key={version} className="toast__timer" aria-hidden="true" style={{ animationDuration: `${duration}ms` }} />
      ) : null}
      {mobile && index === 0 ? <span className="toast__grabber" aria-hidden="true" /> : null}
    </motion.div>
  )
}
