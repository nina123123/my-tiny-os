import { useSyncExternalStore } from 'react'

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', cb)
    return () => mql.removeEventListener('change', cb)
  }
}

/** Reactive matchMedia. */
export function useMedia(query: string, serverFallback = false) {
  return useSyncExternalStore(
    subscribeMedia(query),
    () => window.matchMedia(query).matches,
    () => serverFallback,
  )
}

/** Phone-sized or small touch screen → mobile shell (home screen + full-screen sheets). */
export const MOBILE_QUERY = '(max-width: 767px), (pointer: coarse) and (max-width: 900px)'
export const useIsMobile = () => useMedia(MOBILE_QUERY)

export const useReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)')

/** Precise pointer (mouse/trackpad): hover effects and "click" wording */
export const useFinePointer = () => useMedia('(hover: hover) and (pointer: fine)')
