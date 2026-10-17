import type { Rect } from '../../os/types'

/*
 * Geometry helpers for the mobile shell: sheet frames, the zoom "poses" a
 * sheet animates between, and icon rects measured as if the home screen
 * were not pushed back (so a closing sheet lands exactly on its icon).
 */

/** Gap between the status bar and a stacked (card) sheet. */
export const CARD_GAP = 10

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** Progress of `q` through the window [from, to], clamped to 0..1. */
export const span = (q: number, [from, to]: readonly [number, number]) => clamp01((q - from) / (to - from))

/** The shell's box (equals the viewport; measured so dvh quirks don't matter). */
export function shellRect(): Rect {
  const el = document.querySelector('.mshell')
  if (el) {
    const r = el.getBoundingClientRect()
    return { x: r.left, y: r.top, width: r.width, height: r.height }
  }
  return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }
}

/** Status bar height, including the top safe-area inset. */
export function statusBarHeight(): number {
  const el = document.querySelector('.mstatus')
  return el ? el.getBoundingClientRect().height : 44
}

/** Where a sheet sits at rest: full-screen at the bottom of the stack, a card above another sheet. */
export function sheetFrame(isCard: boolean): Rect {
  const shell = shellRect()
  const top = isCard ? statusBarHeight() + CARD_GAP : 0
  return { x: shell.x, y: shell.y + top, width: shell.width, height: shell.height - top }
}

/**
 * A pose of the sheet panel, relative to its rest frame.
 * x/y translate, sx/sy scale, r/rb top & bottom corner radius (visual px),
 * po panel opacity, co content opacity, sp splash (app icon) opacity.
 */
export type Pose = {
  x: number
  y: number
  sx: number
  sy: number
  r: number
  rb: number
  po: number
  co: number
  sp: number
}

export type Segment = {
  a: Pose
  b: Pose
  /** Windows of progress over which co / sp / po cross-fade */
  co: readonly [number, number]
  sp: readonly [number, number]
  po: readonly [number, number]
}

export const restPose = (r: number, rb: number): Pose => ({ x: 0, y: 0, sx: 1, sy: 1, r, rb, po: 1, co: 1, sp: 0 })

/** Is the rect roughly square (an icon), so the splash icon fits it? */
export const isIconish = (r: Rect) => Math.abs(r.width - r.height) < 14 && r.width < 120

/** Pose that makes the panel (resting at `frame`) cover `target` exactly. */
export function poseAt(target: Rect, frame: Rect): Pose {
  const sx = Math.max(0.02, target.width / frame.width)
  const sy = Math.max(0.02, target.height / frame.height)
  const x = target.x + target.width / 2 - (frame.x + frame.width / 2)
  const y = target.y + target.height / 2 - (frame.y + frame.height / 2)
  const r = Math.min(target.height / 2, target.width * 0.24, 22)
  return { x, y, sx, sy, r, rb: r, po: 1, co: 0, sp: isIconish(target) ? 1 : 0 }
}

/** Is any meaningful part of the rect inside the shell (below the status bar)? */
export function isOnScreen(r: Rect | null): r is Rect {
  if (!r) return false
  const shell = shellRect()
  const top = statusBarHeight()
  return r.width > 4 && r.y + r.height > top + 8 && r.y < shell.y + shell.height - 8 && r.x + r.width > 0 && r.x < shell.width
}

/**
 * The element's screen rect with the transform of its pushed-back layer
 * (`[data-mlayer]`, scaled while a sheet is open) undone — i.e. where the
 * icon will be once the layer springs back to rest.
 */
export function restRect(el: Element): Rect {
  const r = el.getBoundingClientRect()
  const rect = { x: r.left, y: r.top, width: r.width, height: r.height }
  const layer = el.closest<HTMLElement>('[data-mlayer]')
  if (!layer) return rect
  const cs = getComputedStyle(layer)
  if (!cs.transform || cs.transform === 'none') return rect
  const m = new DOMMatrixReadOnly(cs.transform)
  if (!m.a || !m.d) return rect
  const box = layer.getBoundingClientRect()
  // Untransformed layer box: the layer only scales + translates around its origin,
  // so invert p' = O + s·(p − O) + t for both corners.
  const [ox, oy] = cs.transformOrigin.split(' ').map(parseFloat)
  // The layer's untransformed top-left: solve from its transformed box.
  const lx = box.left - (ox - ox * m.a) - m.e
  const ly = box.top - (oy - oy * m.d) - m.f
  const OX = lx + ox
  const OY = ly + oy
  return {
    x: OX + (rect.x - OX - m.e) / m.a,
    y: OY + (rect.y - OY - m.f) / m.d,
    width: rect.width / m.a,
    height: rect.height / m.d,
  }
}
