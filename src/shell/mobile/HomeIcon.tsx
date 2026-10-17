import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react'
import { AppIcon } from '../../components/AppIcon'
import { preloadApp } from '../../os/preload'
import { registerAnchor } from '../../os/anchors'
import type { AppDef, AppId } from '../../os/types'
import { isOnScreen, restRect } from './geometry'
import { registerIcon } from './iconRegistry'

/*
 * One home-screen / dock icon. Tap opens the app (zooming from the icon),
 * pressing squishes it, and a 500ms long-press starts jiggle mode.
 */

const LONG_PRESS_MS = 500
const MOVE_TOLERANCE = 10

type Props = {
  app: AppDef
  /** Position for the pop-in stagger */
  index: number
  variant: 'grid' | 'dock'
  onOpen: (appId: AppId, art: HTMLElement) => void
  onLongPress: () => void
}

export function HomeIcon({ app, index, variant, onOpen, onLongPress }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const artRef = useRef<HTMLSpanElement>(null)
  const press = useRef<{ x: number; y: number; timer: number; long: boolean } | null>(null)

  useEffect(() => {
    const art = artRef.current
    const btn = btnRef.current
    if (!art || !btn) return
    const offAnchor = registerAnchor(app.id, () => {
      const r = restRect(art)
      return isOnScreen(r) ? r : null
    })
    const offIcon = registerIcon(app.id, btn)
    return () => {
      offAnchor()
      offIcon()
    }
  }, [app.id])

  useEffect(() => () => window.clearTimeout(press.current?.timer), [])

  const setPressed = (on: boolean) => {
    const btn = btnRef.current
    if (!btn) return
    if (on) btn.dataset.pressed = 'true'
    else delete btn.dataset.pressed
  }

  const cancel = () => {
    if (press.current) window.clearTimeout(press.current.timer)
    setPressed(false)
  }

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    preloadApp(app.id)
    window.clearTimeout(press.current?.timer)
    const p = { x: e.clientX, y: e.clientY, long: false, timer: 0 }
    p.timer = window.setTimeout(() => {
      p.long = true
      setPressed(false)
      try {
        navigator.vibrate?.(12)
      } catch {
        /* not allowed here */
      }
      onLongPress()
    }, LONG_PRESS_MS)
    press.current = p
    setPressed(true)
  }

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const p = press.current
    if (!p || p.long) return
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_TOLERANCE) {
      cancel()
      press.current = null
    }
  }

  const onClick = () => {
    const p = press.current
    press.current = null
    if (p?.long) return // the long-press already did its thing
    const art = artRef.current
    if (art) onOpen(app.id, art)
  }

  return (
    <li className="mhome__cell" data-variant={variant}>
      <button
        ref={btnRef}
        type="button"
        className="mhome__app"
        data-pop
        style={{ '--i': index, '--jd': `${-((index * 137) % 300)}ms` } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={cancel}
        onPointerCancel={() => {
          cancel()
          press.current = null
        }}
        onPointerLeave={cancel}
        onContextMenu={(e) => e.preventDefault()}
        onClick={onClick}
      >
        <span className="mhome__wiggle">
          <span ref={artRef} className="mhome__art">
            <AppIcon appId={app.id} size={60} />
          </span>
          <span className="mhome__label">{app.name}</span>
        </span>
      </button>
    </li>
  )
}
