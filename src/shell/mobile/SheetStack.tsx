import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useWindows } from '../../os/store'
import type { WindowState } from '../../os/types'
import { AppSheet } from './AppSheet'
import { iconFor } from './iconRegistry'

/*
 * The open apps as a stack of sheets (ordered by z). Owns focus: a new top
 * sheet gets its heading focused; when one closes, focus goes back to what
 * opened it (or its home icon). Escape closes the top sheet.
 */

type Props = {
  sheets: WindowState[]
  getHomeLayer: () => HTMLElement | null
}

const focusQuietly = (el: Element | null | undefined) => {
  if (el instanceof HTMLElement) el.focus({ preventScroll: true })
}

const TEXT_INPUTS = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number'])

/** A text field with something typed in it. */
function hasDraft(t: EventTarget | null) {
  if (t instanceof HTMLTextAreaElement) return t.value !== ''
  if (t instanceof HTMLInputElement) return TEXT_INPUTS.has(t.type) && t.value !== ''
  return t instanceof HTMLElement && t.isContentEditable && !!t.textContent
}

export function SheetStack({ sheets, getHomeLayer }: Props) {
  const close = useWindows((s) => s.close)
  const layers = useRef(new Map<string, HTMLElement>())
  const headings = useRef(new Map<string, HTMLElement>())
  const openedFrom = useRef(new Map<string, Element | null>())
  const prev = useRef<WindowState[]>([])
  // Windows that were already open when the phone shell mounted (e.g. resized from
  // desktop) appear in place instead of zooming in from stale desktop icon rects.
  const [preexisting] = useState(() => new Set(sheets.map((s) => s.id)))

  const registerLayer = useCallback((id: string, el: HTMLElement | null) => {
    if (el) layers.current.set(id, el)
    else layers.current.delete(id)
  }, [])
  const registerHeading = useCallback((id: string, el: HTMLElement | null) => {
    if (el) headings.current.set(id, el)
    else headings.current.delete(id)
  }, [])

  // Remember what opened each sheet while it still has focus: the store notifies
  // synchronously inside open(), before React renders the new sheet and makes
  // the home screen (or the sheet underneath) inert, which blurs the opener.
  useEffect(
    () =>
      useWindows.subscribe((st, prevSt) => {
        if (st.windows === prevSt.windows) return
        for (const w of st.windows) {
          if (w.minimized) continue
          const was = prevSt.windows.find((p) => p.id === w.id)
          if (!was || was.minimized) openedFrom.current.set(w.id, document.activeElement)
        }
      }),
    [],
  )

  // Focus management on stack changes.
  useEffect(() => {
    const before = prev.current
    prev.current = sheets
    const ids = new Set(sheets.map((s) => s.id))
    const beforeIds = new Set(before.map((s) => s.id))
    const top = sheets[sheets.length - 1]
    const prevTop = before[before.length - 1]

    for (const s of sheets) {
      // Fallback for sheets the store listener didn't see (e.g. open when the shell mounted).
      if (!beforeIds.has(s.id) && !openedFrom.current.has(s.id)) openedFrom.current.set(s.id, document.activeElement)
    }
    const removed = before.filter((s) => !ids.has(s.id))
    // A sheet opened from inside one that is now gone ("next project →" swaps the
    // top sheet for the next one) inherits that sheet's opener, so closing it
    // later returns focus to the tile the first one came from.
    for (const r of removed) {
      const layer = layers.current.get(r.id)
      if (!layer) continue
      for (const s of sheets) {
        const from = openedFrom.current.get(s.id)
        if (from && layer.contains(from)) openedFrom.current.set(s.id, openedFrom.current.get(r.id) ?? null)
      }
    }

    if (top && top.id !== prevTop?.id && !removed.some((r) => r.id === prevTop?.id)) {
      // A sheet came to the top (opened or re-opened): focus its heading once painted.
      const raf = requestAnimationFrame(() => focusQuietly(headings.current.get(top.id)))
      return () => cancelAnimationFrame(raf)
    }

    const closed = removed.find((r) => r.id === prevTop?.id) ?? removed[removed.length - 1]
    if (!closed) return
    const back = openedFrom.current.get(closed.id)
    for (const r of removed) openedFrom.current.delete(r.id)
    const container = top ? layers.current.get(top.id) : getHomeLayer()
    const backOk = back instanceof HTMLElement && back.isConnected && back !== document.body && !!container?.contains(back)
    if (backOk) focusQuietly(back)
    else if (!top) focusQuietly(iconFor(closed.appId))
    else focusQuietly(headings.current.get(top.id))
  }, [sheets, getHomeLayer])

  // Escape closes the top sheet. In a text field with something typed, the first
  // Escape only leaves the field (so a draft isn't thrown away); the next one closes.
  useEffect(() => {
    if (!sheets.length) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing || e.keyCode === 229) return
      const top = sheets[sheets.length - 1]
      if (!top) return
      if (hasDraft(e.target)) {
        // Step out to the sheet's heading (still inside the sheet), keeping the text.
        const heading = headings.current.get(top.id)
        if (heading) focusQuietly(heading)
        else (e.target as HTMLElement).blur()
        return
      }
      close(top.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheets, close])

  return (
    <AnimatePresence>
      {sheets.map((w, i) => (
        <AppSheet
          key={w.id}
          win={w}
          index={i}
          isTop={i === sheets.length - 1}
          underTitle={i > 0 ? sheets[i - 1].title : undefined}
          getUnder={() => (i === 0 ? getHomeLayer() : (layers.current.get(sheets[i - 1].id) ?? null))}
          registerLayer={registerLayer}
          registerHeading={registerHeading}
          onClose={close}
          animateIn={!preexisting.has(w.id)}
        />
      ))}
    </AnimatePresence>
  )
}
