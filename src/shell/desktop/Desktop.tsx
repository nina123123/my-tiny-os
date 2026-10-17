import { MOOD_TEXT } from '../../content/moods'
import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { AppIcon } from '../../components/AppIcon'
import { osName } from '../../content/profile'
import { preloadApp } from '../../os/preload'
import { rectOf } from '../../os/anchors'
import { APPS, getApp, isAppOn } from '../../os/apps'
import { MOODS, useSettings } from '../../os/settings'
import { DOCK_H, setDesktopIconsEdge, useWindows } from '../../os/store'
import type { AppDef, AppId, Rect } from '../../os/types'
import { useReducedMotion } from '../../os/useMedia'
import { MOOD_GLYPH, openFrom } from './actions'
import { clamp, MENUBAR_H, useViewport } from './hooks'
import { MenuList, type MenuCloseReason, type MenuEntry } from './Menu'
import { useShellUI } from './shellStore'
import { DecorLayer } from './DecorLayer'
import { Widgets } from './Widgets'
import './desktop.css'

/* ── icon grid ─────────────────────────────────────────────────────── */

const CELL_W = 96
const CELL_H = 108
const TOP = MENUBAR_H + 10
const BOTTOM = DOCK_H + 6
const SIDE = 12
const STORAGE_KEY = 'tinyos-desktop-icons-v1'
const SPRING = { type: 'spring', stiffness: 420, damping: 32 } as const

type Cell = { c: number; r: number }
/** ch = row height: rows stretch to fill the column */
type Grid = { cols: number; rows: number; x0: number; y0: number; ch: number }
type Layout = Partial<Record<AppId, Cell>>

function gridFor(vw: number, vh: number): Grid {
  const cols = Math.max(2, Math.floor((vw - SIDE * 2) / CELL_W))
  const availH = vh - TOP - BOTTOM
  // ~112px rows (never under 100) that exactly fill the column
  const rows = Math.max(2, Math.min(Math.floor(availH / 100), Math.round(availH / 112)))
  return {
    cols,
    rows,
    x0: Math.round((vw - cols * CELL_W) / 2),
    y0: TOP,
    ch: availH / rows,
  }
}

function loadLayout(): Layout {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const v: unknown = raw ? JSON.parse(raw) : null
    return v && typeof v === 'object' ? (v as Layout) : {}
  } catch {
    return {}
  }
}

function saveLayout(layout: Layout) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {
    /* private mode / blocked storage: positions just won't stick */
  }
}

const cellKey = (c: Cell) => `${c.c},${c.r}`
const validCell = (c: unknown): c is Cell =>
  !!c && typeof c === 'object' && Number.isFinite((c as Cell).c) && Number.isFinite((c as Cell).r)

/** Saved spots first, then defaults (columns from the top left), never overlapping. */
function resolveLayout(ids: AppId[], saved: Layout, g: Grid): Record<string, Cell> {
  const out: Record<string, Cell> = {}
  const taken = new Set<string>()
  const clampCell = (c: Cell): Cell => ({ c: clamp(Math.round(c.c), 0, g.cols - 1), r: clamp(Math.round(c.r), 0, g.rows - 1) })
  const nearestFree = (from: Cell): Cell => {
    let best = from
    let bestD = Infinity
    for (let c = 0; c < g.cols; c++)
      for (let r = 0; r < g.rows; r++) {
        if (taken.has(`${c},${r}`)) continue
        const d = (c - from.c) ** 2 * 1.2 + (r - from.r) ** 2
        if (d < bestD) {
          bestD = d
          best = { c, r }
        }
      }
    return best
  }
  const place = (id: AppId, want: Cell) => {
    let cell = clampCell(want)
    if (taken.has(cellKey(cell))) cell = nearestFree(cell)
    taken.add(cellKey(cell))
    out[id] = cell
  }
  for (const id of ids) {
    const s = saved[id]
    if (validCell(s)) place(id, s)
  }
  let k = 0
  for (const id of ids) {
    if (out[id]) continue
    place(id, { c: Math.floor(k / g.rows), r: k % g.rows })
    k++
  }
  return out
}

