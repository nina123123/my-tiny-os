import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { splitOsName } from '../../lib/osName'
import { osName, profile } from '../../content/profile'
import { preloadApp } from '../../os/preload'
import { useSettings } from '../../os/settings'
import { useFinePointer, useIsMobile, useReducedMotion } from '../../os/useMedia'
import './boot.css'

/*
 * The boot screen: a little sunrise.
 *
 *   the dawn sky brightens → the sun rises over the horizon (with a soft
 *   reflection) → the OS's name (osName) floats in letter by letter, then a coral shimmer
 *   wave runs across it → a progress pill cycles playful messages → the
 *   whole scene zooms softly away to reveal the OS.
 *
 * ~2.6s the first time, ~1.2s once `seenBoot` is persisted, a plain 500ms
 * fade with reduced motion. Click / tap / Enter / Space / Escape skips.
 * onDone() is called exactly once (guarded against StrictMode re-runs).
 */

const FIRST_MESSAGES = ['waking up the pixels…', 'brewing big ideas…', 'charging good vibes to 100%…', 'fluffing the clouds…']

const MORE_MESSAGES = [
  'connecting the dots…',
  'warming up the sunrise…',
  'polishing the glass…',
  'stacking the projects…',
  'tidying the desktop (kind of)…',
]

/** The wordmark's letters; the trailing "OS" (if any) gets its own style, see .boot__ch--os */
const { head: WORD_HEAD, tail: WORD_TAIL } = splitOsName()
const WORD = [...WORD_HEAD, ...WORD_TAIL]
const RAYS = Array.from({ length: 12 }, (_, i) => i * 30)

type Plan = {
  total: number
  exitAt: number
  exitDur: number
  messages: string[]
  /** timeline multiplier for the entrance choreography */
  k: number
}

