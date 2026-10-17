import { MOOD_TEXT } from '../../content/moods'
import { animate, AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Logo } from '../../components/Logo'
import { OsWordmark } from '../../components/OsName'
import { osName } from '../../content/profile'
import { MOODS, useSettings } from '../../os/settings'
import { useReducedMotion } from '../../os/useMedia'

/*
 * The phone status bar: clock · logo wordmark (a tap scrolls back to the top) ·
 * the mood toggle + a battery that is always full of good vibes.
 */

const MOOD_META = MOOD_TEXT

function formatTime(d: Date) {
  const h = d.getHours() % 12 || 12
  return `${h}:${String(d.getMinutes()).padStart(2, '0')}`
}

function useMinuteClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let interval = 0
    // Align to the next minute boundary, then tick every minute.
    const timeout = window.setTimeout(
      () => {
        setNow(new Date())
        interval = window.setInterval(() => setNow(new Date()), 60_000)
      },
      60_000 - (Date.now() % 60_000) + 50,
    )
    const onVisible = () => document.visibilityState === 'visible' && setNow(new Date())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return now
}

type Props = {
  /** Tapping the wordmark once (e.g. scroll the home screen to the top) */
  onBrandTap?: () => void
  /** Jiggle mode: the wordmark morphs into a "done" pill */
  jiggle?: boolean
  onJiggleDone?: () => void
}

export function StatusBar({ onBrandTap, jiggle = false, onJiggleDone }: Props) {
  const now = useMinuteClock()
  const mood = useSettings((s) => s.mood)
  const cycleMood = useSettings((s) => s.cycleMood)
  const reduced = useReducedMotion()
  const logoRef = useRef<HTMLSpanElement>(null)

  const next = MOODS[(MOODS.indexOf(mood) + 1) % MOODS.length]
  const meta = MOOD_META[mood]

  const onBrand = () => {
    const el = logoRef.current
    if (el && !reduced) animate(el, { scale: [1, 0.78, 1.08, 1] }, { duration: 0.42, ease: 'easeOut' })
    onBrandTap?.()
  }

  return (
    <div className="mstatus">
      <time className="mstatus__time" dateTime={now.toISOString()}>
        {formatTime(now)}
      </time>

      <div className="mstatus__center">
        <AnimatePresence mode="popLayout" initial={false}>
          {jiggle ? (
            <motion.button
              key="done"
              type="button"
              className="mstatus__done"
              onClick={onJiggleDone}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: 'blur(4px)' }}
              transition={reduced ? { duration: 0.12 } : { type: 'spring', stiffness: 520, damping: 26 }}
            >
              <span className="mstatus__donepill">
                <span aria-hidden="true">✨</span> done
              </span>
            </motion.button>
          ) : (
            <motion.button
              key="brand"
              type="button"
              className="mstatus__brand"
              onClick={onBrand}
              aria-label={osName}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
              transition={reduced ? { duration: 0.12 } : { type: 'spring', stiffness: 520, damping: 28 }}
            >
              <span ref={logoRef} className="mstatus__logo">
                <Logo size={18} />
              </span>
              <span className="mstatus__word" aria-hidden="true">
                <OsWordmark />
              </span>
            </motion.button>
          )}
        </AnimatePresence>
        <span className="sr-only" role="status">
          {jiggle ? 'Jiggle mode on. Tap done to stop.' : ''}
        </span>
      </div>

      <div className="mstatus__right">
        <button
          type="button"
          className="mstatus__mood"
          onClick={cycleMood}
          aria-label={`Mood: ${meta.label}. Switch to ${MOOD_META[next].label}`}
        >
          <span className="mstatus__moodchip" aria-hidden="true">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={mood}
                className="mstatus__moodemoji"
                initial={reduced ? { opacity: 0 } : { opacity: 0, rotate: -120, scale: 0.3 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, rotate: 120, scale: 0.3 }}
                transition={reduced ? { duration: 0.12 } : { type: 'spring', stiffness: 420, damping: 20 }}
              >
                {meta.emoji}
              </motion.span>
            </AnimatePresence>
          </span>
        </button>
        <span className="mstatus__battery" role="img" aria-label="Battery 100%, fully charged on good vibes">
          <span className="mstatus__pct" aria-hidden="true">
            100%
          </span>
          <span className="mstatus__cell" aria-hidden="true">
            <span className="mstatus__fill" />
          </span>
        </span>
      </div>
    </div>
  )
}
