import { DOCK_H, MENUBAR_H } from '../../os/store'
import type { Rect } from '../../os/types'
import { clamp } from './hooks'

/*
 * Where the wallpaper widgets go (today: the photo stack of project polaroids).
 * Each takes the first corner of the free desktop where it fits, at the biggest
 * scale that fits there, sliding away from the corner's edge to find room. Every
 * box stays clear of the icons, the widgets column ("now" card), the dock, the
 * menu bar and the boxes placed before it. Whatever doesn't fit is left out, so
 * a small screen simply has fewer of them (and under 1100px, none).
 */

/**
 * A widget's full-size box at x, y, scaled about its anchor corner (`origin`, a CSS transform-origin);
 * seen: where it really shows
 */
export type Slot = { x: number; y: number; scale: number; origin: string; seen: Rect }
export type Decor = {
  stack: Slot | null
}
/** The widgets column ("now" card): its left edge and the card's bottom */
export type Column = { left: number; bottom: number }

export type DeskFrame = {
  vw: number
  vh: number
  /** right edge (px) of the icon columns on the left */
  iconsLeft: number
  /** left edge (px) of icons dragged to the right half, or the viewport width */
  iconsRight: number
  /** null while the widgets column is hidden (under 1100px): then there's no decor at all */
  col: Column | null
}

/** Full-size boxes (keep in sync with each widget's CSS) */
export const STACK = { w: 214, h: 240 }

const GAP = 22
/** Air over the dock, and under the menu bar */
const DOCK_AIR = 10
const TOP_AIR = 18
/** Below this a widget gets too small to read: try elsewhere, or leave it out */
const MIN_SCALE = 0.8
/** …and on a tall screen they may grow, up to 1.3 (never below 1 on that account) */
const maxScale = (vh: number) => clamp(vh / 790, 1, 1.3)
const STEP = 8
const STEP_S = 0.05

/** The corners of the free desktop. Each slides away from its edge (8px steps) to find room */
type Corner = 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left'
/** The anchor each corner scales a widget about (CSS transform-origin) */
const ORIGIN: Record<Corner, string> = {
  'bottom-right': '100% 100%',
  'top-right': '100% 0',
  'bottom-left': '0 100%',
  'top-left': '0 0',
}

const touches = (a: Rect, b: Rect, pad: number) =>
  a.x < b.x + b.width + pad && a.x + a.width + pad > b.x && a.y < b.y + b.height + pad && a.y + a.height + pad > b.y

/** The biggest scale from `start` down to MIN_SCALE whose box `at(scale)` is clear, in whole steps (adding up 0.05s drifts) */
function biggest(start: number, at: (scale: number) => Rect, clear: (r: Rect) => boolean): { scale: number; seen: Rect } | null {
  for (let k = 0; start - k * STEP_S > MIN_SCALE - STEP_S; k++) {
    const scale = Math.max(MIN_SCALE, start - k * STEP_S)
    const seen = at(scale)
    if (clear(seen)) return { scale, seen }
  }
  return null
}

export function planDecor({ vw, vh, iconsLeft, iconsRight, col }: DeskFrame): Decor {
  const decor: Decor = { stack: null }
  if (!col) return decor
  const left = iconsLeft + GAP
  const right = Math.min(iconsRight, vw) - GAP
  const top = MENUBAR_H + TOP_AIR
  const bottom = vh - DOCK_H - DOCK_AIR
  const column: Rect = { x: col.left, y: 0, width: vw - col.left, height: col.bottom }
  const taken: Rect[] = []
  const most = maxScale(vh)

  const clear = (r: Rect) => {
    if (r.x < left || r.x + r.width > right || r.y < top || r.y + r.height > bottom) return false
    if (touches(r, column, GAP)) return false
    return !taken.some((t) => touches(r, t, GAP))
  }

  /** The first of these corners where a w × h widget fits, sliding away from the corner's edge, at the biggest scale that fits there */
  const place = (size: { w: number; h: number }, corners: Corner[]): Slot | null => {
    for (const corner of corners) {
      const fromRight = corner.endsWith('right')
      const atTop = corner.startsWith('top')
      // a top-right widget stands left of the widgets column
      const edge = fromRight ? (atTop ? Math.min(col.left, right + GAP) - GAP : right) : left
      const y = (h: number) => (atTop ? top : bottom - h)
      for (let d = 0; ; d += STEP) {
        const x0 = fromRight ? edge - d : edge + d
        // slide at most to the middle of the screen
        if (fromRight ? x0 - size.w * MIN_SCALE < Math.max(left, vw / 2) : x0 + size.w * MIN_SCALE > Math.min(right, vw / 2)) break
        const fit = biggest(
          most,
          (s) => {
            const w = size.w * s
            const h = size.h * s
            return { x: fromRight ? x0 - w : x0, y: y(h), width: w, height: h }
          },
          clear,
        )
        if (!fit) continue
        taken.push(fit.seen)
        // the full-size box, placed so that scaling it about the corner lands on `seen`
        const s = fit.seen
        return {
          x: fromRight ? s.x + s.width - size.w : s.x,
          y: atTop ? s.y : s.y + s.height - size.h,
          scale: fit.scale,
          origin: ORIGIN[corner],
          seen: s,
        }
      }
    }
    return null
  }

  // bottom-right first: under the "now" card, clear of the welcome card that opens beside the icons
  decor.stack = place(STACK, ['bottom-right', 'top-right', 'bottom-left', 'top-left'])
  return decor
}
