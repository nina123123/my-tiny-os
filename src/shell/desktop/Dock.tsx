import { animate, motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AppIcon } from '../../components/AppIcon'
import { CoverArt } from '../../components/CoverArt'
import { preloadApp } from '../../os/preload'
import { rectOf, registerAnchor } from '../../os/anchors'
import { APPS, getApp } from '../../os/apps'
import { useSettings } from '../../os/settings'
import { useWindows } from '../../os/store'
import type { AppDef, AppId, WindowState } from '../../os/types'
import { useReducedMotion } from '../../os/useMedia'
import { focusWindowEl } from './actions'
import { registerDockTile } from './shellStore'
import './dock.css'

/*
 * The dock: app icons, then a divider and tiles for minimized windows that have no
 * app icon of their own (e.g. a project window).
 *
 * Magnification is pure transforms: each slot gets a scale (bump around the
 * pointer) and an x offset so neighbours make room; the glass background
 * stretches with scaleX. Everything is driven by motion values, no re-renders.
 */

const ICON = 52
const MAX_EXTRA = 0.55 // 52px → ~81px at the peak
const RANGE = 150 // px of influence either side of the pointer

type SlotMVs = { scale: MotionValue<number>; x: MotionValue<number> }
type Slot =
  | { kind: 'app'; key: string; app: AppDef }
  | { kind: 'win'; key: string; win: WindowState }
  | { kind: 'divider'; key: string }

