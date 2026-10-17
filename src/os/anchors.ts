import type { AppId, Rect } from './types'

/*
 * Screen positions of dock / home-screen icons, registered by the shell so
 * windows can animate *into* the dock when minimized and *out of* an icon
 * when opened. Non-reactive on purpose (read at animation time).
 */

const anchors = new Map<AppId, () => Rect | null>()

/** Register a getter for an app icon's current screen rect. Returns an unregister fn. */
export function registerAnchor(appId: AppId, get: () => Rect | null) {
  anchors.set(appId, get)
  return () => {
    if (anchors.get(appId) === get) anchors.delete(appId)
  }
}

export function getAnchor(appId: AppId): Rect | null {
  return anchors.get(appId)?.() ?? null
}

export function rectOf(el: Element | null): Rect | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, width: r.width, height: r.height }
}
