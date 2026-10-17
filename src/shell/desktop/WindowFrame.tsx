import { animate, motion, useMotionValue, usePresence } from 'motion/react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AppIcon } from '../../components/AppIcon'
import { AppHost } from '../../os/AppHost'
import { getAnchor, rectOf } from '../../os/anchors'
import { getApp } from '../../os/apps'
import { clampRect, DOCK_H, useWindows } from '../../os/store'
import type { Rect, WindowState } from '../../os/types'
import { useReducedMotion } from '../../os/useMedia'
import { CloseGlyph, MaxGlyph, MinGlyph } from './Glyphs'
import { clamp, isInteractiveTarget, maximizedRect, MENUBAR_H, useViewport } from './hooks'
import { getDockTile } from './shellStore'
import './window.css'

/*
 * One desktop window. Geometry lives in the window store; while dragging or
 * resizing we only touch motion values / inline styles and commit on pointerup.
 *
 * Transform model: the frame sits at left/top 0 with transform-origin 0 0 and
 * is placed with x/y. scaleX/scaleY are 1 at rest and are used for the
 * open-from-icon, minimize-into-dock and maximize (FLIP) animations.
 */

const SPRING = { type: 'spring', stiffness: 380, damping: 30 } as const
const OPEN_SPRING = { type: 'spring', stiffness: 300, damping: 27, mass: 0.9 } as const
type Bezier = [number, number, number, number]
const EASE_SUCK: Bezier = [0.55, 0, 0.85, 0.35]
const EASE_IN: Bezier = [0.4, 0, 1, 1]

type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const EDGES: Edge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

function minimizeTarget(w: WindowState): Rect {
  const tile = getDockTile(w.id)
  const r = (tile && rectOf(tile)) || getAnchor(w.appId)
  if (r) return r
  return { x: window.innerWidth / 2 - 26, y: window.innerHeight - 62, width: 52, height: 52 }
}

const windowEl = (id: string) => document.querySelector<HTMLElement>(`[data-window-id="${CSS.escape(id)}"]`)

