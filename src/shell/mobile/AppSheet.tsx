import {
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  usePresence,
  useTransform,
  type ValueAnimationTransition,
} from 'motion/react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent, type SyntheticEvent } from 'react'
import { AppIcon } from '../../components/AppIcon'
import { getAnchor } from '../../os/anchors'
import { AppHost } from '../../os/AppHost'
import { getApp } from '../../os/apps'
import type { WindowState } from '../../os/types'
import { useReducedMotion } from '../../os/useMedia'
import {
  clamp01,
  isIconish,
  isOnScreen,
  lerp,
  poseAt,
  restPose,
  sheetFrame,
  span,
  type Pose,
  type Segment,
} from './geometry'

/*
 * One app as a full-screen sheet (or a card, when stacked on another sheet).
 *
 * The panel's look is a function of a single spring `q` (0 → 1) that moves
 * it between two poses (a segment) — open: origin rect → rest; close:
 * wherever it is → home icon (or off the bottom). The header drag adds
 * dragY / dragK on top, and the sheet underneath gets `--lift` so it
 * springs forward as this one is pulled away.
 */

const CARD_RADIUS = 26
const DRAG_RADIUS = 30
const SPRING_OPEN = { type: 'spring', stiffness: 250, damping: 27, restDelta: 0.0005, restSpeed: 0.002 } as const
const SPRING_CLOSE = { type: 'spring', stiffness: 300, damping: 33, restDelta: 0.0005, restSpeed: 0.002 } as const
const FADE = { duration: 0.18, ease: 'easeOut' } as const
/**
 * How long a freshly opened sheet's content ignores taps (the double-tap guard).
 * It covers the gap between a person's two taps (phones allow ~300–350ms), not
 * the opening animation, so it stays the same with reduced motion.
 */
const OPEN_GUARD_MS = 450

type Props = {
  win: WindowState
  /** Position in the stack (0 = directly over the home screen) */
  index: number
  isTop: boolean
  /** Title of the sheet underneath, for the back button's accessible name */
  underTitle?: string
  getUnder: () => HTMLElement | null
  registerLayer: (id: string, el: HTMLElement | null) => void
  registerHeading: (id: string, el: HTMLElement | null) => void
  onClose: (id: string) => void
  /** Play the opening zoom (false for sheets that already existed when the shell mounted) */
  animateIn?: boolean
}

/** Lift the layer underneath while dragging (0 = pushed back, 1 = at rest). */
function setLift(el: HTMLElement | null, p: number | null) {
  if (!el) return
  if (p === null) {
    el.classList.remove('is-lifting')
    el.style.removeProperty('--lift')
  } else {
    el.classList.add('is-lifting')
    el.style.setProperty('--lift', p.toFixed(4))
  }
}

function rubber(dist: number, max = 120) {
  return (1 - 1 / ((dist * 0.55) / max + 1)) * max
}

