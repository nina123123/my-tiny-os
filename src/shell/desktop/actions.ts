import { MOOD_TEXT } from '../../content/moods'
import { notify } from '../../os/notify'
import { useSettings, type Mood } from '../../os/settings'
import { useWindows } from '../../os/store'
import type { AppId, Rect } from '../../os/types'

/** Copy the current address so visitors can send the site to a friend. */
export async function copyLink() {
  const href = window.location.href
  let ok = false
  try {
    await navigator.clipboard.writeText(href)
    ok = true
  } catch {
    // Older browsers / insecure contexts: fall back to a hidden textarea.
    try {
      const ta = document.createElement('textarea')
      ta.value = href
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      ok = document.execCommand('copy')
      ta.remove()
    } catch {
      ok = false
    }
  }
  if (ok) notify({ icon: '🔗', title: 'link copied!', body: 'send it to a friend 💌' })
  else notify({ icon: '🔗', title: "couldn't copy the link", body: href })
}

/** Close everything and replay the boot screen. */
export function restartOS() {
  useWindows.getState().closeAll()
  useSettings.setState({ booted: false })
}

export function openFrom(appId: AppId, origin?: Rect | null) {
  return useWindows.getState().open(appId, origin ? { origin } : undefined)
}

/** Move keyboard focus into a window (after it has been focused / restored). */
export function focusWindowEl(windowId: string) {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`[data-window-id="${CSS.escape(windowId)}"]`)
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true })
  })
}

/** each mood's emoji, from src/content/moods.ts */
export const MOOD_GLYPH = Object.fromEntries(
  Object.entries(MOOD_TEXT).map(([m, t]) => [m, t.emoji]),
) as Record<Mood, string>
