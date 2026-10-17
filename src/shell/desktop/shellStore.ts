import { create } from 'zustand'

/*
 * Shell UI state that several shell parts share: the menu bar and the desktop
 * context menu can both open "About {osName}", and the menu bar's "Privacy" item
 * and the phone home screen's "about & privacy" link open it at its privacy note.
 */
type ShellUI = {
  aboutOpen: boolean
  /** The About dialog opens with its privacy note unfolded and in view */
  aboutPrivacy: boolean
  openAbout: () => void
  openPrivacy: () => void
  closeAbout: () => void
}

export const useShellUI = create<ShellUI>()((set) => ({
  aboutOpen: false,
  aboutPrivacy: false,
  openAbout: () => set({ aboutOpen: true, aboutPrivacy: false }),
  openPrivacy: () => set({ aboutOpen: true, aboutPrivacy: true }),
  closeAbout: () => set({ aboutOpen: false }),
}))

/*
 * Dock tiles for minimized windows whose app has no dock icon of its own
 * (e.g. a single project window). WindowFrame reads these to know where to
 * fly when minimizing. Keyed by window id; registered via ref callbacks.
 */
const tiles = new Map<string, HTMLElement>()

export function registerDockTile(windowId: string, el: HTMLElement | null) {
  if (el) tiles.set(windowId, el)
  else tiles.delete(windowId)
}

export function getDockTile(windowId: string): HTMLElement | null {
  const el = tiles.get(windowId)
  return el && el.isConnected ? el : null
}