export function WindowFrame({ w, focused }: { w: WindowState; focused: boolean }) {
  const app = getApp(w.appId)
  const chromeless = !!app.chromeless
  const reduced = useReducedMotion()
  useViewport() // re-render on viewport resize so maximized windows follow it
  const target: Rect = w.maximized ? maximizedRect() : { x: w.x, y: w.y, width: w.width, height: w.height }

  const x = useMotionValue(target.x)
  const y = useMotionValue(target.y)
  const sx = useMotionValue(1)
  const sy = useMotionValue(1)
  const opacity = useMotionValue(1)
  const rotate = useMotionValue(0)

  const titleId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [isPresent, safeToRemove] = usePresence()
  const [hidden, setHidden] = useState(w.minimized)
  const interacting = useRef(false)
  const lastRect = useRef<Rect | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const minimizedRef = useRef(w.minimized)
  const pokesRef = useRef(w.pokes)
  const endInteraction = useRef<(() => void) | null>(null)
  const exiting = useRef(false)
  const focusOnReveal = useRef(false)

  const springTo = (r: Rect, t: typeof SPRING | typeof OPEN_SPRING = SPRING) => {
    animate(x, r.x, t)
    animate(y, r.y, t)
    animate(sx, 1, t)
    animate(sy, 1, t)
  }

  /* open: grow out of the icon that launched us (or a soft scale-in) */
  const playOpen = (t: Rect, origin?: Rect) => {
    if (reduced) {
      x.set(t.x)
      y.set(t.y)
      sx.set(1)
      sy.set(1)
      opacity.set(0)
      animate(opacity, 1, { duration: 0.16 })
    } else if (origin) {
      const k = clamp(Math.max(origin.width / t.width, origin.height / t.height), 0.05, 0.6)
      x.set(origin.x + origin.width / 2 - (t.width * k) / 2)
      y.set(origin.y + origin.height / 2 - (t.height * k) / 2)
      sx.set(k)
      sy.set(k)
      opacity.set(0)
      springTo(t, OPEN_SPRING)
      animate(opacity, 1, { duration: 0.2, ease: 'easeOut' })
    } else {
      x.set(t.x + t.width * 0.03)
      y.set(t.y + t.height * 0.03 + 10)
      sx.set(0.94)
      sy.set(0.94)
      opacity.set(0)
      springTo(t)
      animate(opacity, 1, { duration: 0.22, ease: 'easeOut' })
    }
    rootRef.current?.focus({ preventScroll: true })
  }

  const captureOpener = () => {
    const a = document.activeElement
    // never ourselves (StrictMode re-runs the mount effect after playOpen focused the root)
    opener.current = a instanceof HTMLElement && a !== document.body && !rootRef.current?.contains(a) ? a : null
  }

  useLayoutEffect(() => {
    if (!opener.current) captureOpener()
    lastRect.current = target
    if (w.minimized) opacity.set(0)
    else playOpen(target, w.origin)
    return () => endInteraction.current?.()
    // mount only: the open animation runs once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* follow store geometry (maximize, clamps, viewport changes) */
  useLayoutEffect(() => {
    const prev = lastRect.current
    lastRect.current = target
    if (!prev || interacting.current || minimizedRef.current) return
    if (prev.x === target.x && prev.y === target.y && prev.width === target.width && prev.height === target.height) return
    if (reduced) {
      x.set(target.x)
      y.set(target.y)
      sx.set(1)
      sy.set(1)
      return
    }
    if (prev.width !== target.width || prev.height !== target.height) {
      // FLIP: keep the old visual size this frame, then spring into the new one.
      sx.set((prev.width * sx.get()) / target.width)
      sy.set((prev.height * sy.get()) / target.height)
    }
    springTo(target)
    // geometry is the trigger; motion values and helpers are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.x, target.y, target.width, target.height])

  /* minimize into the dock icon / restore back out */
  useEffect(() => {
    if (minimizedRef.current === w.minimized) return
    minimizedRef.current = w.minimized
    if (exiting.current) return // a revived window replays its open animation instead
    const r = lastRect.current ?? target

    if (w.minimized) {
      const root = rootRef.current
      if (root?.contains(document.activeElement)) {
        const next = useWindows.getState().focusedId
        const dockBtn = document.querySelector<HTMLElement>(
          `[data-dock-window="${CSS.escape(w.id)}"], [data-dock-app="${w.appId}"]`,
        )
        ;((next && windowEl(next)) || dockBtn)?.focus({ preventScroll: true })
      }
      const done = () => {
        if (minimizedRef.current) setHidden(true)
      }
      if (reduced) {
        animate(opacity, 0, { duration: 0.14 }).then(done)
        return
      }
      const a = minimizeTarget(w)
      const k = clamp(Math.max(a.width / r.width, a.height / r.height), 0.04, 1)
      const d = 0.46
      animate(x, a.x + a.width / 2 - (r.width * k) / 2, { duration: d, ease: [0.45, 0, 0.55, 1] })
      animate(y, a.y + a.height / 2 - (r.height * k) / 2, { duration: d, ease: EASE_SUCK })
      animate(sx, k, { duration: d, ease: [0.42, 0, 0.62, 1] })
      animate(sy, k, { duration: d, ease: [0.45, 0, 0.7, 0.85] })
      animate(opacity, 0, { duration: d, ease: [0.8, 0, 1, 0.6] }).then(done)
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reveal before animating back out
      setHidden(false)
      if (reduced) {
        x.set(r.x)
        y.set(r.y)
        sx.set(1)
        sy.set(1)
        animate(opacity, 1, { duration: 0.16 })
      } else {
        springTo(r, OPEN_SPRING)
        animate(opacity, 1, { duration: 0.22, ease: 'easeOut' })
      }
      // Still inert while hidden: focus once the reveal has committed (below).
      // Restored mid-minimize (never hidden), it can take focus right away.
      if (!hidden) rootRef.current?.focus({ preventScroll: true })
      else focusOnReveal.current = true
    }
    // runs on minimize / restore transitions only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.minimized])

  useLayoutEffect(() => {
    if (hidden || !focusOnReveal.current) return
    focusOnReveal.current = false
    rootRef.current?.focus({ preventScroll: true })
  }, [hidden])

  /* "hello again": wiggle when re-opened while already open */
  useEffect(() => {
    if (pokesRef.current === w.pokes) return
    pokesRef.current = w.pokes
    if (exiting.current) return
    if (!reduced) animate(rotate, [0, -1.6, 1.4, -0.9, 0.45, 0], { duration: 0.6, ease: 'easeInOut' })
    requestAnimationFrame(() => {
      const root = rootRef.current
      if (root && !root.contains(document.activeElement)) {
        // re-opened from somewhere else (another stamp on the desktop, say): that's where focus goes back to on close
        captureOpener()
        root.focus({ preventScroll: true })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.pokes])

  /* close: fade + shrink, hand focus back to whoever opened us */
  useEffect(() => {
    if (isPresent) {
      if (!exiting.current) return
      // Re-opened while the close animation was still running (e.g. Restart
      // closes everything and reopens "welcome"): AnimatePresence revives this
      // instance, so play the open animation again.
      exiting.current = false
      captureOpener()
      lastRect.current = target
      // eslint-disable-next-line react-hooks/set-state-in-effect -- revived windows must be visible again
      setHidden(w.minimized)
      if (w.minimized) opacity.set(0)
      else playOpen(target, w.origin)
      return
    }
    exiting.current = true
    endInteraction.current?.()
    const root = rootRef.current
    const active = document.activeElement
    if (!active || active === document.body || root?.contains(active)) {
      const o = opener.current
      if (o?.isConnected && !o.closest('[inert]')) o.focus({ preventScroll: true })
      else {
        const next = useWindows.getState().focusedId
        // No window left to go to (e.g. the Hello card opened at boot): land on the
        // desktop's tab stop rather than dropping focus to <body>.
        const fallback = next
          ? windowEl(next)
          : (document.querySelector<HTMLElement>('.desk__icons .dicon__btn[tabindex="0"]') ??
            document.querySelector<HTMLElement>('[data-dock-app="projects"]'))
        fallback?.focus({ preventScroll: true })
      }
    }
    let removed = false
    let revived = false
    const remove = () => {
      if (removed || revived) return
      removed = true
      safeToRemove?.()
    }
    const timer = window.setTimeout(remove, 450)
    if (reduced || hidden) {
      animate(opacity, 0, { duration: 0.12 }).then(remove)
    } else {
      const r = lastRect.current ?? target
      const t = { duration: 0.2, ease: EASE_IN }
      const k = 0.92
      animate(x, x.get() + (r.width * sx.get() * (1 - k)) / 2, t)
      animate(y, y.get() + (r.height * sy.get() * (1 - k)) / 2, t)
      animate(sx, sx.get() * k, t)
      animate(sy, sy.get() * k, t)
      animate(opacity, 0, { duration: 0.18, ease: 'easeIn' }).then(remove)
    }
    return () => {
      revived = true
      window.clearTimeout(timer)
    }
    // runs when the window starts leaving (or comes back)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent])

  /* ── drag ────────────────────────────────────────────────────────── */
  const startDrag = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !e.isPrimary || isInteractiveTarget(e.target)) return
    const px = e.clientX
    const py = e.clientY
    let base = { x: x.get(), y: y.get() }
    let moved = false
    const wasMax = w.maximized
    const restoreSize = { width: w.width, height: w.height }

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - px
      const dy = ev.clientY - py
      if (!moved) {
        if (Math.hypot(dx, dy) < 3) return
        moved = true
        interacting.current = true
        document.documentElement.classList.add('is-window-dragging')
        if (wasMax) {
          // Pull a maximized window off the edge, keeping the grab point under the cursor.
          const m = lastRect.current ?? maximizedRect()
          const fx = (px - m.x) / m.width
          base = { x: px - fx * restoreSize.width, y: m.y }
          lastRect.current = { ...base, ...restoreSize }
          sx.set(1)
          sy.set(1)
          useWindows.getState().move(w.id, base.x, base.y)
        }
      }
      const r = lastRect.current ?? target
      const c = clampRect({ x: base.x + dx, y: base.y + dy, width: r.width, height: r.height })
      x.set(c.x)
      y.set(Math.max(MENUBAR_H, c.y))
    }
    const finish = (commit: boolean) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.documentElement.classList.remove('is-window-dragging')
      endInteraction.current = null
      if (!moved) return
      interacting.current = false
      if (!commit) return
      const r = { ...(lastRect.current ?? target), x: x.get(), y: y.get() }
      lastRect.current = r
      useWindows.getState().move(w.id, r.x, r.y)
    }
    const onUp = () => finish(true)
    endInteraction.current = () => finish(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  /* ── resize ──────────────────────────────────────────────────────── */
  const startResize = (edge: Edge) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !e.isPrimary) return
    e.preventDefault()
    e.stopPropagation()
    useWindows.getState().focus(w.id)
    const root = rootRef.current
    const start = { ...(lastRect.current ?? target) }
    const px = e.clientX
    const py = e.clientY
    const { minSize } = app
    let cur = start
    interacting.current = true
    sx.set(1)
    sy.set(1)
    x.set(start.x)
    y.set(start.y)
    document.documentElement.classList.add('is-window-resizing')
    document.documentElement.dataset.resizeEdge = edge

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - px
      const dy = ev.clientY - py
      const maxW = window.innerWidth - 16
      const maxH = window.innerHeight - MENUBAR_H - 8
      let { x: nx, y: ny, width: nw, height: nh } = start
      // Edges stop at the screen edge / the dock, so the controls stay reachable.
      // (Math.max(start.*) keeps an already-oversized window from jumping.)
      if (edge.includes('e')) nw = clamp(start.width + dx, minSize.width, Math.min(maxW, Math.max(start.width, window.innerWidth - start.x)))
      if (edge.includes('s')) nh = clamp(start.height + dy, minSize.height, Math.min(maxH, Math.max(start.height, window.innerHeight - DOCK_H - start.y)))
      if (edge.includes('w')) {
        nw = clamp(start.width - dx, minSize.width, Math.min(maxW, Math.max(start.width, start.x + start.width)))
        nx = start.x + start.width - nw
      }
      if (edge.includes('n')) {
        nh = clamp(start.height - dy, minSize.height, maxH)
        ny = start.y + start.height - nh
        if (ny < MENUBAR_H) {
          nh -= MENUBAR_H - ny
          ny = MENUBAR_H
        }
      }
      cur = { x: nx, y: ny, width: nw, height: nh }
      if (root) {
        root.style.width = `${nw}px`
        root.style.height = `${nh}px`
      }
      x.set(nx)
      y.set(ny)
    }
    const finish = (commit: boolean) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.documentElement.classList.remove('is-window-resizing')
      delete document.documentElement.dataset.resizeEdge
      endInteraction.current = null
      interacting.current = false
      if (!commit || cur === start) return
      lastRect.current = cur
      useWindows.getState().resize(w.id, cur)
    }
    const onUp = () => finish(true)
    endInteraction.current = () => finish(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const { close, minimize, toggleMaximize } = useWindows.getState()

  return (
    <motion.div
      ref={rootRef}
      className={`win${focused ? ' is-focused' : ''}${chromeless ? ' win--chromeless' : ''}${w.maximized ? ' is-max' : ''}`}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-window-id={w.id}
      data-app={w.appId}
      inert={hidden}
      style={{
        x,
        y,
        scaleX: sx,
        scaleY: sy,
        opacity,
        width: target.width,
        height: target.height,
        zIndex: 100 + w.z,
        transformOrigin: '0 0',
        visibility: hidden ? 'hidden' : undefined,
        // a closing window stops catching clicks right away
        pointerEvents: isPresent ? undefined : 'none',
      }}
      onPointerDownCapture={() => useWindows.getState().focus(w.id)}
      // Keyboard focus landing inside a window brings it to the front too (Tab
      // must never reach controls hidden under another window).
      onFocus={() => {
        const s = useWindows.getState()
        if (s.focusedId === w.id) return
        if (s.windows.find((v) => v.id === w.id)?.minimized) return
        s.focus(w.id)
      }}
      onPointerDown={
        chromeless
          ? (e) => {
              if ((e.target as Element).closest('[data-window-drag]')) startDrag(e)
            }
          : undefined
      }
    >
      <motion.div className={`win__frame${chromeless ? '' : ' glass'}`} style={{ rotate }}>
        {chromeless ? (
          <>
            <h2 id={titleId} className="sr-only">
              {w.title}
            </h2>
            <button type="button" className="win__float-close" aria-label={`Close ${w.title}`} onClick={() => close(w.id)}>
              <CloseGlyph size={10} />
            </button>
          </>
        ) : (
          <div
            className="win__titlebar"
            onPointerDown={startDrag}
            onDoubleClick={(e) => {
              if (!isInteractiveTarget(e.target)) toggleMaximize(w.id)
            }}
          >
            <div className="win__controls">
              <button type="button" className="win__ctl win__ctl--close" aria-label={`Close ${w.title}`} onClick={() => close(w.id)}>
                <CloseGlyph />
              </button>
              <button type="button" className="win__ctl win__ctl--min" aria-label={`Minimize ${w.title}`} onClick={() => minimize(w.id)}>
                <MinGlyph />
              </button>
              <button
                type="button"
                className="win__ctl win__ctl--max"
                aria-label={w.maximized ? `Restore ${w.title}` : `Maximize ${w.title}`}
                onClick={() => toggleMaximize(w.id)}
              >
                <MaxGlyph restore={w.maximized} />
              </button>
            </div>
            <div className="win__title">
              <span className="win__title-icon" aria-hidden="true">
                <AppIcon appId={w.appId} size={18} />
              </span>
              <h2 id={titleId} className="win__title-text">
                {w.title}
              </h2>
            </div>
            <span aria-hidden="true" />
          </div>
        )}
        <div className="win__body">
          <AppHost appId={w.appId} windowId={w.id} params={w.params} isMobile={false} />
        </div>
      </motion.div>

      {!chromeless &&
        EDGES.map((edge) => (
          <div
            key={edge}
            className={`win__rz win__rz--${edge}`}
            aria-hidden="true"
            onPointerDown={startResize(edge)}
          />
        ))}
    </motion.div>
  )
}
