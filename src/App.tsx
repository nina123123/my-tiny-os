import { useCallback, useEffect } from 'react'
import { osName } from './content/profile'
import { Toaster } from './fx/Toaster'
import { Wallpaper } from './fx/Wallpaper'
import { useSettings } from './os/settings'
import { openApp } from './os/store'
import { useIsMobile } from './os/useMedia'
import { BootScreen } from './shell/boot/BootScreen'
import { DesktopShell } from './shell/desktop/DesktopShell'
import { MobileShell } from './shell/mobile/MobileShell'

export default function App() {
  const isMobile = useIsMobile()
  const mood = useSettings((s) => s.mood)
  const booted = useSettings((s) => s.booted)
  const setBooted = useSettings((s) => s.setBooted)

  // the tab title follows profile.ts (index.html's <title> is only what link previews and crawlers see)
  useEffect(() => {
    document.title = osName
  }, [])

  useEffect(() => {
    document.documentElement.dataset.mood = mood
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', mood === 'night' ? '#1a1230' : mood === 'sunset' ? '#ffd9e8' : '#efe6ff')
  }, [mood])

  const onBootDone = useCallback(() => {
    setBooted()
    // Desktop greets visitors with the welcome card; mobile shows its home-screen widget instead.
    if (!window.matchMedia('(max-width: 767px), (pointer: coarse) and (max-width: 900px)').matches) {
      openApp('welcome')
    }
  }, [setBooted])

  // ?skipboot skips the boot animation (handy for screenshots and returning visitors' deep links)
  useEffect(() => {
    if (!useSettings.getState().booted && new URLSearchParams(location.search).has('skipboot')) onBootDone()
  }, [onBootDone])

  return (
    <>
      <Wallpaper />
      <main className="os" aria-label={osName} inert={!booted}>
        {isMobile ? <MobileShell /> : <DesktopShell />}
      </main>
      <Toaster />
      {!booted && <BootScreen onDone={onBootDone} />}
    </>
  )
}