/* ── desktop surface ───────────────────────────────────────────────── */

type Ctx = { x: number; y: number; appId?: AppId; keyboard: boolean; returnTo: HTMLElement | null }

/* Each opening gets its own key so a menu that is still fading out is never
   "revived" with stale focus / position (right-click, then right-click again). */
let ctxSeq = 0
const inCtxMenu = (t: EventTarget | null) => t instanceof Element && !!t.closest('.desk__ctx')

export function Desktop() {
  const apps = useMemo(() => APPS.filter((a) => a.desktop), [])
  const ids = useMemo(() => apps.map((a) => a.id), [apps])
  const vp = useViewport()
  const grid = useMemo(() => gridFor(vp.w, vp.h), [vp.w, vp.h])
  const [saved, setSaved] = useState<Layout>(loadLayout)
  const layout = useMemo(() => resolveLayout(ids, saved, grid), [ids, saved, grid])
  const [selected, setSelected] = useState<AppId | null>(null)
  const [rove, setRove] = useState<AppId>(ids[0])
  const [ctx, setCtx] = useState<(Ctx & { seq: number }) | null>(null)
  const booted = useSettings((s) => s.booted)
  const mood = useSettings((s) => s.mood)
  const reduced = useReducedMotion()
  const openAbout = useShellUI((s) => s.openAbout)
  const hintId = useId()

  const surfaceRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const iconEls = useRef(new Map<AppId, HTMLButtonElement>())

  // where the icons on each side end: the left columns' right edge and the right side's left edge (icons dragged there)
  const edges = useMemo(() => {
    let left = 0
    let right = vp.w
    for (const id of ids) {
      const c = layout[id]
      if (!c) continue
      if (c.c < grid.cols / 2) left = Math.max(left, grid.x0 + (c.c + 1) * CELL_W)
      else right = Math.min(right, grid.x0 + c.c * CELL_W)
    }
    return { left, right }
  }, [ids, layout, grid, vp.w])

  // tell the window manager where the left icon columns end (the welcome card opens beside them)
  useEffect(() => {
    setDesktopIconsEdge(edges.left)
    return () => setDesktopIconsEdge(0)
  }, [edges.left])

  const posOf = (cell: Cell) => ({ x: grid.x0 + cell.c * CELL_W, y: Math.round(grid.y0 + cell.r * grid.ch) })
  const cellAt = (x: number, y: number): Cell => ({
    c: clamp(Math.round((x - grid.x0) / CELL_W), 0, grid.cols - 1),
    r: clamp(Math.round((y - grid.y0) / grid.ch), 0, grid.rows - 1),
  })

  const openIcon = (id: AppId, el?: Element | null) => {
    const origin = rectOf(el ?? iconEls.current.get(id)?.querySelector('.dicon__img') ?? null)
    openFrom(id, origin)
  }

  /* drag & snap */
  const onDragMove = (x: number, y: number) => {
    const g = ghostRef.current
    if (!g) return
    const p = posOf(cellAt(x, y))
    g.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
    g.dataset.show = 'true'
  }
  const onDrop = (id: AppId, x: number, y: number) => {
    if (ghostRef.current) ghostRef.current.dataset.show = 'false'
    const target = cellAt(x, y)
    const from = layout[id]
    const next: Layout = { ...layout }
    const occupant = ids.find((k) => k !== id && layout[k]?.c === target.c && layout[k]?.r === target.r)
    next[id] = target
    if (occupant && from) next[occupant] = from
    setSaved(next)
    saveLayout(next)
    return posOf(target)
  }

  /* arrow-key navigation between icons (spatial) */
  const onNav = (id: AppId, key: string) => {
    const cur = layout[id]
    if (!cur) return
    let best: AppId | null = null
    let bestScore = Infinity
    for (const other of ids) {
      const c = layout[other]
      if (other === id || !c) continue
      const dc = c.c - cur.c
      const dr = c.r - cur.r
      const [primary, secondary] =
        key === 'ArrowRight' ? [dc, dr] : key === 'ArrowLeft' ? [-dc, dr] : key === 'ArrowDown' ? [dr, dc] : [-dr, dc]
      if (primary <= 0) continue
      const score = primary + Math.abs(secondary) * 2.5
      if (score < bestScore) {
        bestScore = score
        best = other
      }
    }
    if (best) iconEls.current.get(best)?.focus()
  }

  /* context menu */
  const openCtx = (c: Ctx) => {
    setCtx({ ...c, seq: ++ctxSeq })
  }
  const closeCtx = (reason: MenuCloseReason | 'outside') => {
    const back = ctx?.returnTo
    setCtx(null)
    if (reason !== 'outside' && back?.isConnected) back.focus({ preventScroll: true })
  }

  useEffect(() => {
    if (!ctx) return
    const onDown = (e: globalThis.PointerEvent) => {
      if (!inCtxMenu(e.target)) setCtx(null)
    }
    const onBlur = () => setCtx(null)
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('blur', onBlur)
    window.addEventListener('resize', onBlur)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', onBlur)
    }
  }, [ctx])

  const keyboardCtx = () => {
    const active = document.activeElement as HTMLElement | null
    const iconWrap = active?.closest<HTMLElement>('[data-desk-icon]')
    const appId = iconWrap?.dataset.deskIcon as AppId | undefined
    if (appId && active) {
      const r = active.getBoundingClientRect()
      openCtx({ x: r.left + r.width * 0.6, y: r.top + r.height * 0.55, appId, keyboard: true, returnTo: active })
    } else {
      openCtx({ x: Math.round(vp.w * 0.32), y: Math.round(vp.h * 0.28), keyboard: true, returnTo: active })
    }
  }

  // Shift+F10 / ContextMenu also work when nothing has focus (focus on <body>,
  // e.g. after the last window closed): that's "the desktop" too.
  const keyboardCtxRef = useRef(keyboardCtx)
  useEffect(() => {
    keyboardCtxRef.current = keyboardCtx
  })
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'ContextMenu' && !(e.key === 'F10' && e.shiftKey)) return
      const a = document.activeElement
      if (a && a !== document.body && a !== document.documentElement) return
      e.preventDefault()
      keyboardCtxRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    if (inCtxMenu(e.target)) return
    e.preventDefault()
    // Keyboard-generated context menus (ContextMenu key) report 0,0
    if (e.clientX === 0 && e.clientY === 0) return keyboardCtx()
    const iconWrap = (e.target as Element).closest<HTMLElement>('[data-desk-icon]')
    const appId = iconWrap?.dataset.deskIcon as AppId | undefined
    if (appId) setSelected(appId)
    openCtx({ x: e.clientX, y: e.clientY, appId, keyboard: false, returnTo: document.activeElement as HTMLElement | null })
  }

  const onSurfaceKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault()
      keyboardCtx()
    } else if (e.key === 'Escape' && selected) {
      setSelected(null)
    }
  }

  const onSurfaceDown = (e: PointerEvent<HTMLDivElement>) => {
    const t = e.target as Element
    if (t.closest('[data-desk-icon]') || inCtxMenu(t)) return
    setSelected(null)
    // Clicking the wallpaper un-focuses windows, like a real desktop.
    if (useWindows.getState().focusedId) useWindows.setState({ focusedId: null })
  }

  const pointOrigin = (c: Ctx): Rect => ({ x: c.x - 24, y: c.y - 24, width: 48, height: 48 })

  const ctxItems = (c: Ctx): MenuEntry[] => [
    ...(c.appId
      ? ([
          {
            type: 'item',
            id: 'open',
            label: `Open ${getApp(c.appId).name}`,
            icon: '↗',
            onSelect: () => c.appId && openIcon(c.appId),
          },
          { type: 'separator', id: 's0' },
        ] satisfies MenuEntry[])
      : []),
    {
      type: 'submenu',
      id: 'vibe',
      label: 'Change vibe',
      icon: '🎨',
      items: MOODS.map((m) => ({
        type: 'radio' as const,
        id: `vibe-${m}`,
        label: MOOD_TEXT[m].label,
        icon: MOOD_GLYPH[m],
        checked: mood === m,
        onSelect: () => useSettings.getState().setMood(m),
      })),
    },
    { type: 'separator', id: 's1' },
    { type: 'item', id: 'projects', label: 'Open Projects', icon: '🗂️', onSelect: () => openFrom('projects', pointOrigin(c)) },
    ...(isAppOn('guestbook')
      ? [{ type: 'item' as const, id: 'guestbook', label: 'Sign the guestbook', icon: '💌', onSelect: () => openFrom('guestbook', pointOrigin(c)) }]
      : []),
    { type: 'separator', id: 's2' },
    { type: 'item', id: 'about', label: `About ${osName}`, icon: '✨', onSelect: openAbout },
  ]

  return (
    <div
      ref={surfaceRef}
      className="desk"
      role="region"
      aria-label="Desktop"
      tabIndex={-1}
      onPointerDown={onSurfaceDown}
      onContextMenu={onContextMenu}
      onKeyDown={onSurfaceKey}
    >
      <Widgets />

      <div ref={ghostRef} className="desk__ghost" data-show="false" aria-hidden="true" />

      <div className="desk__icons" role="group" aria-label="Desktop icons" aria-describedby={hintId}>
        {apps.map((app, i) => {
          const cell = layout[app.id]
          if (!cell) return null
          const p = posOf(cell)
          return (
            <DesktopIcon
              key={app.id}
              app={app}
              index={i}
              x={p.x}
              y={p.y}
              selected={selected === app.id}
              tabbable={rove === app.id}
              booted={booted}
              reduced={reduced}
              registerEl={(el) => {
                if (el) iconEls.current.set(app.id, el)
                else iconEls.current.delete(app.id)
              }}
              onSelect={() => {
                setSelected(app.id)
                setRove(app.id)
              }}
              onOpen={(el) => openIcon(app.id, el)}
              onNav={(key) => onNav(app.id, key)}
              onDragMove={onDragMove}
              onDrop={(x, y) => onDrop(app.id, x, y)}
            />
          )
        })}
      </div>
      <p id={hintId} className="sr-only">
        Arrow keys move between icons, Enter opens one. Shift F10 opens the desktop menu.
      </p>

      {/* after the icons for keyboard order, but painted under them (see .decor-slot) */}
      <DecorLayer vw={vp.w} vh={vp.h} iconsLeft={edges.left} iconsRight={edges.right} />

      <AnimatePresence>
        {ctx && (
          <div key={`ctx-${ctx.seq}`} className="desk__ctx" style={{ left: ctx.x, top: ctx.y }}>
            <MenuList
              label={ctx.appId ? `${getApp(ctx.appId).name} options` : 'Desktop'}
              items={ctxItems(ctx)}
              initialFocus={ctx.keyboard ? 'first' : 'menu'}
              onClose={closeCtx}
              fit
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── one desktop icon ──────────────────────────────────────────────── */

type IconProps = {
  app: AppDef
  index: number
  x: number
  y: number
  selected: boolean
  tabbable: boolean
  booted: boolean
  reduced: boolean
  registerEl: (el: HTMLButtonElement | null) => void
  onSelect: () => void
  onOpen: (imgEl: Element | null) => void
  onNav: (key: string) => void
  onDragMove: (x: number, y: number) => void
  onDrop: (x: number, y: number) => { x: number; y: number }
}

function focusVisible(el: Element): boolean {
  try {
    return el.matches(':focus-visible')
  } catch {
    return true // no :focus-visible support: keep selecting on focus
  }
}

function DesktopIcon({ app, index, x, y, selected, tabbable, booted, reduced, registerEl, onSelect, onOpen, onNav, onDragMove, onDrop }: IconProps) {
  const mx = useMotionValue(x)
  const my = useMotionValue(y)
  const imgRef = useRef<HTMLSpanElement>(null)
  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean; pid: number } | null>(null)
  const suppressClick = useRef(false)
  const pointerType = useRef('mouse')
  const [dragging, setDragging] = useState(false)

  // Glide to the grid cell whenever it changes (swap, resize, restore).
  useEffect(() => {
    if (drag.current?.moved) return
    if (reduced) {
      mx.set(x)
      my.set(y)
      return
    }
    const a = animate(mx, x, SPRING)
    const b = animate(my, y, SPRING)
    return () => {
      a.stop()
      b.stop()
    }
  }, [x, y, reduced, mx, my])

  const endDrag = () => {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    suppressClick.current = true
    setDragging(false)
    const t = onDrop(mx.get(), my.get())
    if (reduced) {
      mx.set(t.x)
      my.set(t.y)
    } else {
      animate(mx, t.x, SPRING)
      animate(my, t.y, SPRING)
    }
  }

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    suppressClick.current = false
    pointerType.current = e.pointerType
    if (e.button !== 0) return
    drag.current = { px: e.clientX, py: e.clientY, x: mx.get(), y: my.get(), moved: false, pid: e.pointerId }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d || d.pid !== e.pointerId) return
    const dx = e.clientX - d.px
    const dy = e.clientY - d.py
    if (!d.moved) {
      if (Math.hypot(dx, dy) < (e.pointerType === 'mouse' ? 4 : 8)) return
      d.moved = true
      setDragging(true)
      onSelect()
    }
    const nx = clamp(d.x + dx, 0, window.innerWidth - CELL_W)
    const ny = clamp(d.y + dy, MENUBAR_H, window.innerHeight - CELL_H)
    mx.set(nx)
    my.set(ny)
    onDragMove(nx, ny)
  }

  const hidden = reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5, y: 16 }
  const shown = {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: reduced
      ? { duration: 0.2 }
      : { type: 'spring' as const, stiffness: 460, damping: 20, delay: 0.12 + index * 0.06 },
  }

  return (
    <motion.div
      className={`dicon${selected ? ' is-selected' : ''}${dragging ? ' is-dragging' : ''}`}
      style={{ x: mx, y: my }}
      data-desk-icon={app.id}
    >
      <motion.button
        ref={registerEl}
        type="button"
        className="dicon__btn"
        tabIndex={tabbable ? 0 : -1}
        initial={hidden}
        animate={booted ? shown : hidden}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onPointerEnter={() => preloadApp(app.id)}
        onFocus={(e) => {
          preloadApp(app.id)
          // keyboard focus selects; a mouse click selects in onClick, and focus put
          // back here after a window closes leaves the desktop quiet
          if (focusVisible(e.currentTarget)) onSelect()
        }}
        onClick={(e) => {
          if (suppressClick.current) {
            suppressClick.current = false
            return
          }
          onSelect()
          // Touch has no double-click: a single tap opens.
          if (e.detail > 0 && pointerType.current !== 'mouse') onOpen(imgRef.current)
        }}
        onDoubleClick={() => {
          if (!dragging) onOpen(imgRef.current)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onOpen(imgRef.current)
          } else if (e.key.startsWith('Arrow')) {
            e.preventDefault()
            onNav(e.key)
          }
        }}
      >
        <span ref={imgRef} className="dicon__img">
          <AppIcon appId={app.id} size={64} />
        </span>
        <span className="dicon__label">{app.name}</span>
      </motion.button>
    </motion.div>
  )
}
