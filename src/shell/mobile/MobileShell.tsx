import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWindows } from '../../os/store'
import { useReducedMotion } from '../../os/useMedia'
import { AboutDialog } from '../desktop/AboutDialog'
import { HomeScreen } from './HomeScreen'
import { SheetStack } from './SheetStack'
import { StatusBar } from './StatusBar'
import { useSheetHistory } from './useSheetHistory'
import './mobile.css'

/** The first scrolled-down scroll container inside a sheet's app (document order, so the app's main scroller wins). */
function sheetScroller(sheet: HTMLElement | undefined): HTMLElement | null {
  const body = sheet?.querySelector('.msheet__body')
  if (!body) return null
  for (const el of body.querySelectorAll<HTMLElement>('*')) {
    if (el.scrollTop <= 0 || el.scrollHeight <= el.clientHeight) continue
    const oy = getComputedStyle(el).overflowY
    if (oy === 'auto' || oy === 'scroll') return el
  }
  return null
}

/*
 * The OS on a phone: a status bar, a home screen (greeting, widgets, app
 * grid, dock) and the open apps as a stack of full-screen sheets.
 * Sheets come from the shared window store (non-minimized windows, by z).
 */
export function MobileShell() {
  const windows = useWindows((s) => s.windows)
  const sheets = useMemo(() => windows.filter((w) => !w.minimized).sort((a, b) => a.z - b.z), [windows])
  const covered = sheets.length > 0
  const [jiggle, setJiggleState] = useState(false)
  const homeWrap = useRef<HTMLDivElement>(null)
  const homeScroll = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useSheetHistory()

  const setJiggle = useCallback((on: boolean) => setJiggleState(on), [])
  const getHomeLayer = useCallback(() => homeWrap.current, [])

  // Jiggle mode ends with any tap outside an icon (taps on icons open the app), Escape, or an open sheet.
  const jiggling = jiggle && !covered
  useEffect(() => {
    if (!jiggling) return
    const onClick = (e: MouseEvent) => {
      const t = e.target instanceof Element ? e.target : null
      if (!t?.closest('.mhome__app, .mstatus__done')) setJiggleState(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setJiggleState(false)
    document.addEventListener('click', onClick, true)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [jiggling])

  // Tapping the status bar scrolls whatever is in front back to the top, like a phone
  // does: the top sheet's own scroller (apps scroll inside, out of the native
  // gesture's reach), or the home screen.
  const scrollToTop = useCallback(() => {
    const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth'
    if (useWindows.getState().windows.some((w) => !w.minimized)) {
      const sheet = [...document.querySelectorAll<HTMLElement>('.mshell .msheet:not([data-leaving])')].pop()
      sheetScroller(sheet)?.scrollTo({ top: 0, behavior })
      return
    }
    homeScroll.current?.scrollTo({ top: 0, behavior })
  }, [reduced])

  return (
    <div className="mshell">
      {/* First in DOM for keyboard order; stacked above everything via z-index. */}
      <StatusBar onBrandTap={scrollToTop} jiggle={jiggling} onJiggleDone={() => setJiggleState(false)} />
      <HomeScreen covered={covered} jiggle={jiggling} setJiggle={setJiggle} wrapRef={homeWrap} scrollRef={homeScroll} />
      <SheetStack sheets={sheets} getHomeLayer={getHomeLayer} />
      {/* About this OS + the privacy note, opened from the home screen's "about & privacy" link */}
      <AboutDialog />
    </div>
  )
}