export function AppSheet({
  win,
  index,
  isTop,
  underTitle,
  getUnder,
  registerLayer,
  registerHeading,
  onClose,
  animateIn = true,
}: Props) {
  const app = getApp(win.appId)
  const reduced = useReducedMotion()
  const [isPresent, safeToRemove] = usePresence()
  const present = useIsPresent()
  const isCard = index > 0
  const interactive = isTop && present
  const titleId = useId()
  const layerRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // ── the opening segment, computed once at mount ────────────────────────
  const [initial] = useState<Segment>(() => {
    const rest = restPose(isCard ? CARD_RADIUS : 0, 0)
    if (!animateIn) return { a: rest, b: rest, co: [0, 1], sp: [0, 1], po: [0, 1] }
    if (reduced) return { a: { ...rest, po: 0 }, b: rest, co: [0, 1], sp: [0, 1], po: [0, 1] }
    const frame = sheetFrame(isCard)
    if (win.origin && win.origin.width > 0) {
      return { a: poseAt(win.origin, frame), b: rest, co: [0.06, 0.5], sp: [0.02, 0.42], po: [0, 0.001] }
    }
    // No origin: slide up from below the screen.
    return { a: { ...rest, y: frame.height + 24 }, b: rest, co: [0, 0.001], sp: [0, 1], po: [0, 0.001] }
  })
  const seg = useRef<Segment>(initial)

  const q = useMotionValue(0)
  const dragY = useMotionValue(0)
  const dragK = useMotionValue(0) // 0..1 how far the drag has gone (scale + corner rounding)
  const bump = useMotionValue(1) // "hello again" squish when re-opened

  const x = useTransform(() => lerp(seg.current.a.x, seg.current.b.x, q.get()))
  const y = useTransform(() => lerp(seg.current.a.y, seg.current.b.y, q.get()) + dragY.get())
  const scaleX = useTransform(() => lerp(seg.current.a.sx, seg.current.b.sx, q.get()) * (1 - dragK.get() * 0.07) * bump.get())
  const scaleY = useTransform(() => lerp(seg.current.a.sy, seg.current.b.sy, q.get()) * (1 - dragK.get() * 0.07) * bump.get())
  const radius = useTransform(() => {
    const s = seg.current
    const t = q.get()
    const k = dragK.get()
    const r = Math.max(0, lerp(s.a.r, s.b.r, t) + k * DRAG_RADIUS)
    const rb = Math.max(0, lerp(s.a.rb, s.b.rb, t) + k * DRAG_RADIUS)
    const X = Math.max(0.02, scaleX.get())
    const Y = Math.max(0.02, scaleY.get())
    // Undo the (non-uniform) scale so corners stay round at every size.
    const h = (v: number) => (v / X).toFixed(2)
    const v = (n: number) => (n / Y).toFixed(2)
    return `${h(r)}px ${h(r)}px ${h(rb)}px ${h(rb)}px / ${v(r)}px ${v(r)}px ${v(rb)}px ${v(rb)}px`
  })
  const fade = (key: 'co' | 'sp' | 'po') => {
    const s = seg.current
    return lerp(s.a[key], s.b[key], span(q.get(), s[key]))
  }
  const panelOpacity = useTransform(() => fade('po'))
  const contentOpacity = useTransform(() => fade('co'))
  const splashOpacity = useTransform(() => fade('sp'))
  const splashX = useTransform(() => 1 / Math.max(0.02, scaleX.get()))
  const splashY = useTransform(() => 1 / Math.max(0.02, scaleY.get()))

  /** The panel's current look, as a pose (drag folded in). */
  const currentPose = (): Pose => {
    const s = seg.current
    const t = q.get()
    const k = dragK.get()
    return {
      x: x.get(),
      y: y.get(),
      sx: scaleX.get(),
      sy: scaleY.get(),
      r: lerp(s.a.r, s.b.r, t) + k * DRAG_RADIUS,
      rb: lerp(s.a.rb, s.b.rb, t) + k * DRAG_RADIUS,
      po: panelOpacity.get(),
      co: contentOpacity.get(),
      sp: splashOpacity.get(),
    }
  }

  const runSegment = (next: Segment, transition: ValueAnimationTransition<number>) => {
    seg.current = next
    // jump() (not set()) so the spring doesn't inherit the velocity of these resets
    dragY.jump(0)
    dragK.jump(0)
    bump.jump(1)
    q.jump(0)
    return animate(q, 1, transition)
  }

  // Active header drag (see handlers below)
  const drag = useRef<{
    id: number
    startY: number
    active: boolean
    samples: { y: number; t: number }[]
    under: HTMLElement | null
    h: number
  } | null>(null)

  // ── open ───────────────────────────────────────────────────────────────
  // While the sheet zooms out of its icon, its content ignores taps: a quick
  // second tap on the icon (a desktop-style double-tap) lands on the growing
  // panel, which absorbs it instead of handing it to whatever app UI is
  // passing under the finger (or the home icon beneath). `data-opening` (set
  // straight on the DOM: no app re-render) turns the content's pointer-events
  // off, so a guarded tap can't even focus a field. Taps are also judged by
  // their own event time, which catches one made in time but dispatched late,
  // after a busy main thread had already lifted the attribute.
  const guardUntil = useRef(0)
  useLayoutEffect(() => {
    const layer = layerRef.current
    if (!animateIn || !layer) return
    guardUntil.current = performance.now() + OPEN_GUARD_MS
    layer.setAttribute('data-opening', '')
    const t = window.setTimeout(() => layer.removeAttribute('data-opening'), OPEN_GUARD_MS)
    return () => {
      window.clearTimeout(t)
      layer.removeAttribute('data-opening')
    }
    // Mount-only, like the opening animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const ctrl = animate(q, 1, reduced ? FADE : SPRING_OPEN)
    return () => ctrl.stop()
    // Mount-only: the opening animation plays once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const swallowEarlyTap = (e: SyntheticEvent) => {
    if (e.timeStamp > 0 && e.timeStamp < guardUntil.current) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  // ── close (AnimatePresence keeps us mounted until safeToRemove) ─────────
  useEffect(() => {
    if (isPresent) return
    if (drag.current) {
      // Closed mid-drag (e.g. browser back): release the layer underneath.
      setLift(drag.current.under, null)
      drag.current = null
    }
    const cur = currentPose()
    let next: Segment
    if (reduced) {
      next = { a: cur, b: { ...cur, po: 0 }, co: [0, 1], sp: [0, 1], po: [0, 1] }
    } else {
      const layer = layerRef.current
      const lr = layer?.getBoundingClientRect()
      const frame = lr ? { x: lr.left, y: lr.top, width: lr.width, height: lr.height } : sheetFrame(isCard)
      // Only the bottom sheet can see the home screen; stacked cards slide away.
      const anchor = index === 0 ? getAnchor(win.appId) : null
      if (isOnScreen(anchor)) {
        // Shrink back into the home icon: content fades out, the icon fades in.
        const target = poseAt(anchor, frame)
        next = {
          a: cur,
          b: { ...target, co: 0, sp: isIconish(anchor) ? 1 : 0, po: 0 },
          co: [0, 0.42],
          sp: [0.28, 0.7],
          po: [0.84, 1],
        }
      } else {
        // No icon to go home to: slide off the bottom.
        next = { a: cur, b: { ...cur, y: frame.height + 40 }, co: [0, 1], sp: [0, 1], po: [0, 1] }
      }
    }
    const ctrl = runSegment(next, reduced ? { duration: 0.16, ease: 'easeIn' } : SPRING_CLOSE)
    let done = false
    const finish = () => {
      if (done) return
      done = true
      safeToRemove?.()
    }
    ctrl.then(finish, finish)
    // Springs settle slowly at the very end; don't wait for the last sub-pixel.
    const fallback = window.setTimeout(finish, reduced ? 400 : 1100)
    return () => {
      window.clearTimeout(fallback)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent])

  // ── card ↔ full-screen when the stack re-orders: glide from the old frame ──
  const wasCard = useRef(isCard)
  useEffect(() => {
    if (wasCard.current === isCard || !present) return
    wasCard.current = isCard
    const cardTop = sheetFrame(true).y - sheetFrame(false).y
    const rest = restPose(isCard ? CARD_RADIUS : 0, 0)
    const from = { ...currentPose(), y: isCard ? -cardTop : cardTop, r: isCard ? 0 : CARD_RADIUS, rb: 0 }
    const ctrl = runSegment({ a: from, b: rest, co: [0, 1], sp: [0, 1], po: [0, 1] }, reduced ? FADE : SPRING_OPEN)
    return () => ctrl.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCard])

  // ── re-opened while open: rise back to the front, or a "hello again" squish ──
  const firstPokes = useRef(win.pokes)
  const wasTop = useRef(isTop)
  useEffect(() => {
    if (win.pokes === firstPokes.current || !present) return
    firstPokes.current = win.pokes
    if (!wasTop.current) {
      // Brought back from under another sheet: slide up to the front like a fresh open.
      const frame = sheetFrame(isCard)
      const rest = restPose(isCard ? CARD_RADIUS : 0, 0)
      const next: Segment = reduced
        ? { a: { ...rest, po: 0 }, b: rest, co: [0, 1], sp: [0, 1], po: [0, 1] }
        : { a: { ...rest, y: frame.height * 0.7 }, b: rest, co: [0, 0.001], sp: [0, 1], po: [0, 0.001] }
      const ctrl = runSegment(next, reduced ? FADE : SPRING_OPEN)
      return () => ctrl.stop()
    }
    if (reduced) return
    bump.jump(0.95)
    const ctrl = animate(bump, 1, { type: 'spring', stiffness: 520, damping: 14 })
    return () => ctrl.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.pokes])
  useEffect(() => {
    wasTop.current = isTop
  }, [isTop])

  // ── register layer + heading with the stack ────────────────────────────
  useEffect(() => {
    registerLayer(win.id, layerRef.current)
    registerHeading(win.id, headingRef.current)
    return () => {
      registerLayer(win.id, null)
      registerHeading(win.id, null)
    }
  }, [win.id, registerLayer, registerHeading])


  // ── drag the header down to dismiss ────────────────────────────────────
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (!interactive || (e.pointerType === 'mouse' && e.button !== 0)) return
    if ((e.target as Element).closest('button, a, input, textarea, select')) return
    drag.current = {
      id: e.pointerId,
      startY: e.clientY,
      active: false,
      samples: [{ y: e.clientY, t: e.timeStamp }],
      under: getUnder(),
      h: layerRef.current?.getBoundingClientRect().height ?? window.innerHeight,
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* pointer already gone; moves still arrive while it's over the header */
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dy = e.clientY - d.startY
    if (!d.active) {
      if (Math.abs(dy) < 5) return
      d.active = true
      layerRef.current?.setAttribute('data-dragging', 'true')
    }
    const offset = dy >= 0 ? dy : -rubber(-dy, 28)
    dragY.set(offset)
    dragK.set(clamp01(offset / (d.h * 0.6)))
    setLift(d.under, clamp01(offset / (d.h * 0.55)))
    d.samples.push({ y: e.clientY, t: e.timeStamp })
    if (d.samples.length > 5) d.samples.shift()
  }

  const endDrag = (e: PointerEvent<HTMLElement>, cancelled: boolean) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (!d.active) return
    layerRef.current?.removeAttribute('data-dragging')
    const first = d.samples[0]
    const last = d.samples[d.samples.length - 1]
    const dt = Math.max(1, last.t - first.t)
    const velocity = ((last.y - first.y) / dt) * 1000 // px/s
    const offset = dragY.get()
    const dismiss = !cancelled && (offset > d.h * 0.22 || (velocity > 650 && offset > 30))
    setLift(d.under, null)
    if (dismiss) {
      onClose(win.id)
    } else {
      animate(dragY, 0, { type: 'spring', stiffness: 420, damping: 34, velocity })
      animate(dragK, 0, { type: 'spring', stiffness: 420, damping: 34 })
    }
  }

  const pushed = !isTop && present
  const backLabel = index > 0 ? 'back' : 'home'

  return (
    <div
      ref={layerRef}
      className="msheet"
      style={{ zIndex: 100 + win.z }}
      data-card={isCard ? 'true' : undefined}
      data-pushed={pushed ? 'true' : undefined}
      data-leaving={present ? undefined : 'true'}
      inert={!interactive}
      aria-hidden={!interactive || undefined}
    >
      <motion.section
        className="msheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={`${titleId}-desc`}
        style={{ x, y, scaleX, scaleY, borderRadius: radius, opacity: panelOpacity }}
      >
        <motion.div
          className="msheet__content"
          style={{ opacity: contentOpacity }}
          onPointerDownCapture={swallowEarlyTap}
          onClickCapture={swallowEarlyTap}
        >
          <header
            className="msheet__header"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => endDrag(e, false)}
            onPointerCancel={(e) => endDrag(e, true)}
          >
            <span className="msheet__grabber" aria-hidden="true" />
            <div className="msheet__bar">
              <button
                type="button"
                className="msheet__back"
                onClick={() => onClose(win.id)}
                aria-label={index > 0 ? `Back to ${underTitle ?? 'previous'}` : 'Back to home'}
              >
                <svg viewBox="0 0 12 20" aria-hidden="true">
                  <path d="M10 2 2 10l8 8" />
                </svg>
                <span>{backLabel}</span>
              </button>
              <h2 ref={headingRef} id={titleId} className="msheet__title" tabIndex={-1}>
                <span className="msheet__titleicon" aria-hidden="true">
                  <AppIcon appId={win.appId} size={22} />
                </span>
                <span className="msheet__titletext">{win.title}</span>
              </h2>
              <span className="msheet__spacer" aria-hidden="true" />
            </div>
          </header>
          <div className="msheet__body">
            <AppHost appId={win.appId} windowId={win.id} params={win.params} isMobile={true} />
          </div>
        </motion.div>

        <motion.span className="msheet__splash" aria-hidden="true" style={{ opacity: splashOpacity }}>
          <motion.span className="msheet__splashicon" style={{ scaleX: splashX, scaleY: splashY }}>
            <AppIcon appId={win.appId} size={60} />
          </motion.span>
        </motion.span>
        <span className="msheet__dim" aria-hidden="true" />
        <span id={`${titleId}-desc`} className="sr-only">
          {app.description}
        </span>
      </motion.section>
    </div>
  )
}
