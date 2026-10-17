import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { useReducedMotion } from '../../os/useMedia'
import { CheckGlyph, ChevronGlyph } from './Glyphs'
import './menu.css'

/*
 * The OS's menu: a glass dropdown implementing the WAI-ARIA menu pattern.
 * Used by the menu bar (File / Edit / Vibes …) and the desktop context menu.
 *
 * Keys: ↑ ↓ Home End move · Enter activates (and closes) · Space toggles a
 * radio/checkbox without closing · → opens a submenu (or the next menu-bar
 * menu) · ← closes a submenu (or goes to the previous menu-bar menu) ·
 * Esc closes · Tab closes · letters jump to the matching item.
 * Mouse: hover highlights; hovering a submenu item opens it; clicking a
 * radio/checkbox keeps the menu open so you can watch the vibe change.
 */

export type MenuEntry =
  | { type: 'item'; id: string; label: string; icon?: ReactNode; hint?: string; disabled?: boolean; onSelect: () => void }
  | { type: 'radio'; id: string; label: string; icon?: ReactNode; checked: boolean; onSelect: () => void }
  | { type: 'checkbox'; id: string; label: string; icon?: ReactNode; checked: boolean; onSelect: () => void }
  | { type: 'separator'; id: string }
  | { type: 'group'; id: string; label: string; items: MenuEntry[] }
  | { type: 'submenu'; id: string; label: string; icon?: ReactNode; items: MenuEntry[] }

type Actionable = Exclude<MenuEntry, { type: 'separator' } | { type: 'group' }>

export type MenuCloseReason = 'select' | 'escape' | 'tab'

type MenuListProps = {
  items: MenuEntry[]
  id?: string
  /** id of the element that labels this menu (e.g. the menu-bar button) */
  labelledBy?: string
  /** aria-label when there is no labelling element */
  label?: string
  /** What receives focus when the menu opens. 'menu' focuses the container (mouse-open). */
  initialFocus?: 'first' | 'last' | 'menu'
  /** Close the whole menu chain */
  onClose: (reason: MenuCloseReason) => void
  /** ←/→ when the menu can't handle it itself (menu bar switches menus) */
  onNavigate?: (dir: -1 | 1) => void
  /** Submenus only: close this submenu and return to its parent item */
  onBack?: () => void
  /** Submenus only: keeps the parent from closing us while the pointer is inside */
  onPointerEnterMenu?: () => void
  /** Keep the menu on screen by nudging it (context menus) */
  fit?: boolean
  /** Left edge of the parent menu; a submenu flips to that side if it would overflow */
  flipLeft?: number
  className?: string
  style?: CSSProperties
}

const flatten = (entries: MenuEntry[], out = new Map<string, Actionable>()) => {
  for (const e of entries) {
    if (e.type === 'group') flatten(e.items, out)
    else if (e.type !== 'separator') out.set(e.id, e)
  }
  return out
}

const hasChecks = (entries: MenuEntry[]): boolean =>
  entries.some((e) => e.type === 'radio' || e.type === 'checkbox' || (e.type === 'group' && hasChecks(e.items)))

