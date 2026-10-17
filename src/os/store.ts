import { create } from 'zustand'
import { getApp } from './apps'
import type { AppId, OpenOptions, Rect, WindowState } from './types'
import { MOBILE_QUERY } from './useMedia'

/*
 * Window manager. The single source of truth for open windows on desktop
 * AND for the stack of open sheets on mobile (the mobile shell shows the
 * top-most non-minimized window full-screen).
 */

/** Desktop chrome sizes in px. Keep in sync with --menubar-h / --dock-h in tokens.css. */
export const MENUBAR_H = 32
export const DOCK_H = 78
const EDGE = 12
const CASCADE = 28
const CHROMELESS_HEADROOM = 56

type WindowsStore = {
  windows: WindowState[]
  focusedId: string | null
  /** Highest z handed out so far */
  topZ: number
  open: (appId: AppId, opts?: OpenOptions) => string
  close: (id: string) => void
  closeAll: () => void
  focus: (id: string) => void
  minimize: (id: string) => void
  restore: (id: string) => void
  toggleMaximize: (id: string) => void
  move: (id: string, x: number, y: number) => void
  resize: (id: string, rect: Partial<Rect>) => void
  setTitle: (id: string, title: string) => void
}

let serial = 0

/** Usable desktop area (below the menu bar, above the dock). */
export function workArea(): Rect {
  const w = typeof window === 'undefined' ? 1280 : window.innerWidth
  const h = typeof window === 'undefined' ? 800 : window.innerHeight
  return { x: 0, y: MENUBAR_H, width: w, height: Math.max(200, h - MENUBAR_H - DOCK_H) }
}

/** Keep a window reachable: at least its title bar stays on screen. */
export function clampRect(r: Rect): Rect {
  const area = workArea()
  const width = Math.min(r.width, area.width - EDGE * 2)
  const height = Math.min(r.height, area.height - EDGE * 2)
  const minVisible = 120
  const x = Math.min(Math.max(r.x, area.x - width + minVisible), area.x + area.width - minVisible)
  const y = Math.min(Math.max(r.y, area.y), area.y + area.height - 44)
  return { x, y, width, height }
}

const within = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max))

/**
 * Keep a rect fully inside the work area (shrinking it if it is bigger), with
 * `headroom` px kept free under the menu bar. Used to place windows the visitor
 * hasn't positioned yet; dragging uses the looser clampRect() on purpose.
 */
export function fitRect(r: Rect, headroom = 0): Rect {
  const area = workArea()
  const width = Math.min(r.width, area.width - EDGE * 2)
  const height = Math.min(r.height, area.height - EDGE * 2)
  const x = within(r.x, area.x + EDGE, area.x + area.width - width - EDGE)
  const y = within(r.y, area.y + headroom, area.y + area.height - height - EDGE)
  return { x, y, width, height }
}

const headroomOf = (appId: AppId) => (getApp(appId).chromeless ? CHROMELESS_HEADROOM : 0)

/** Room the welcome card's sun sticker pokes out past its left edge, plus a little air. */
const STICKER_ROOM = 48
let iconsRight = 0

/**
 * The desktop shell reports the right edge (px) of its icon columns on the
 * left side of the screen (0 when there is no desktop), so the welcome card
 * opens beside the icons instead of on top of them on narrow screens.
 */
export function setDesktopIconsEdge(px: number) {
  iconsRight = px
}

/**
 * Tallest a window of this app may be in the work area. Chromeless cards (the
 * welcome card) let an avatar peek over their top edge: keep that headroom
 * free so it never tucks under the menu bar on short screens. The card shrinks
 * into the rest (its content scrolls) rather than sliding under the dock.
 */
function maxHeightOf(appId: AppId, area: Rect) {
  const headroom = headroomOf(appId)
  return Math.min(Math.max(getApp(appId).minSize.height, area.height - EDGE - headroom), area.height - EDGE * 2)
}

function initialRect(appId: AppId, existing: WindowState[]): Rect {
  const app = getApp(appId)
  const area = workArea()
  const headroom = headroomOf(appId)
  const width = Math.min(app.defaultSize.width, area.width - EDGE * 2)
  const height = Math.min(app.defaultSize.height, maxHeightOf(appId, area))
  const visible = existing.filter((w) => !w.minimized).length
  const step = (visible % 6) * CASCADE
  let x = Math.round(area.x + (area.width - width) / 2 + step - CASCADE * 1.5)
  if (app.chromeless && iconsRight) x = Math.max(x, iconsRight + STICKER_ROOM)
  const y = Math.round(Math.max(area.y + headroom, area.y + Math.max(EDGE, (area.height - height) / 2 - 20) + step - CASCADE))
  // the cascade must never push a new window off the left edge or under the dock
  return fitRect({ x, y, width, height }, headroom)
}

const isMobileLayout = () => typeof window !== 'undefined' && !!window.matchMedia?.(MOBILE_QUERY).matches

/**
 * Windows opened while the phone layout was showing. Their rect was computed
 * for a sheet the visitor never saw as a window, so they get a fresh desktop
 * layout when the device switches to the desktop shell (e.g. iPad rotation).
 */
const sheetOnly = new Set<string>()