function makePlan(seen: boolean, reduced: boolean): Plan {
  if (reduced) return { total: 750, exitAt: 250, exitDur: 500, messages: [FIRST_MESSAGES[0]], k: 0 }
  if (seen) {
    const pool = [...FIRST_MESSAGES, ...MORE_MESSAGES]
    const a = Math.floor(Math.random() * pool.length)
    const b = (a + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length
    return { total: 1200, exitAt: 820, exitDur: 380, messages: [pool[a], pool[b]], k: 0.46 }
  }
  return { total: 2600, exitAt: 2080, exitDur: 520, messages: FIRST_MESSAGES, k: 1 }
}

export function BootScreen({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion()
  const fine = useFinePointer()
  const isMobile = useIsMobile()
  // decided once at mount: the boot shouldn't change shape halfway through
  const [plan] = useState(() => makePlan(useSettings.getState().seenBoot, reduced))
  const [msg, setMsg] = useState(0)
  const [exiting, setExiting] = useState(false)

  const progress = useMotionValue(plan.k === 0 ? 1 : 0.02)
  const fillX = useTransform(progress, (v) => `${(v - 1) * 100}%`)
  const onDoneRef = useRef(onDone)
  const doneRef = useRef(false)
  const exitRef = useRef(false)
  const timers = useRef<number[]>([])

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    onDoneRef.current()
  }

  /** Start the exit (zoom + fade), then hand over to the OS. */
  const exit = (dur: number) => {
    if (exitRef.current) return
    exitRef.current = true
    setExiting(true)
    animate(progress, 1, { duration: Math.min(0.3, dur / 1000), ease: [0.22, 1, 0.36, 1] })
    timers.current.push(window.setTimeout(finish, dur))
  }

  // the timeline
  useEffect(() => {
    const t = timers.current
    const at = (ms: number, fn: () => void) => t.push(window.setTimeout(fn, ms))
    let bar: ReturnType<typeof animate> | undefined

    if (!exitRef.current) {
      if (plan.k > 0) {
        const span = plan.exitAt - 200 * plan.k
        plan.messages.forEach((_, i) => i > 0 && at(200 * plan.k + (span / plan.messages.length) * i, () => setMsg(i)))
        bar = animate(progress, [0.02, 0.34, 0.42, 0.78, 0.86, 0.98], {
          duration: (plan.exitAt - 200 * plan.k) / 1000,
          delay: (200 * plan.k) / 1000,
          ease: 'easeInOut',
          times: [0, 0.3, 0.42, 0.68, 0.8, 1],
        })
      } else {
        progress.set(1)
      }
      at(plan.exitAt, () => exit(plan.exitDur))
    }

    return () => {
      bar?.stop()
      // StrictMode mounts → unmounts → re-mounts: everything is rescheduled on the re-run,
      // and the doneRef guard keeps onDone() to exactly one call
      t.forEach(clearTimeout)
      t.length = 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // warm up: the welcome card opens right after boot on desktop; fonts for the wordmark
  useEffect(() => {
    if (!isMobile) {
      try {
        preloadApp('welcome')
      } catch {
        /* ignore */
      }
    }
    // warm up the display font (whatever --font-display names first in tokens.css)
    const display = getComputedStyle(document.documentElement).getPropertyValue('--font-display').split(',')[0].trim()
    if (display) void document.fonts?.load(`600 80px ${display}`).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Click / tap / key: skip straight to the exit. */
  const skip = () => {
    if (exitRef.current) return
    exit(reduced ? 300 : 340)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape' || e.key === 'Spacebar') {
        e.preventDefault()
        skip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const k = plan.k
  const still = reduced || k === 0
  const ease = [0.22, 1, 0.36, 1] as const
  const enter = (delay: number, duration: number) => ({ delay: (delay * k) / 1000, duration: (duration * Math.max(k, 0.55)) / 1000, ease })
  const message = plan.messages[Math.min(msg, plan.messages.length - 1)]
  const exitDur = plan.exitDur / 1000

  return (
    <motion.div
      className="boot"
      data-still={still || undefined}
      onClick={skip}
      initial={false}
      animate={exiting ? (still ? { opacity: 0 } : { opacity: 0, scale: 1.06, filter: 'blur(8px)' }) : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: exiting ? exitDur : 0, ease: [0.55, 0, 0.45, 1] }}
      style={{ '--boot-k': k || 1 } as CSSProperties}
    >
      {/* sky: the mood's own sky, under a dawn layer that fades away */}
      <div className="boot__sky" aria-hidden="true" />
      <div className="boot__clouds" aria-hidden="true">
        <span className="boot__cloud boot__cloud--1" />
        <span className="boot__cloud boot__cloud--2" />
        <span className="boot__cloud boot__cloud--3" />
      </div>
      <motion.div
        className="boot__dawn"
        aria-hidden="true"
        initial={still ? false : { opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ ...enter(0, 1600), ease: [0.45, 0, 0.35, 1] }}
        style={still ? { opacity: 0 } : undefined}
      />
      <motion.div
        className="boot__light"
        aria-hidden="true"
        initial={still ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={enter(250, 1500)}
      />

      <div className="boot__stage">
        {/* the sunrise */}
        <motion.div
          className="boot__scene"
          aria-hidden="true"
          animate={exiting && !still ? { scale: 1.18, y: -10 } : { scale: 1, y: 0 }}
          transition={{ duration: exitDur, ease: [0.55, 0, 0.45, 1] }}
        >
          <div className="boot__horizon-clip">
            <motion.div
              className="boot__sun"
              initial={still ? false : { y: '78%' }}
              animate={{ y: '0%' }}
              transition={enter(0, 1050)}
            >
              <motion.svg
                className="boot__rays"
                viewBox="-60 -60 120 120"
                initial={still ? false : { opacity: 0, scale: 0.7, rotate: -20 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={enter(650, 900)}
              >
                <defs>
                  <linearGradient id="boot-ray" x1="0" y1="-60" x2="0" y2="20" gradientUnits="userSpaceOnUse">
                    <stop offset="0" style={{ stopColor: 'var(--logo-1)' }} />
                    <stop offset="1" style={{ stopColor: 'var(--logo-3)' }} />
                  </linearGradient>
                </defs>
                <g className="boot__rays-spin" stroke="url(#boot-ray)" strokeWidth="4.2" strokeLinecap="round">
                  {RAYS.map((deg) => {
                    const a = (deg * Math.PI) / 180
                    const long = deg % 60 === 0
                    const r1 = 38
                    const r2 = long ? 52 : 47
                    return <line key={deg} x1={Math.cos(a) * r1} y1={Math.sin(a) * r1} x2={Math.cos(a) * r2} y2={Math.sin(a) * r2} />
                  })}
                </g>
              </motion.svg>
              <span className="boot__disc" />
            </motion.div>
          </div>
          <div className="boot__horizon" />
          <motion.div
            className="boot__reflection"
            initial={still ? false : { opacity: 0, scaleX: 0.4 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={enter(700, 900)}
          >
            <span />
            <span />
            <span />
          </motion.div>
        </motion.div>

        {/* wordmark */}
        <p className="boot__word" style={{ '--boot-len': WORD.length } as CSSProperties}>
          <span className="sr-only">{osName}</span>
          {WORD.map((ch, i) => (
            <motion.span
              key={i}
              className={i >= WORD.length - WORD_TAIL.length ? `boot__ch boot__ch--os${i === WORD.length - WORD_TAIL.length ? ' boot__ch--gap' : ''}` : 'boot__ch'}
              aria-hidden="true"
              initial={still ? false : { opacity: 0, y: 22, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={enter(430 + i * 70, 760)}
            >
              <span className="boot__shine" style={{ '--i': i } as CSSProperties}>
                {ch}
              </span>
            </motion.span>
          ))}
        </p>

        <motion.p
          className="boot__hi hand"
          aria-hidden="true"
          initial={still ? false : { opacity: 0, y: 8, rotate: -6 }}
          animate={{ opacity: 1, y: 0, rotate: -3 }}
          transition={enter(1000, 600)}
        >
          hi, i&rsquo;m {profile.firstName.toLowerCase()}
          <svg className="boot__hi-sparkle" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 1Q11.2 8.8 19 10 11.2 11.2 10 19 8.8 11.2 1 10 8.8 8.8 10 1Z" fill="currentColor" />
          </svg>
        </motion.p>

        {/* progress */}
        <motion.div
          className="boot__progress"
          initial={still ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={enter(180, 500)}
        >
          <div className="boot__bar" aria-hidden="true">
            <motion.span className="boot__fill" style={{ x: fillX }} />
          </div>
          <div className="boot__msgs" role="status" aria-live="polite">
            <span className="sr-only">{osName} is starting: </span>
            <motion.span key={message} className="boot__msg" initial={still ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease }}>
              {message}
            </motion.span>
          </div>
        </motion.div>
      </div>

      <motion.button
        type="button"
        className="boot__skip"
        onClick={(e) => {
          e.stopPropagation()
          skip()
        }}
        initial={still ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={enter(700, 500)}
      >
        {fine ? 'click or press enter to skip' : 'tap to skip'}
      </motion.button>
    </motion.div>
  )
}
