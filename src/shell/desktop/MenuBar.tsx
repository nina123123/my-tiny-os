import { MOOD_MENU, MOOD_TEXT } from '../../content/moods'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Logo } from '../../components/Logo'
import { osName, profile } from '../../content/profile'
import { MOODS, useSettings } from '../../os/settings'
import { isAppOn } from '../../os/apps'
import { useWindows } from '../../os/store'
import type { AppId } from '../../os/types'
import { useReducedMotion } from '../../os/useMedia'
import { copyLink, MOOD_GLYPH, restartOS } from './actions'
import { BatteryGlyph } from './Glyphs'
import { useMinuteClock } from './hooks'
import { MenuList, type MenuCloseReason, type MenuEntry } from './Menu'
import { useShellUI } from './shellStore'
import './menubar.css'

type TopMenu = { id: string; label: string; items: MenuEntry[] }

export function MenuBar() {
  const uid = useId()
  const mood = useSettings((s) => s.mood)
  const focusedId = useWindows((s) => s.focusedId)
  const openAbout = useShellUI((s) => s.openAbout)
  const openPrivacy = useShellUI((s) => s.openPrivacy)

  const open = (appId: AppId) => useWindows.getState().open(appId)

  const menus: TopMenu[] = [
    {
      id: 'os',
      label: osName,
      items: [
        { type: 'item', id: 'about', label: `About ${osName}`, icon: '✨', onSelect: openAbout },
        { type: 'item', id: 'privacy', label: 'Privacy', icon: '🔒', onSelect: openPrivacy },
        { type: 'separator', id: 's1' },
        { type: 'item', id: 'restart', label: 'Restart…', icon: '🌅', onSelect: restartOS },
      ],
    },
    {
      id: 'file',
      label: 'File',
      items: [
        { type: 'item', id: 'projects', label: 'Open Projects', icon: '🗂️', onSelect: () => open('projects') },
        ...(isAppOn('guestbook')
          ? [{ type: 'item' as const, id: 'guestbook', label: 'Open Guestbook', icon: '💌', onSelect: () => open('guestbook') }]
          : []),
        { type: 'separator', id: 's1' },
        {
          type: 'item',
          id: 'close',
          label: 'Close Window',
          icon: '✕',
          disabled: !focusedId,
          onSelect: () => {
            const id = useWindows.getState().focusedId
            if (id) useWindows.getState().close(id)
          },
        },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { type: 'item', id: 'undo', label: 'Undo', icon: '↩︎', hint: "can't undo being awesome", disabled: true, onSelect: () => {} },
        { type: 'separator', id: 's1' },
        { type: 'item', id: 'copy', label: `Copy link to ${osName}`, icon: '🔗', onSelect: () => void copyLink() },
      ],
    },
    {
      id: 'vibes',
      label: MOOD_MENU,
      items: [
        {
          type: 'group',
          id: 'mood',
          label: 'pick a vibe',
          items: MOODS.map((m) => ({
            type: 'radio' as const,
            id: `mood-${m}`,
            label: MOOD_TEXT[m].label,
            icon: MOOD_GLYPH[m],
            checked: mood === m,
            onSelect: () => useSettings.getState().setMood(m),
          })),
        },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { type: 'item', id: 'how', label: `How to use ${osName}`, icon: '🧭', onSelect: () => open('welcome') },
        ...(isAppOn('contact')
          ? [{ type: 'item' as const, id: 'contact', label: `Say hi to ${profile.firstName}`, icon: '✉️', onSelect: () => open('contact') }]
          : []),
      ],
    },
  ]

  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [focusMode, setFocusMode] = useState<'first' | 'last' | 'menu'>('menu')
  const [rove, setRove] = useState(0)
  // bumps on every fresh open so a dropdown that's still fading out is never revived with stale focus
  const [seq, setSeq] = useState(0)
  const triggers = useRef<(HTMLButtonElement | null)[]>([])
  const rootRef = useRef<HTMLDivElement>(null)

  const openMenu = (i: number, mode: 'first' | 'last' | 'menu') => {
    if (openIdx !== i) setSeq((n) => n + 1)
    setRove(i)
    setFocusMode(mode)
    setOpenIdx(i)
  }

  const closeMenu = (reason: MenuCloseReason | 'outside') => {
    const i = openIdx
    setOpenIdx(null)
    if (reason !== 'outside' && i !== null) triggers.current[i]?.focus({ preventScroll: true })
  }

  // click outside / window blur closes
  useEffect(() => {
    if (openIdx === null) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenIdx(null)
    }
    const onBlur = () => setOpenIdx(null)
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [openIdx])

  const n = menus.length
  const focusTrigger = (i: number) => {
    const k = ((i % n) + n) % n
    setRove(k)
    triggers.current[k]?.focus({ preventScroll: true })
  }

  const onTriggerKey = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    switch (e.key) {
      case 'ArrowRight':
        focusTrigger(i + 1)
        break
      case 'ArrowLeft':
        focusTrigger(i - 1)
        break
      case 'Home':
        focusTrigger(0)
        break
      case 'End':
        focusTrigger(n - 1)
        break
      case 'Enter':
      case ' ':
        openMenu(i, 'first')
        break
      case 'ArrowDown':
        openMenu(i, 'first')
        break
      case 'ArrowUp':
        openMenu(i, 'last')
        break
      case 'Escape':
        if (openIdx !== null) closeMenu('escape')
        else return
        break
      default:
        return
    }
    e.preventDefault()
  }

  const onTriggerClick = (i: number) => {
    if (openIdx === i) setOpenIdx(null)
    else openMenu(i, 'menu')
  }

  return (
    <header className="mbar" data-open={openIdx !== null || undefined}>
      <div className="mbar__bg" aria-hidden="true" />
      <div ref={rootRef} className="mbar__left" role="menubar" aria-label={`${osName} menu bar`}>
        {menus.map((m, i) => {
          const isLogo = i === 0
          const expanded = openIdx === i
          return (
            <div key={m.id} className="mbar__slot">
              <button
                ref={(el) => {
                  triggers.current[i] = el
                }}
                id={`${uid}-${m.id}`}
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={expanded}
                aria-controls={expanded ? `${uid}-${m.id}-menu` : undefined}
                aria-label={isLogo ? osName : undefined}
                tabIndex={rove === i ? 0 : -1}
                className={`mbar__trigger${isLogo ? ' mbar__trigger--logo' : ''}`}
                onClick={() => onTriggerClick(i)}
                onKeyDown={onTriggerKey(i)}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'mouse' && openIdx !== null && openIdx !== i) openMenu(i, 'menu')
                }}
                onFocus={() => setRove(i)}
              >
                {isLogo ? (
                  <span className="mbar__logo">
                    <Logo size={18} />
                  </span>
                ) : (
                  m.label
                )}
              </button>
              {isLogo && (
                <span className="mbar__brand" aria-hidden="true">
                  {osName}
                </span>
              )}
              <AnimatePresence>
                {expanded && (
                  <div key={`drop-${seq}`} className="mbar__drop">
                    <MenuList
                      id={`${uid}-${m.id}-menu`}
                      labelledBy={`${uid}-${m.id}`}
                      items={m.items}
                      initialFocus={focusMode}
                      onClose={closeMenu}
                      onNavigate={(d) => {
                        const k = (((openIdx ?? i) + d) % n + n) % n
                        openMenu(k, 'first')
                      }}
                    />
                  </div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      <StatusArea />
    </header>
  )
}

function StatusArea() {
  const mood = useSettings((s) => s.mood)
  const reduced = useReducedMotion()
  const now = useMinuteClock()

  const day = now.toLocaleDateString('en-US', { weekday: 'short' })
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const [hm, ampm] = time.split(' ')
  const next = MOODS[(MOODS.indexOf(mood) + 1) % MOODS.length]

  return (
    <div className="mbar__right">
      <button
        type="button"
        className="mbar__icon-btn mbar__mood"
        onClick={() => useSettings.getState().cycleMood()}
        aria-label={`Vibe: ${mood}. Switch to ${next}`}
        title={`switch to ${next}`}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={mood}
            className="mbar__mood-glyph"
            aria-hidden="true"
            initial={reduced ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.4, y: 6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.4, y: -6 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          >
            {MOOD_GLYPH[mood]}
          </motion.span>
        </AnimatePresence>
      </button>
      <span className="mbar__battery">
        <BatteryGlyph />
        <span>100% energy</span>
        <span aria-hidden="true">⚡</span>
      </span>
      <time className="mbar__clock" dateTime={now.toISOString()}>
        {day} {hm}
        <span className="mbar__ampm">{ampm?.toLowerCase()}</span>
      </time>
    </div>
  )
}