export function Dock() {
  const windows = useWindows((s) => s.windows)
  const booted = useSettings((s) => s.booted)
  const reduced = useReducedMotion()

  const dockApps = APPS.filter((a) => a.dock)
  const extras = windows.filter((w) => w.minimized && !getApp(w.appId).dock)

  // the apps, then (after a divider) minimized windows that have no dock icon of their own
  const slots: Slot[] = [
    ...dockApps.map((app) => ({ kind: 'app' as const, key: app.id, app })),
    ...(extras.length ? [{ kind: 'divider' as const, key: 'divider' }] : []),
    ...extras.map((win) => ({ kind: 'win' as const, key: `win:${win.id}`, win })),
  ]
  const slotKeys = slots.map((s) => s.key).join('|')

  /* ── magnification ─────────────────────────────────────────────── */
  const rowRef = useRef<HTMLDivElement>(null)
  const rowLeft = useRef(0)
  const geo = useRef({ keys: [] as string[], centers: [] as number[], widths: [] as number[], scalable: [] as boolean[], base: 1 })
  const mvs = useRef(new Map<string, SlotMVs>())
  const mouseX = useMotionValue(-1e4)
  const hover = useMotionValue(0)
  const amount = useSpring(hover, { stiffness: 340, damping: 32 })
  const bgScale = useMotionValue(1)

  const update = useCallback(() => {
    const g = geo.current
    const mx = mouseX.get()
    const a = amount.get()
    let total = 0
    const extra = g.centers.map((c, i) => {
      if (!g.scalable[i] || a < 0.001) return 0
      const d = Math.abs(mx - c)
      if (d >= RANGE) return 0
      const s = MAX_EXTRA * a * (1 + Math.cos((Math.PI * d) / RANGE)) * 0.5
      total += s * g.widths[i]
      return s
    })
    let run = 0
    g.keys.forEach((k, i) => {
      const grow = extra[i] * g.widths[i]
      const mv = mvs.current.get(k)
      if (mv) {
        mv.scale.set(1 + extra[i])
        mv.x.set(run + grow / 2 - total / 2)
      }
      run += grow
    })
    bgScale.set((g.base + total) / g.base)
  }, [mouseX, amount, bgScale])

  const measure = useCallback(() => {
    const row = rowRef.current
    if (!row) return
    const kids = Array.from(row.children) as HTMLElement[]
    geo.current = {
      keys: kids.map((k) => k.dataset.key ?? ''),
      centers: kids.map((k) => k.offsetLeft + k.offsetWidth / 2),
      widths: kids.map((k) => k.offsetWidth),
      scalable: kids.map((k) => k.dataset.scalable === 'true'),
      base: (row.parentElement?.offsetWidth ?? row.offsetWidth) || 1,
    }
    update()
  }, [update])

  useLayoutEffect(measure, [slotKeys, measure])

  useEffect(() => {
    const row = rowRef.current
    if (!row || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measure())
    ro.observe(row)
    const offX = mouseX.on('change', update)
    const offA = amount.on('change', update)
    return () => {
      ro.disconnect()
      offX()
      offA()
    }
  }, [measure, update, mouseX, amount])

  const register = useCallback(
    (key: string, v: SlotMVs | null) => {
      if (v) mvs.current.set(key, v)
      else mvs.current.delete(key)
    },
    [],
  )

  /* ── bounce when an app opens ──────────────────────────────────── */
  const prevIds = useRef<Set<string> | null>(null)
  const [bounces, setBounces] = useState<Partial<Record<AppId, number>>>({})
  useEffect(() => {
    const next = new Set(windows.map((w) => w.id))
    const prev = prevIds.current
    prevIds.current = next
    if (!prev) return
    const opened = windows.filter((w) => !prev.has(w.id)).map((w) => w.appId)
    if (opened.length)
      setBounces((b) => {
        const c = { ...b }
        for (const id of opened) c[id] = (c[id] ?? 0) + 1
        return c
      })
  }, [windows])

  /* ── roving focus (toolbar pattern) ────────────────────────────── */
  const [roveKey, setRove] = useState<string>(slots[0]?.key ?? '')
  // If the remembered tab stop disappeared (a minimized tile was restored), fall back to the first icon.
  const rove = slots.some((s) => s.key === roveKey && s.kind !== 'divider') ? roveKey : (slots[0]?.key ?? '')
  const onRowKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const btns = Array.from(rowRef.current?.querySelectorAll<HTMLButtonElement>('.dock__btn') ?? [])
    const i = btns.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    let n = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % btns.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + btns.length) % btns.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = btns.length - 1
    if (n < 0) return
    e.preventDefault()
    btns[n].focus()
  }

  const tracking = !reduced
  return (
    <nav className="dock" aria-label="Dock">
      <motion.div
        className="dock__pill"
        initial={reduced ? { opacity: 0 } : { y: 130 }}
        animate={reduced ? { opacity: booted ? 1 : 0 } : { y: booted ? 0 : 130 }}
        transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 240, damping: 24, delay: booted ? 0.3 : 0 }}
        onPointerEnter={(e) => {
          if (!tracking || e.pointerType !== 'mouse') return
          rowLeft.current = rowRef.current?.getBoundingClientRect().left ?? 0
          mouseX.set(e.clientX - rowLeft.current)
          hover.set(1)
        }}
        onPointerMove={(e) => {
          if (!tracking || e.pointerType !== 'mouse') return
          mouseX.set(e.clientX - rowLeft.current)
          if (hover.get() !== 1) hover.set(1)
        }}
        onPointerLeave={() => hover.set(0)}
      >
        <motion.div className="dock__bg" style={{ scaleX: bgScale }} aria-hidden="true" />
        <div ref={rowRef} className="dock__row" role="toolbar" aria-label="Apps" onKeyDown={onRowKey}>
          {slots.map((slot) => {
            if (slot.kind === 'divider') return <DockDivider key={slot.key} slotKey={slot.key} register={register} />
            if (slot.kind === 'win')
              return (
                <DockItem
                  key={slot.key}
                  slotKey={slot.key}
                  register={register}
                  label={slot.win.title}
                  ariaLabel={`${slot.win.title} (minimized)`}
                  tabbable={rove === slot.key}
                  onFocus={() => setRove(slot.key)}
                  windowId={slot.win.id}
                  running
                  minimized
                  onActivate={() => useWindows.getState().restore(slot.win.id)}
                  icon={<WindowThumb win={slot.win} />}
                />
              )
            const app = slot.app
            const mine = windows.filter((w) => w.appId === app.id)
            const running = mine.length > 0
            const allMin = running && mine.every((w) => w.minimized)
            return (
              <DockItem
                key={slot.key}
                slotKey={slot.key}
                register={register}
                appId={app.id}
                label={app.name}
                ariaLabel={`${app.name}${allMin ? ' (minimized)' : running ? ' (open)' : ''}`}
                tabbable={rove === slot.key}
                onFocus={() => setRove(slot.key)}
                running={running}
                minimized={allMin}
                bounce={bounces[app.id] ?? 0}
                reduced={reduced}
                onActivate={(el) => activateApp(app.id, el)}
                icon={<AppIcon appId={app.id} size={ICON} />}
              />
            )
          })}
        </div>
      </motion.div>
    </nav>
  )
}

function activateApp(appId: AppId, el: HTMLElement | null) {
  const st = useWindows.getState()
  const mine = st.windows.filter((w) => w.appId === appId).sort((a, b) => b.z - a.z)
  if (!mine.length) {
    const origin = rectOf(el)
    st.open(appId, origin ? { origin } : undefined)
    return
  }
  const visible = mine.find((w) => !w.minimized)
  if (visible) {
    st.focus(visible.id)
    focusWindowEl(visible.id)
  } else st.restore(mine[0].id)
}

