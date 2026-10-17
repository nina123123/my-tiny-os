import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react'
import { useEffect, useState, type FocusEvent } from 'react'
import { create } from 'zustand'
import { openProject, PROJECT_ORDER } from '../../apps/projects/shared'
import { CoverArt } from '../../components/CoverArt'
import type { Project } from '../../content/types'
import { useWindows } from '../../os/store'
import './photostack.css'

/*
 * A little pile of polaroids on the desktop, one per project (in the Projects
 * grid's order): its cover photo, or its generated cover art without one. Every few seconds the top one slides off and goes
 * to the back; clicking it opens that project. The slideshow holds still while
 * the pointer is on it, while keyboard focus is in it, while the project it
 * opened is up, while a window covers it, while the tab is hidden, and for good
 * with the pause button or reduced motion (the arrow still flips by hand).
 */

const SHOTS = PROJECT_ORDER.filter((p) => !p.placeholder)
/** ms each photo stays on top */
const EVERY = 5200

/** where each polaroid of the pile sits: 0 is on top */
const POSE = [
  { x: 0, y: 0, rotate: -2.5, scale: 1 },
  { x: 9, y: -7, rotate: 4.5, scale: 0.965 },
  { x: -8, y: -12, rotate: -7, scale: 0.93 },
]
const ENTER = { opacity: 0, x: -8, y: -16, rotate: -9, scale: 0.88 }
const LEAVE = { opacity: 0, x: 110, y: 22, rotate: 14, scale: 0.96, transition: { duration: 0.42, ease: [0.4, 0, 0.2, 1] as const } }

/** The pause button's state lives outside the component, so it survives the stack leaving and coming back (a resize) */
const usePaused = create<{ stopped: boolean }>()(() => ({ stopped: false }))

/** One polaroid. Only the top one is a live button; one sliding off is out of reach at once (inert), so it can't catch a click meant for what's under it */
function Card({ p, depth, reduced, onOpen }: { p: Project; depth: number; reduced: boolean; onOpen: (p: Project, el: HTMLElement) => void }) {
  const present = useIsPresent()
  const live = depth === 0 && present
  return (
    <motion.button
      type="button"
      className="pstack__card"
      data-top={live || undefined}
      inert={!live}
      aria-label={`Open project: ${p.title}`}
      style={{ zIndex: POSE.length - depth }}
      initial={ENTER}
      animate={{ opacity: 1, ...POSE[depth] }}
      exit={reduced ? { opacity: 0, transition: { duration: 0 } } : LEAVE}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 26 }}
      onClick={(e) => onOpen(p, e.currentTarget)}
    >
      <span className="pstack__photo">
        <CoverArt colors={p.colors} emoji={p.emoji} src={p.cover} seed={p.id} focus={p.coverFocus} sizes="240px" />
      </span>
      <span className="pstack__cap hand">
        <span>{p.title}</span>
      </span>
    </motion.button>
  )
}

export default function PhotoStack({ paused }: { paused: boolean }) {
  const reduced = !!useReducedMotion()
  const [top, setTop] = useState(0)
  const [hover, setHover] = useState(false)
  const [focusIn, setFocusIn] = useState(false)
  const stopped = usePaused((s) => s.stopped)
  // the project opened from the pile: its polaroid stays on top while that window is up, so closing it brings focus back here
  const [opened, setOpened] = useState<string | null>(null)
  const openUp = useWindows((s) => !!opened && s.windows.some((w) => w.id === `project:${opened}` && !w.minimized))
  // …and only that once: when the window is gone, the same project opened elsewhere later doesn't hold the pile
  useEffect(() => {
    if (!opened) return
    return useWindows.subscribe((s) => {
      if (!s.windows.some((w) => w.id === `project:${opened}`)) setOpened(null)
    })
  }, [opened])
  const [said, setSaid] = useState('')
  const n = SHOTS.length
  // (paused: a window covers it or the tab is hidden, see DecorLayer)
  const running = n > 1 && !reduced && !stopped && !hover && !focusIn && !openUp && !paused

  useEffect(() => {
    if (!running) return
    const t = window.setTimeout(() => setTop((i) => (i + 1) % n), EVERY)
    return () => window.clearTimeout(t)
  }, [running, top, n])

  if (!n) return null
  const pile = POSE.slice(0, Math.min(POSE.length, n)).map((_, d) => SHOTS[(top + d) % n])

  const next = () => {
    const i = (top + 1) % n
    setTop(i)
    // announced only when flipped by hand: the slideshow itself stays quiet
    setSaid(`${SHOTS[i].title}, ${i + 1} of ${n}`)
  }
  const open = (p: Project, el: HTMLElement) => {
    setOpened(p.id)
    openProject(p, el)
  }
  // Focus on the top polaroid always holds the pile (also when a closed window hands it back after a mouse
  // click), so it never slides away with focus on it. On the buttons only keyboard focus does: a mouse click
  // leaves focus there, and the pointer has its own hold.
  const onFocus = (e: FocusEvent<HTMLElement>) => setFocusIn(e.target.classList.contains('pstack__card') || e.target.matches(':focus-visible'))
  const onBlur = (e: FocusEvent<HTMLElement>) => {
    // the whole page losing focus (another app) keeps the hold: focus comes back to the same spot
    if (!e.relatedTarget && !document.hasFocus()) return
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusIn(false)
  }

  return (
    <section
      className="pstack"
      aria-label="Snapshots of my projects"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <div className="pstack__pile">
        <AnimatePresence initial={false}>
          {pile.map((p, d) => (
            <Card key={p.id} p={p} depth={d} reduced={reduced} onOpen={open} />
          ))}
        </AnimatePresence>
      </div>

      <div className="pstack__row">
        <span className="pstack__label hand" aria-hidden="true">
          my projects ✿
        </span>
        <span className="pstack__btns">
          {!reduced && n > 1 ? (
            <button
              type="button"
              className="pstack__btn"
              aria-label="Pause the photos"
              aria-pressed={stopped}
              onClick={() => usePaused.setState({ stopped: !stopped })}
            >
              {stopped ? (
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                  <path d="M5 3.2v9.6c0 .5.6.8 1 .5l7-4.8a.6.6 0 0 0 0-1L6 2.7a.6.6 0 0 0-1 .5Z" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                  <path d="M5 3.5v9M11 3.5v9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" />
                </svg>
              )}
            </button>
          ) : null}
          {n > 1 ? (
            <button type="button" className="pstack__btn" aria-label="Next photo" onClick={next}>
              <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </button>
          ) : null}
        </span>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {said}
      </p>
    </section>
  )
}
