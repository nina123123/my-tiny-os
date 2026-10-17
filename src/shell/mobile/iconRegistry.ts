import type { AppId } from '../../os/types'

/*
 * Home-screen icon buttons by app id, so a closing sheet can hand focus back
 * to the icon that opened it. (Screen rects go through os/anchors.ts.)
 */
const icons = new Map<AppId, HTMLElement>()

export function registerIcon(appId: AppId, el: HTMLElement) {
  icons.set(appId, el)
  return () => {
    if (icons.get(appId) === el) icons.delete(appId)
  }
}

export function iconFor(appId: AppId): HTMLElement | null {
  const el = icons.get(appId)
  return el && el.isConnected ? el : null
}