export function MenuList({
  items,
  id,
  labelledBy,
  label,
  initialFocus = 'menu',
  onClose,
  onNavigate,
  onBack,
  onPointerEnterMenu,
  fit,
  flipLeft,
  className,
  style,
}: MenuListProps) {
  const ref = useRef<HTMLDivElement>(null)
  const uid = useId()
  const reduced = useReducedMotion()
  const present = useIsPresent()
  const [sub, setSub] = useState<{ id: string; focus: 'first' | 'menu'; left: number; top: number; parentLeft: number; seq: number } | null>(
    null,
  )
  // bumps on every fresh open, so a submenu still fading out is never revived (with stale focus)
  const subSeq = useRef(0)
  const timer = useRef(0)
  const typed = useRef({ text: '', at: 0 })
  const byId = flatten(items)
  const checks = hasChecks(items)
  const isSub = !!onBack

  const getItems = () => {
    const root = ref.current
    if (!root) return []
    return Array.from(root.querySelectorAll<HTMLElement>('[data-menuitem]')).filter((el) => el.closest('[role="menu"]') === root)
  }

  // Initial focus + keep on screen
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const its = getItems()
    if (initialFocus === 'first') its[0]?.focus({ preventScroll: true })
    else if (initialFocus === 'last') its[its.length - 1]?.focus({ preventScroll: true })
    else root.focus({ preventScroll: true })

    // Measure the menu's resting box: at mount it still carries its entry
    // transform (scaled down + nudged up), which would under-report the size
    // and let a menu opened near the bottom edge spill off screen.
    const prevTransform = root.style.transform
    root.style.transform = 'none'
    const r = root.getBoundingClientRect()
    root.style.transform = prevTransform
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (isSub && flipLeft !== undefined && r.right > vw - 8) root.style.left = `${flipLeft - r.width - 4}px`
    else if (fit && r.right > vw - 8) root.style.marginLeft = `${vw - 8 - r.right}px`
    if ((fit || isSub) && r.bottom > vh - 8) root.style.marginTop = `${Math.max(-r.top + 8, vh - 8 - r.bottom)}px`
    // mount-only on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const openSub = (entryId: string, focus: 'first' | 'menu') => {
    window.clearTimeout(timer.current)
    const root = ref.current
    const trigger = root?.querySelector<HTMLElement>(`[data-id="${CSS.escape(entryId)}"]`)
    if (!root || !trigger) return
    if (sub?.id === entryId) {
      // Already open (e.g. → again): just move into it.
      if (focus === 'first') document.getElementById(`${uid}-sub-${sub.seq}`)?.querySelector<HTMLElement>('[data-menuitem]')?.focus({ preventScroll: true })
      return
    }
    // Position relative to our shared offset parent (the menu's container).
    const left = root.offsetLeft + root.offsetWidth + 4
    const top = root.offsetTop + trigger.offsetTop - 7
    setSub({ id: entryId, focus, left, top, parentLeft: root.offsetLeft, seq: ++subSeq.current })
  }

  const closeSub = (refocus: boolean) => {
    window.clearTimeout(timer.current)
    if (!sub) return
    const trigger = ref.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(sub.id)}"]`)
    setSub(null)
    if (refocus) trigger?.focus({ preventScroll: true })
  }

  const nope = (el: HTMLElement) => {
    if (reduced || typeof el.animate !== 'function') return
    el.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }],
      { duration: 320, easing: 'ease-out' },
    )
  }

  const activate = (entry: Actionable | undefined, via: 'click' | 'enter' | 'space', el: HTMLElement) => {
    if (!entry) return
    if (entry.type === 'item' && entry.disabled) return nope(el)
    if (entry.type === 'submenu') {
      if (sub?.id === entry.id && via === 'click') return
      return openSub(entry.id, via === 'click' ? 'menu' : 'first')
    }
    if (entry.type === 'item') {
      onClose('select')
      entry.onSelect()
      return
    }
    entry.onSelect()
    if (via === 'enter') onClose('select')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const its = getItems()
    const active = document.activeElement as HTMLElement | null
    const idx = active ? its.indexOf(active) : -1
    const n = its.length
    const move = (i: number) => n && its[((i % n) + n) % n].focus({ preventScroll: true })
    const entry = idx >= 0 ? byId.get(its[idx].dataset.id ?? '') : undefined

    switch (e.key) {
      case 'ArrowDown':
        move(idx < 0 ? 0 : idx + 1)
        break
      case 'ArrowUp':
        move(idx < 0 ? n - 1 : idx - 1)
        break
      case 'Home':
      case 'PageUp':
        move(0)
        break
      case 'End':
      case 'PageDown':
        move(n - 1)
        break
      case 'ArrowRight':
        if (entry?.type === 'submenu') openSub(entry.id, 'first')
        else if (onNavigate) onNavigate(1)
        break
      case 'ArrowLeft':
        if (onBack) onBack()
        else if (onNavigate) onNavigate(-1)
        break
      case 'Escape':
        if (onBack) onBack()
        else onClose('escape')
        break
      case 'Tab':
        onClose('tab')
        break
      case 'Enter':
      case ' ':
        if (idx >= 0) activate(entry, e.key === 'Enter' ? 'enter' : 'space', its[idx])
        else if (e.key === 'Enter') move(0)
        break
      default: {
        if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) {
          if (isSub) e.stopPropagation()
          return
        }
        // type-ahead: jump to the next item starting with the typed letters
        const now = e.timeStamp
        typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase(), at: now }
        const q = typed.current.text
        const labelOf = (el: HTMLElement) => (el.querySelector('.dmenu__label')?.textContent ?? '').trim().toLowerCase()
        for (let k = 1; k <= n; k++) {
          const cand = its[(Math.max(idx, 0) + (q.length > 1 ? k - 1 : k)) % n]
          if (labelOf(cand).startsWith(q)) {
            cand.focus({ preventScroll: true })
            break
          }
        }
      }
    }
    e.preventDefault()
    e.stopPropagation()
  }

  const renderEntries = (entries: MenuEntry[]): ReactNode =>
    entries.map((entry) => {
      if (entry.type === 'separator') return <div key={entry.id} role="separator" className="dmenu__sep" />
      if (entry.type === 'group')
        return (
          <div key={entry.id} role="group" aria-label={entry.label} className="dmenu__group">
            <div className="dmenu__group-label kicker" aria-hidden="true">
              {entry.label}
            </div>
            {renderEntries(entry.items)}
          </div>
        )

      const role = entry.type === 'radio' ? 'menuitemradio' : entry.type === 'checkbox' ? 'menuitemcheckbox' : 'menuitem'
      const checked = entry.type === 'radio' || entry.type === 'checkbox' ? entry.checked : undefined
      const disabled = entry.type === 'item' && entry.disabled
      const isSubmenu = entry.type === 'submenu'
      const expanded = isSubmenu ? sub?.id === entry.id : undefined

      return (
        <button
          key={entry.id}
          type="button"
          role={role}
          tabIndex={-1}
          data-menuitem=""
          data-id={entry.id}
          className="dmenu__item"
          aria-checked={checked}
          aria-disabled={disabled || undefined}
          aria-haspopup={isSubmenu ? 'menu' : undefined}
          aria-expanded={expanded}
          onClick={(e) => activate(entry, 'click', e.currentTarget)}
          onPointerMove={(e) => {
            if (e.pointerType !== 'mouse') return
            const el = e.currentTarget
            if (document.activeElement !== el) el.focus({ preventScroll: true })
            window.clearTimeout(timer.current)
            if (isSubmenu) {
              if (sub?.id !== entry.id) timer.current = window.setTimeout(() => openSub(entry.id, 'menu'), 130)
            } else if (sub) {
              timer.current = window.setTimeout(() => closeSub(false), 260)
            }
          }}
          onPointerLeave={(e) => {
            if (e.pointerType !== 'mouse') return
            if (isSubmenu && sub?.id === entry.id) return
            if (isSubmenu) window.clearTimeout(timer.current)
            if (document.activeElement === e.currentTarget) ref.current?.focus({ preventScroll: true })
          }}
        >
          {checks && (
            <span className="dmenu__check" aria-hidden="true">
              {checked ? entry.type === 'radio' ? <span className="dmenu__dot" /> : <CheckGlyph /> : null}
            </span>
          )}
          {entry.icon != null && (
            <span className="dmenu__icon" aria-hidden="true">
              {entry.icon}
            </span>
          )}
          <span className="dmenu__label">{entry.label}</span>
          {entry.type === 'item' && entry.hint && <span className="dmenu__hint">{entry.hint}</span>}
          {isSubmenu && <ChevronGlyph className="dmenu__chev" />}
        </button>
      )
    })

  const subEntry = sub ? byId.get(sub.id) : undefined

  return (
    <>
      <motion.div
        ref={ref}
        id={id}
        role="menu"
        tabIndex={-1}
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        aria-orientation="vertical"
        className={`dmenu${isSub ? ' dmenu--sub' : ''}${className ? ` ${className}` : ''}`}
        style={{ transformOrigin: isSub ? '0 12px' : '12px 0', ...style, ...(present ? null : { pointerEvents: 'none' }) }}
        onKeyDown={onKeyDown}
        onPointerEnter={onPointerEnterMenu}
        onContextMenu={(e) => e.preventDefault()}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: isSub ? 0 : -6, x: isSub ? -6 : 0 }}
        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
        exit={reduced ? { opacity: 0, transition: { duration: 0.08 } } : { opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
        transition={reduced ? { duration: 0.1 } : { type: 'spring', stiffness: 620, damping: 34, mass: 0.7 }}
      >
        {renderEntries(items)}
      </motion.div>
      <AnimatePresence>
        {sub && subEntry?.type === 'submenu' && (
          <MenuList
            key={`${sub.id}:${sub.seq}`}
            id={`${uid}-sub-${sub.seq}`}
            items={subEntry.items}
            label={subEntry.label}
            initialFocus={sub.focus}
            onClose={onClose}
            onNavigate={onNavigate ? (d) => d === 1 && onNavigate(1) : undefined}
            onBack={() => closeSub(true)}
            onPointerEnterMenu={() => window.clearTimeout(timer.current)}
            flipLeft={sub.parentLeft}
            style={{ position: 'absolute', left: sub.left, top: sub.top }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
