import { useEffect } from 'react'
import { Wallpaper } from '../fx/Wallpaper'
import { AppHost } from '../os/AppHost'
import { getApp } from '../os/apps'
import { useSettings, type Mood } from '../os/settings'
import type { AppId } from '../os/types'

/*
 * Dev-only harness: renders one app alone, framed, without the shell.
 *   /?app=projects            desktop-sized glass frame
 *   /?app=about&mobile=1      390×844 phone-sheet layout
 *   &mood=night               any mood
 *   &params={"projectId":"…"} JSON params
 */
export function Harness() {
  const q = new URLSearchParams(location.search)
  const appId = q.get('app') as AppId
  const mobile = q.get('mobile') === '1'
  const mood = (q.get('mood') as Mood) || 'sunrise'
  let params: Record<string, unknown> = {}
  try {
    params = JSON.parse(q.get('params') || '{}')
  } catch {
    /* ignore */
  }
  const app = getApp(appId)

  useEffect(() => {
    useSettings.setState({ mood, booted: true })
    document.documentElement.dataset.mood = mood
  }, [mood])

  const frame = mobile
    ? { width: '100vw', height: '100vh', borderRadius: 0 }
    : { width: app.defaultSize.width, height: app.defaultSize.height, borderRadius: 'var(--r-window)' }

  return (
    <>
      <Wallpaper />
      <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', zIndex: 10 }}>
        <div
          className={app.chromeless ? undefined : 'glass'}
          style={{ ...frame, overflow: 'hidden', boxShadow: app.chromeless ? 'none' : 'var(--shadow-window-focus)', position: 'relative' }}
        >
          <AppHost appId={appId} windowId={`harness:${appId}`} params={params} isMobile={mobile} />
        </div>
      </div>
    </>
  )
}
