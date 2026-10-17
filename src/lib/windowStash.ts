import { useWindows } from '../os/store'

/*
 * A tiny per-window stash for app state that should survive the desktop ⇄ phone
 * shell swap (App.tsx renders one shell or the other, so crossing the breakpoint,
 * e.g. rotating an iPad, remounts every app) but never outlive the window itself.
 *
 *   keepForWindow(windowId, key, value)  mirror the state after each change (a no-op once the window is closed)
 *   peekStash(windowId, key)             read it back in the new shell (safe inside a useState initializer)
 *
 * Apps write on every change rather than on unmount because React renders the
 * new shell's copy of the app before the old copy's cleanup runs. Closing the
 * window clears its stash (a store subscription that only runs while something
 * is stashed), so a closed-and-reopened app starts fresh.
 */

const stash = new Map<string, unknown>()
let unsubscribe: (() => void) | null = null

const SEP = '\u0000'
const slot = (windowId: string, key: string) => `${windowId}${SEP}${key}`
const isOpen = (windowId: string) => useWindows.getState().windows.some((w) => w.id === windowId)

function watchCloses() {
  if (unsubscribe) return
  unsubscribe = useWindows.subscribe((s) => {
    const open = new Set(s.windows.map((w) => w.id))
    for (const k of stash.keys()) if (!open.has(k.slice(0, k.indexOf(SEP)))) stash.delete(k)
    if (!stash.size) {
      unsubscribe?.()
      unsubscribe = null
    }
  })
}

/** Stash `value` for this window while it is open; once it is closed, forget it instead. */
export function keepForWindow<T>(windowId: string, key: string, value: T) {
  if (!isOpen(windowId)) {
    stash.delete(slot(windowId, key))
    return
  }
  stash.set(slot(windowId, key), value)
  watchCloses()
}

export function peekStash<T>(windowId: string, key: string): T | undefined {
  return stash.get(slot(windowId, key)) as T | undefined
}
