import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react'
import { profile } from '../../content/profile'
import { isAppOn } from '../../os/apps'
import { preloadApp } from '../../os/preload'
import { rectOf } from '../../os/anchors'
import { useWindows } from '../../os/store'
import type { AppId } from '../../os/types'
import { useReducedMotion } from '../../os/useMedia'

/*
 * The big glass "hi, i'm {firstName}" card at the top of the home screen.
 */

function timeGreeting(d = new Date()) {
  const h = d.getHours()
  if (h >= 5 && h < 12) return 'good morning ☀️'
  if (h >= 12 && h < 17) return 'good afternoon 🌤️'
  if (h >= 17 && h < 22) return 'good evening 🌆'
  return 'up late? 🌙'
}

function Sparkle({ className }: { className: string }) {
  return (
    <svg className={`mgreet__sparkle ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 1.5c.6 5.4 3.6 8.9 10.5 10.5-6.9 1.6-9.9 5.1-10.5 10.5C11.4 17.1 8.4 13.6 1.5 12 8.4 10.4 11.4 6.9 12 1.5Z" />
    </svg>
  )
}

function Avatar() {
  if (profile.avatar) {
    return (
      <span className="mgreet__avatar">
        <img src={profile.avatar} alt={profile.avatarAlt ?? profile.firstName} />
        <Sparkle className="mgreet__sparkle--a" />
        <Sparkle className="mgreet__sparkle--b" />
      </span>
    )
  }
  return (
    <span className="mgreet__avatar mgreet__avatar--drawn" aria-hidden="true">
      <span className="mgreet__orb">
        <span className="mgreet__initial">{profile.firstName.slice(0, 1).toUpperCase()}</span>
      </span>
      <Sparkle className="mgreet__sparkle--a" />
      <Sparkle className="mgreet__sparkle--b" />
      <Sparkle className="mgreet__sparkle--c" />
    </span>
  )
}

/**
 * "people say i'm ___" with the describedAs words flipping in: one pass through
 * the list, then it settles on the first word again (no endless motion beside
 * the text, WCAG 2.2.2). It holds while paused (covered, hovered, focused) and
 * never flips with reduced motion.
 */
function FlipWord({ words, paused }: { words: string[]; paused: boolean }) {
  const reduced = useReducedMotion()
  const [flips, setFlips] = useState(0)
  const done = flips >= words.length // back on words[0] after one pass
  const i = reduced ? 0 : flips % Math.max(1, words.length)

  useEffect(() => {
    if (paused || done || reduced || words.length < 2) return
    const t = window.setInterval(() => setFlips((f) => f + 1), 2300)
    return () => window.clearInterval(t)
  }, [paused, done, reduced, words.length])

  if (!words.length) return null
  return (
    <span className="mgreet__flip" aria-hidden="true">
      <AnimatePresence initial={false}>
        <motion.span
          key={i}
          className="mgreet__word"
          initial={reduced ? { opacity: 0 } : { opacity: 0, rotateX: -85, y: '45%' }}
          animate={{ opacity: 1, rotateX: 0, y: '0%' }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, rotateX: 85, y: '-45%' }}
          transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 260, damping: 22 }}
        >
          {words[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function listJoin(words: string[]) {
  if (words.length < 2) return words.join('')
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

export function Greeting({ paused }: { paused: boolean }) {
  const open = useWindows((s) => s.open)
  const [hello] = useState(timeGreeting)
  const name = profile.firstName.toLowerCase()
  // The flip word holds still while the card is being pointed at or has focus.
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  const launch = (appId: AppId) => (e: MouseEvent<HTMLButtonElement>) => {
    open(appId, { origin: rectOf(e.currentTarget) ?? undefined })
  }

  return (
    <section
      className="mgreet glass"
      aria-labelledby="mgreet-title"
      data-rise
      style={{ '--i': 0 } as CSSProperties}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
    >
      <span className="mgreet__blob mgreet__blob--a" aria-hidden="true" />
      <span className="mgreet__blob mgreet__blob--b" aria-hidden="true" />
      <span className="mgreet__blob mgreet__blob--c" aria-hidden="true" />

      <div className="mgreet__top">
        <div className="mgreet__hello">
          <span className="kicker mgreet__kicker">{hello}</span>
          <span className="hand mgreet__note">welcome to my little os!</span>
        </div>
        <Avatar />
      </div>

      <h1 id="mgreet-title" className="mgreet__title">
        <span className="sr-only">hi, i'm {profile.firstName}</span>
        <span aria-hidden="true">
          hi, i'm <em className="mgreet__name">{name}</em>
        </span>
      </h1>
      <p className="mgreet__tagline">{profile.tagline}</p>

      {profile.describedAs.length > 0 && (
        <p className="mgreet__said">
          <span className="sr-only">People describe me as {listJoin(profile.describedAs)}.</span>
          <span className="mgreet__saidlead" aria-hidden="true">
            people say i'm
          </span>
          <FlipWord words={profile.describedAs} paused={paused || hovered || focused} />
        </p>
      )}

      <div className="mgreet__actions">
        <button
          type="button"
          className="btn btn--accent mgreet__cta"
          onClick={launch('projects')}
          onPointerDown={() => preloadApp('projects')}
        >
          see what i made <span className="mgreet__arrow" aria-hidden="true">→</span>
        </button>
        {isAppOn('guestbook') ? (
          <button
            type="button"
            className="btn mgreet__second"
            onClick={launch('guestbook')}
            onPointerDown={() => preloadApp('guestbook')}
          >
            sign my guestbook <span aria-hidden="true">💌</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn mgreet__second"
            onClick={launch('about')}
            onPointerDown={() => preloadApp('about')}
          >
            about me <span aria-hidden="true">👋</span>
          </button>
        )}
      </div>
    </section>
  )
}