export const useWindows = create<WindowsStore>()((set, get) => ({
  windows: [],
  focusedId: null,
  topZ: 0,

  open(appId, opts = {}) {
    const app = getApp(appId)
    const id = opts.windowId ?? (app.singleton ? appId : `${appId}:${++serial}`)
    const existing = get().windows.find((w) => w.id === id)
    const z = get().topZ + 1
    if (existing) {
      set((s) => ({
        topZ: z,
        focusedId: id,
        windows: s.windows.map((w) =>
          w.id === id
            ? {
                ...w,
                z,
                minimized: false,
                pokes: w.pokes + 1,
                params: opts.params ?? w.params,
                title: opts.title ?? w.title,
              }
            : w,
        ),
      }))
      return id
    }
    const rect = initialRect(appId, get().windows)
    if (isMobileLayout()) sheetOnly.add(id)
    else sheetOnly.delete(id)
    const win: WindowState = {
      id,
      appId,
      title: opts.title ?? app.title,
      params: opts.params ?? {},
      ...rect,
      prefWidth: rect.width,
      prefHeight: rect.height,
      z,
      minimized: false,
      maximized: false,
      origin: opts.origin,
      pokes: 0,
    }
    set((s) => ({ windows: [...s.windows, win], focusedId: id, topZ: z }))
    return id
  },

  close(id) {
    sheetOnly.delete(id)
    const remaining = get().windows.filter((w) => w.id !== id)
    const next = [...remaining].filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0]
    set({ windows: remaining, focusedId: next?.id ?? null })
  },

  closeAll() {
    sheetOnly.clear()
    set({ windows: [], focusedId: null })
  },

  focus(id) {
    const { focusedId, topZ, windows } = get()
    const target = windows.find((w) => w.id === id)
    if (!target) return
    if (focusedId === id && target.z === topZ) return
    const z = topZ + 1
    set((s) => ({
      topZ: z,
      focusedId: id,
      windows: s.windows.map((w) => (w.id === id ? { ...w, z, minimized: false } : w)),
    }))
  },

  minimize(id) {
    const others = get()
      .windows.filter((w) => w.id !== id && !w.minimized)
      .sort((a, b) => b.z - a.z)
    set((s) => ({
      focusedId: others[0]?.id ?? null,
      windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)),
    }))
  },

  restore(id) {
    get().focus(id)
  },

  toggleMaximize(id) {
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, maximized: !w.maximized } : w)),
    }))
    get().focus(id)
  },

  move(id, x, y) {
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id) return w
        const r = clampRect({ x, y, width: w.width, height: w.height })
        return { ...w, x: r.x, y: r.y, maximized: false }
      }),
    }))
  },

  resize(id, rect) {
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id) return w
        const app = getApp(w.appId)
        const width = Math.max(app.minSize.width, rect.width ?? w.width)
        const height = Math.max(app.minSize.height, rect.height ?? w.height)
        // the visitor chose this size: viewport refits grow back towards it
        return { ...w, x: rect.x ?? w.x, y: rect.y ?? w.y, width, height, prefWidth: width, prefHeight: height, maximized: false }
      }),
    }))
  },

  setTitle(id, title) {
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, title } : w)) }))
  },
}))

/** Convenience for non-React callers: useWindows.getState().open(...) */
export const openApp = (appId: AppId, opts?: OpenOptions) => useWindows.getState().open(appId, opts)

/**
 * Viewport changed size (desktop only; phone sheets ignore window rects).
 * Each window is fitted from its preferred size, so a window squeezed by a
 * smaller viewport grows back when the viewport grows again, and windows that
 * now hang off the right edge or under the dock are nudged back inside.
 * rAF-batched, and the store is only touched when a rect actually changes.
 */
let refitFrame = 0
function refitToViewport() {
  refitFrame = 0
  if (isMobileLayout()) return
  const { windows } = useWindows.getState()
  if (!windows.length) return
  const area = workArea()
  const right = area.x + area.width - EDGE
  const bottom = area.y + area.height - EDGE
  let changed = false
  const next = windows.map((w) => {
    const height = Math.min(w.prefHeight ?? w.height, maxHeightOf(w.appId, area))
    const r = clampRect({ x: w.x, y: w.y, width: w.prefWidth ?? w.width, height })
    // only ever nudge left / up, and only as far as needed to fit
    if (r.x + r.width > right) r.x = Math.min(r.x, Math.max(area.x + EDGE, right - r.width))
    if (r.y + r.height > bottom) r.y = Math.min(r.y, Math.max(area.y + headroomOf(w.appId), bottom - r.height))
    if (r.x === w.x && r.y === w.y && r.width === w.width && r.height === w.height) return w
    changed = true
    return { ...w, ...r }
  })
  if (changed) useWindows.setState({ windows: next })
}

/** Phone → desktop: lay out the windows that only ever existed as sheets. */
function layoutSheetWindows() {
  const { windows } = useWindows.getState()
  const sheets = windows.filter((w) => sheetOnly.has(w.id)).sort((a, b) => a.z - b.z)
  sheetOnly.clear()
  if (!sheets.length) return
  const placed = windows.filter((w) => !sheets.includes(w))
  const laidOut = new Map<string, WindowState>()
  for (const w of sheets) {
    const r = initialRect(w.appId, placed)
    const win = { ...w, ...r, prefWidth: r.width, prefHeight: r.height, maximized: false }
    placed.push(win)
    laidOut.set(w.id, win)
  }
  useWindows.setState({ windows: windows.map((w) => laidOut.get(w.id) ?? w) })
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    if (!refitFrame) refitFrame = requestAnimationFrame(refitToViewport)
  })
  window.matchMedia?.(MOBILE_QUERY).addEventListener('change', (e) => {
    if (!e.matches) layoutSheetWindows()
  })
}
