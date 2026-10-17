import { useEffect } from 'react'
import { useWindows } from '../../os/store'
import type { WindowState } from '../../os/types'

/*
 * Browser back ↔ sheet stack.
 *
 * Invariant: the current history entry's depth (our key in history.state,
 * 0 for any entry we didn't make) equals the number of open sheets.
 *   - a sheet opens          → pushState one entry per new sheet (same URL)
 *   - a sheet closes in-app  → history.go(-n) to drop our entries again
 *   - the visitor hits back  → popstate lands on a shallower entry → close top sheets
 *   - forward into an entry whose sheet is gone → step back again
 * Our own history.go() calls also fire popstate; those are counted in
 * `expectedPops` (module-level, so StrictMode's double effects agree) and ignored.
 * When the phone shell goes away (e.g. a tablet rotates into the desktop layout),
 * our entries are dropped again so Back keeps meaning "leave the page" there.
 */

const KEY = '__tinyosSheets'
let expectedPops = 0
let expectTimer = 0
let applyingPop = false
let mounted = false
let dropTimer = 0

function depthOf(state: unknown): number {
  if (state && typeof state === 'object' && KEY in state) {
    const d = (state as Record<string, unknown>)[KEY]
    return typeof d === 'number' && d > 0 ? Math.floor(d) : 0
  }
  return 0
}

function openSheets(): WindowState[] {
  return useWindows
    .getState()
    .windows.filter((w) => !w.minimized)
    .sort((a, b) => a.z - b.z)
}

function expectPop() {
  expectedPops++
  // Safety net: if a traversal never reports back, don't stay deaf forever.
  window.clearTimeout(expectTimer)
  expectTimer = window.setTimeout(() => {
    expectedPops = 0
    sync()
  }, 1500)
}

function sync() {
  // (the expectPop safety timer can fire after unmount: don't push entries for a shell that's gone)
  if (!mounted || expectedPops > 0 || applyingPop) return
  const want = openSheets().length
  const have = depthOf(history.state)
  if (want > have) {
    const base = history.state && typeof history.state === 'object' ? (history.state as Record<string, unknown>) : {}
    for (let d = have + 1; d <= want; d++) {
      try {
        history.pushState({ ...base, [KEY]: d }, '')
      } catch {
        return // e.g. sandboxed iframes; the in-app back button still works
      }
    }
  } else if (want < have) {
    expectPop()
    history.go(want - have)
  }
}

function onPopState(e: PopStateEvent) {
  if (expectedPops > 0) {
    expectedPops--
    if (expectedPops === 0) window.clearTimeout(expectTimer)
    sync()
    return
  }
  const depth = depthOf(e.state)
  const sheets = openSheets()
  if (depth < sheets.length) {
    // Back: close the sheets above this entry, top first.
    const { close } = useWindows.getState()
    applyingPop = true
    try {
      for (const w of sheets.slice(depth).reverse()) close(w.id)
    } finally {
      applyingPop = false
    }
  }
  sync()
}

/** Keeps browser history in step with the mobile sheet stack. Mount once. */
export function useSheetHistory() {
  useEffect(() => {
    mounted = true
    window.clearTimeout(dropTimer)
    window.addEventListener('popstate', onPopState)
    const unsub = useWindows.subscribe((s, prev) => {
      if (s.windows === prev.windows) return
      const count = (ws: WindowState[]) => ws.reduce((n, w) => n + (w.minimized ? 0 : 1), 0)
      if (count(s.windows) !== count(prev.windows)) sync()
    })
    sync()
    return () => {
      mounted = false
      expectedPops = 0
      window.clearTimeout(expectTimer)
      window.removeEventListener('popstate', onPopState)
      unsub()
      // Deferred, so StrictMode's unmount + remount is a no-op.
      dropTimer = window.setTimeout(() => {
        if (mounted) return
        const d = depthOf(history.state)
        if (d > 0) history.go(-d)
      }, 0)
    }
  }, [])
}
