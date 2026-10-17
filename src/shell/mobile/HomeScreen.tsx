import { useCallback, type CSSProperties, type Ref } from 'react'
import { rectOf } from '../../os/anchors'
import { APPS } from '../../os/apps'
import { useSettings } from '../../os/settings'
import { useWindows } from '../../os/store'
import type { AppId } from '../../os/types'
import { useShellUI } from '../desktop/shellStore'
import { Greeting } from './Greeting'
import { HomeIcon } from './HomeIcon'
import { Widgets } from './Widgets'

/*
 * The phone home screen: greeting card, widgets, app grid and the glass dock.
 * Rendered inside a "layer" that the sheet stack pushes back (scale + scrim)
 * while an app is open.
 */

const GRID_APPS = APPS.filter((a) => a.home && !a.homeDock)
const DOCK_APPS = APPS.filter((a) => a.home && a.homeDock)

type Props = {
  /** A sheet covers the home screen */
  covered: boolean
  jiggle: boolean
  setJiggle: (on: boolean) => void
  /** The pushable wrapper (receives --lift while a sheet is dragged) */
  wrapRef: Ref<HTMLDivElement>
  scrollRef: Ref<HTMLDivElement>
}

export function HomeScreen({ covered, jiggle, setJiggle, wrapRef, scrollRef }: Props) {
  const booted = useSettings((s) => s.booted)
  const open = useWindows((s) => s.open)
  const openPrivacy = useShellUI((s) => s.openPrivacy)

  const onOpen = useCallback(
    (appId: AppId, art: HTMLElement) => {
      setJiggle(false)
      open(appId, { origin: rectOf(art) ?? undefined })
    },
    [open, setJiggle],
  )

  const onLongPress = useCallback(() => setJiggle(true), [setJiggle])

  return (
    <div
      ref={wrapRef}
      className="mhome-wrap"
      data-pushed={covered ? 'true' : undefined}
      inert={covered}
      aria-hidden={covered || undefined}
    >
      <div
        className="mhome"
        data-mlayer
        data-booted={booted ? 'true' : undefined}
        data-jiggle={jiggle ? 'true' : undefined}
        data-paused={covered ? 'true' : undefined}
      >
        <div ref={scrollRef} className="mhome__scroll">
          <div className="mhome__inner">
            <Greeting paused={covered} />
            <Widgets />
            {GRID_APPS.length > 0 ? (
              <nav className="mhome__gridnav" aria-label="Apps">
                <ul className="mhome__grid">
                  {GRID_APPS.map((app, i) => (
                    <HomeIcon key={app.id} app={app} index={i + 3} variant="grid" onOpen={onOpen} onLongPress={onLongPress} />
                  ))}
                </ul>
              </nav>
            ) : null}
            <p className="mhome__fine" data-rise style={{ '--i': 3 + APPS.length } as CSSProperties}>
              <button type="button" className="mhome__finebtn" onClick={openPrivacy}>
                <span aria-hidden="true">🔒</span> about &amp; privacy
              </button>
            </p>
          </div>
        </div>

        <div className="mhome__dock">
          <nav className="mhome__dockbar glass" aria-label="Dock">
            <ul className="mhome__dockgrid">
              {DOCK_APPS.map((app, i) => (
                <HomeIcon
                  key={app.id}
                  app={app}
                  index={i + 3 + GRID_APPS.length}
                  variant="dock"
                  onOpen={onOpen}
                  onLongPress={onLongPress}
                />
              ))}
            </ul>
          </nav>
          <span className="mhome__indicator" aria-hidden="true" />
        </div>
      </div>
      <div className="mhome__scrim" aria-hidden="true" />
    </div>
  )
}
