import { useEffect, useState, useSyncExternalStore } from 'react'
import { MENUBAR_H, workArea } from '../../os/store'
import type { Rect } from '../../os/types'

/* ── viewport size (re-renders on resize, stable snapshot) ─────────── */

type Viewport = { w: number; h: number }
let viewport: Viewport = { w: 1280, h: 800 }

function readViewport(): Viewport {
  if (typeof window === 'undefined') return viewport
  if (viewport.w !== window.innerWidth || viewport.h !== window.innerHeight) {
    viewport = { w: window.innerWidth, h: window.innerHeight }
  }
  return viewport
}

function subscribeViewport(cb: () => void) {
  window.addEventListener('resize', cb)
  return () => window.removeEventListener('resize', cb)
}

export function useViewport(): Viewport {
  return useSyncExternalStore(subscribeViewport, readViewport, readViewport)
}

/* ── a Date that ticks over on every new minute ────────────────────── */

export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer = 0
    const schedule = () => {
      const d = new Date()
      const ms = 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 30
      timer = window.setTimeout(() => {
        setNow(new Date())
        schedule()
      }, ms)
    }
    schedule()
    // Tabs in the background throttle timers, so resync when we come back.
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(new Date())
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return now
}

/* ── geometry helpers ──────────────────────────────────────────────── */

/** Where a maximized window sits: the work area with an 8px breathing margin. */
export function maximizedRect(): Rect {
  const a = workArea()
  return { x: a.x + 8, y: a.y + 8, width: a.width - 16, height: a.height - 16 }
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** True when the event target is something that should keep its own pointer behaviour. */
export function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    !!target.closest('button, a, input, textarea, select, label, [role="button"], [contenteditable=""], [contenteditable="true"]')
  )
}

export { MENUBAR_H }