/*
 * Project content is big, so the dock loads it on demand instead of shipping it in
 * the first bundle. A project tile only exists after a project window was opened,
 * by which time the chunk is already cached, so this resolves right away.
 */
type ProjectsContent = typeof import('../../content/projects')
let projectsContent: ProjectsContent | null = null

function useProjectsContent(needed: boolean): ProjectsContent | null {
  const [mod, setMod] = useState(projectsContent)
  useEffect(() => {
    if (!needed || mod) return
    let alive = true
    import('../../content/projects')
      .then((m) => {
        projectsContent = m
        if (alive) setMod(m)
      })
      .catch(() => {
        /* the tile keeps its plain app icon */
      })
    return () => {
      alive = false
    }
  }, [needed, mod])
  return mod
}

function WindowThumb({ win }: { win: WindowState }) {
  const content = useProjectsContent(win.appId === 'project')
  const project = win.appId === 'project' ? content?.getProject(String(win.params.projectId ?? '')) : undefined
  return (
    <span className="dock__thumb">
      {project ? (
        <span className="dock__cover">
          <CoverArt colors={project.colors} emoji={project.emoji} src={project.cover} seed={project.id} sizes="52px" />
        </span>
      ) : (
        <AppIcon appId={win.appId} size={ICON} />
      )}
      {project && (
        <span className="dock__badge">
          <AppIcon appId="projects" size={20} />
        </span>
      )}
    </span>
  )
}

/** The divider has no magnification of its own but still slides aside. */
function DockDivider({ slotKey, register }: { slotKey: string; register: (key: string, v: SlotMVs | null) => void }) {
  const scale = useMotionValue(1)
  const x = useMotionValue(0)
  useLayoutEffect(() => {
    register(slotKey, { scale, x })
    return () => register(slotKey, null)
  }, [slotKey, register, scale, x])
  return <motion.div data-key={slotKey} className="dock__divider" role="separator" aria-orientation="vertical" style={{ x }} />
}

type DockItemProps = {
  slotKey: string
  register: (key: string, v: SlotMVs | null) => void
  label: string
  ariaLabel: string
  icon: ReactNode
  tabbable: boolean
  running: boolean
  /** every window of this app is minimized → hollow dot */
  minimized?: boolean
  onActivate: (el: HTMLButtonElement | null) => void
  onFocus: () => void
  appId?: AppId
  windowId?: string
  bounce?: number
  reduced?: boolean
}

function DockItem({ slotKey, register, label, ariaLabel, icon, tabbable, running, minimized, onActivate, onFocus, appId, windowId, bounce = 0, reduced }: DockItemProps) {
  const scale = useMotionValue(1)
  const x = useMotionValue(0)
  const bounceY = useMotionValue(0)
  const tipY = useTransform(scale, (s) => -(s - 1) * ICON)
  const btnRef = useRef<HTMLButtonElement>(null)
  const lastBounce = useRef(bounce)

  useLayoutEffect(() => {
    register(slotKey, { scale, x })
    return () => register(slotKey, null)
  }, [slotKey, register, scale, x])

  useEffect(() => {
    if (!appId) return
    return registerAnchor(appId, () => rectOf(btnRef.current))
  }, [appId])

  useEffect(() => {
    if (bounce === lastBounce.current) return
    lastBounce.current = bounce
    if (reduced) return
    animate(bounceY, [0, -22, 0, -9, 0], { duration: 0.9, times: [0, 0.3, 0.58, 0.78, 1], ease: ['easeOut', 'easeIn', 'easeOut', 'easeIn'] })
  }, [bounce, reduced, bounceY])

  return (
    <motion.div className="dock__slot" data-key={slotKey} data-scalable="true" style={{ x }}>
      <motion.button
        ref={(el) => {
          btnRef.current = el
          if (windowId) registerDockTile(windowId, el)
        }}
        type="button"
        className="dock__btn"
        aria-label={ariaLabel}
        tabIndex={tabbable ? 0 : -1}
        data-dock-app={appId}
        data-dock-window={windowId}
        style={{ scale, transformOrigin: '50% 100%' }}
        onClick={() => onActivate(btnRef.current)}
        onPointerEnter={() => appId && preloadApp(appId)}
        onFocus={() => {
          onFocus()
          if (appId) preloadApp(appId)
        }}
      >
        <motion.span className="dock__icon" style={{ y: bounceY }}>
          <span className="dock__press">{icon}</span>
        </motion.span>
      </motion.button>
      <motion.span className="dock__tip" style={{ y: tipY }} aria-hidden="true">
        {label}
      </motion.span>
      <span className="dock__dot" data-on={running || undefined} data-min={minimized || undefined} aria-hidden="true" />
    </motion.div>
  )
}
