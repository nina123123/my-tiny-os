import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSettings } from '../../os/settings'
import { useWindows } from '../../os/store'
import type { Rect } from '../../os/types'
import { planDecor, STACK, type Column, type Slot } from './deskDecor'
import { maximizedRect } from './hooks'
import { Quiet } from './Quiet'

/*
 * The wallpaper widgets on the desktop (today: the photo stack of project
 * polaroids). deskDecor.ts works out which corner each goes in (or that it's
 * left out); this lays out their slots, in reading order for the keyboard (the
 * top row, then the bottom one, left to right), and loads each one lazily after
 * boot. They are painted under the icons and every window. A widget first shows
 * once no window touches its spot (so the welcome card doesn't open over a
 * half-hidden one), and it holds its motion while a window covers it or the
 * tab is hidden.
 */

const PhotoStack = lazy(() => import('./PhotoStack'))
const warm = () => import('./PhotoStack')

/** Slots that have shown this visit: a resize that drops and brings one back doesn't wait again */
const revealed = new Set<string>()

/** True while an open window lies over a good part of `rect` */
function useCovered(rect: Rect) {
  return useWindows((s) => {
    const area = rect.width * rect.height
    return s.windows.some((w) => {
      if (w.minimized) return false
      const r = w.maximized ? maximizedRect() : w
      const ix = Math.min(r.x + r.width, rect.x + rect.width) - Math.max(r.x, rect.x)
      const iy = Math.min(r.y + r.height, rect.y + rect.height) - Math.max(r.y, rect.y)
      return ix > 0 && iy > 0 && ix * iy > area * 0.35
    })
  })
}

/** True while any open window overlaps `rect` at all */
function useTouched(rect: Rect) {
  return useWindows((s) =>
    s.windows.some((w) => {
      if (w.minimized) return false
      const r = w.maximized ? maximizedRect() : w
      return r.x < rect.x + rect.width && r.x + r.width > rect.x && r.y < rect.y + rect.height && r.y + r.height > rect.y
    }),
  )
}

function usePageVisible() {
  const [visible, setVisible] = useState(() => !document.hidden)
  useEffect(() => {
    const on = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return visible
}

/**
 * The widgets column's left edge and the "now" card's bottom (layout values, so its float doesn't
 * count), or null while it's hidden, with the window width it was measured at. The column is pinned to
 * the right edge, so for a new width its left edge moves by just as much: DecorLayer shifts it right
 * away, instead of planning one frame with the old one before the observer reports.
 */
function useColumn() {
  const [col, setCol] = useState<(Column & { vw: number }) | null>(null)
  useEffect(() => {
    const aside = document.querySelector<HTMLElement>('.dwidgets')
    const card = aside?.querySelector<HTMLElement>('.dwidget')
    if (!aside || !card) return
    // display: none under 1100px (no offsetParent then). It sits at `right: 30px`, so a new window width
    // moves it without resizing it: watch the desktop too, not just the column
    const measure = () =>
      setCol(
        aside.offsetParent
          ? {
              left: aside.offsetLeft + Math.min(0, card.offsetLeft),
              bottom: aside.offsetTop + card.offsetTop + card.offsetHeight,
              vw: window.innerWidth,
            }
          : null,
      )
    const ro = new ResizeObserver(measure)
    ro.observe(aside)
    if (aside.parentElement) ro.observe(aside.parentElement)
    return () => ro.disconnect()
  }, [])
  return col
}

/** One widget's slot: its full-size box, scaled about the anchor corner */
function DecorSlot({ slot, w, h, className, hidden, children }: { slot: Slot; w: number; h: number; className: string; hidden: boolean; children: (paused: boolean) => ReactNode }) {
  const covered = useCovered(slot.seen)
  const touched = useTouched(slot.seen)
  // shown before this visit: back after a resize, it doesn't play its entrance again
  const [again] = useState(() => revealed.has(className))
  const [shown, setShown] = useState(again)
  if (!shown && !touched) setShown(true)
  useEffect(() => {
    if (shown) revealed.add(className)
  }, [shown, className])

  if (!shown) return null
  return (
    <div
      className={`decor-slot ${className}`}
      data-again={again || undefined}
      style={{
        left: slot.x,
        top: slot.y,
        width: w,
        height: h,
        transformOrigin: slot.origin,
        transform: slot.scale !== 1 ? `scale(${slot.scale.toFixed(3)})` : undefined,
      }}
    >
      <Quiet>
        <Suspense fallback={null}>{children(covered || hidden)}</Suspense>
      </Quiet>
    </div>
  )
}

type Props = {
  vw: number
  vh: number
  /** right edge (px) of the icon columns on the left */
  iconsLeft: number
  /** left edge (px) of icons dragged to the right half, or the viewport width */
  iconsRight: number
}

export function DecorLayer({ vw, vh, iconsLeft, iconsRight }: Props) {
  const booted = useSettings((s) => s.booted)
  const col = useColumn()
  const hidden = !usePageVisible()
  const decor = useMemo(() => {
    // (under 1100px the column is display: none; a measurement from a wider window doesn't count then)
    const now = col && vw >= 1100 ? { left: col.left + vw - col.vw, bottom: col.bottom } : null
    return planDecor({ vw, vh, iconsLeft, iconsRight, col: now })
  }, [vw, vh, iconsLeft, iconsRight, col])

  // fetch their code while the boot screen plays, so each is ready the moment its spot is clear
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 600))
    const cancel = window.cancelIdleCallback ?? window.clearTimeout
    const handle = idle(() => void warm().catch(() => {}))
    return () => cancel(handle)
  }, [])

  if (!booted) return null
  const slots: { key: string; slot: Slot; w: number; h: number; render: (paused: boolean) => ReactNode }[] = []
  if (decor.stack) slots.push({ key: 'pstack-slot', slot: decor.stack, ...STACK, render: (paused) => <PhotoStack paused={paused} /> })
  // reading order for the keyboard: the top row, then the bottom one, left to right
  const row = (s: Slot) => (s.seen.y + s.seen.height / 2 < vh / 2 ? 0 : 1)
  slots.sort((a, b) => row(a.slot) - row(b.slot) || a.slot.seen.x - b.slot.seen.x)
  return (
    <>
      {slots.map(({ key, slot, w, h, render }) => (
        <DecorSlot key={key} slot={slot} w={w} h={h} className={key} hidden={hidden}>
          {render}
        </DecorSlot>
      ))}
    </>
  )
}
