import { getApp } from './apps'
import type { AppId } from './types'

/**
 * Start downloading an app's code early (e.g. on icon hover, or the project
 * chunk while the Projects grid is on screen). Safe to call repeatedly: the
 * browser caches the dynamic import, and AppHost's lazy() reuses it.
 */
export function preloadApp(appId: AppId) {
  void getApp(appId)
    .load()
    .catch(() => {
      /* offline or a stale deploy: AppHost shows its own error state on open */
    })
}
