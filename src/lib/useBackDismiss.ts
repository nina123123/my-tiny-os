import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useIsMobile } from '../os/useMedia'

/*
 * Phone back gesture ↔ an in-app overlay (the photo Lightbox).
 *
 * On the phone layout, browser back closes the top sheet (see
 * shell/mobile/useSheetHistory). While an overlay is open it owns one extra
 * history entry: a copy of the current state plus our own key. The sheet
 * history only reads its depth key, which the copy keeps, so it treats that
 * entry as "same sheets" and ignores the pop. Back then closes the overlay
 * instead of the whole sheet.
 *
 * Mount it with the overlay (it's on for the component's lifetime) and use the
 * returned function for every in-app close (×, Esc, scrim): it closes and also
 * drops the extra entry, so the next back closes the sheet as usual.
 * If the sheet itself closes while the overlay is open, the sheet history
 * already walks back over our entry, so unmounting leaves history alone.
 * Desktop windows don't use history, so there it's a plain pass-through.
 */

const KEY = '__tinyosOverlay'
let seq = 0

export function useBackDismiss(onClose: () => void, enabled = true): () => void {
  const isMobile = useIsMobile()
  const on = enabled && isMobile
  const onCloseRef = useRef(onClose)
  const token = useRef(0)
  const pushed = useRef(false)

  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!on) return
    if (!token.current) token.current = ++seq
    const mine = (s: unknown) => !!s && typeof s === 'object' && (s as Record<string, unknown>)[KEY] === token.current
    // StrictMode re-runs effects: our entry may already be the current one
    if (!mine(history.state)) {
      try {
        const base = history.state && typeof history.state === 'object' ? (history.state as Record<string, unknown>) : {}
        history.pushState({ ...base, [KEY]: token.current }, '')
      } catch {
        return // e.g. sandboxed iframes: the in-app close still works
      }
    }
    pushed.current = true
    const onPop = (e: PopStateEvent) => {
      if (!pushed.current || mine(e.state)) return
      pushed.current = false
      onCloseRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [on])

  return useCallback(() => {
    if (pushed.current) {
      pushed.current = false
      history.back()
    }
    onCloseRef.current()
  }, [])
}
