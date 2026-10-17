import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { osName, profile } from '../../content/profile'
import { isAppOn } from '../../os/apps'
import { rectOf } from '../../os/anchors'
import { useWindows } from '../../os/store'
import { useSettings } from '../../os/settings'
import type { AppId, AppProps } from '../../os/types'
import { useReducedMotion } from '../../os/useMedia'
import { DrawnAvatar, MotifSticker, MotifText, Sticker } from './Stickers'
import './welcome.css'

/*
 * Hello: the chromeless glass card desktop visitors see right after boot.
 * The card itself is the drag region; the window frame adds a floating close.
 */

const FLIP_MS = 2200

/**
 * The word after "i'm" flips through the list once and settles back on the
 * first, so it never keeps moving next to text being read (WCAG 2.2.2). It
 * waits while the card is hovered or has focus, and stays still with reduced
 * motion.
 */
function FlipWord({ words }: { words: string[] }) {
  const reduced = useReducedMotion()
  const [i, setI] = useState(0)
  const [done, setDone] = useState(false)
  const [held, setHeld] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  // pause while the visitor is on the card
  useEffect(() => {
    const card = ref.current?.closest<HTMLElement>('.wl-card')
    if (!card) return
    let hover = false
    let focus = false
    const sync = () => setHeld(hover || focus)
    const enter = () => ((hover = true), sync())
    const leave = () => ((hover = false), sync())
    const fin = () => ((focus = true), sync())
    const fout = (e: FocusEvent) => {
      focus = card.contains(e.relatedTarget as Node | null)
      sync()
    }
    card.addEventListener('pointerenter', enter)
    card.addEventListener('pointerleave', leave)
    card.addEventListener('focusin', fin)
    card.addEventListener('focusout', fout)
    return () => {
      card.removeEventListener('pointerenter', enter)
      card.removeEventListener('pointerleave', leave)
      card.removeEventListener('focusin', fin)
      card.removeEventListener('focusout', fout)
    }
  }, [])

  useEffect(() => {
    if (reduced || done || held || words.length < 2) return
    const t = window.setInterval(() => {
      setI((n) => {
        const next = (n + 1) % words.length
        if (next === 0) setDone(true) // one full pass: settle on the first word
        return next
      })
    }, FLIP_MS)
    return () => window.clearInterval(t)
  }, [reduced, done, held, words.length])

  const word = (reduced ? words[0] : words[i]) ?? ''
  return (
    <span ref={ref} className="wl-flip" aria-hidden="true">
      {/* invisible sizer keeps the chip as wide as the longest word, so nothing jumps */}
      <span className="wl-flip__sizer">{words.reduce((a, b) => (b.length > a.length ? b : a), '')}</span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={word}
          className="wl-flip__word"
          initial={reduced ? { opacity: 0 } : { opacity: 0, rotateX: -80, y: '40%' }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, rotateX: 0, y: '0%' }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, rotateX: 80, y: '-40%' }}
          transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 320, damping: 26 }}
        >
          {word}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function listWords(words: string[]) {
  if (words.length < 2) return words.join('')
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

export default function App({ isMobile }: AppProps) {
  const reduced = useReducedMotion()
  const night = useSettings((s) => s.mood) === 'night'
  const name = profile.firstName.toLowerCase()
  const initial = profile.firstName.slice(0, 1).toUpperCase()

  const open = (appId: AppId) => (e: MouseEvent<HTMLElement>) => {
    useWindows.getState().open(appId, { origin: rectOf(e.currentTarget) ?? undefined })
  }

  const rise = (delay: number) =>
    reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
      : {
          initial: { opacity: 0, y: 14, filter: 'blur(6px)' },
          animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          transition: { delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
        }

  return (
    <div className={`wl${isMobile ? ' wl--mobile' : ''}`}>
      {/* the avatar peeks over the card's top edge; its lower half sits behind the frosted glass */}
      <motion.div
        className="wl-peek"
        initial={reduced ? { opacity: 0 } : { y: 56, opacity: 0, rotate: -14 }}
        animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1, rotate: -6 }}
        transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 170, damping: 14, delay: 0.35 }}
        aria-hidden="true"
      >
        <span className="wl-peek__ring">
          {profile.avatar ? (
            <img className="wl-peek__img" src={profile.avatar} alt="" width={96} height={96} decoding="async" />
          ) : (
            <DrawnAvatar initial={initial} size={92} />
          )}
        </span>
        <span className="wl-peek__wave">👋</span>
      </motion.div>

      <div className="wl-card glass" data-window-drag>
        <span className="wl-card__wash" aria-hidden="true" />

        <div className="wl-card__inner">
          <motion.div className="wl-top" {...rise(0.05)}>
            <span className="kicker wl-top__kicker">{osName} · hello</span>
            {profile.origin ? (
              <span className="wl-origin">
                <span className="wl-origin__from">from</span> {profile.origin}
              </span>
            ) : null}
          </motion.div>

          <motion.h1 className="wl-title" {...rise(0.12)}>
            hi, i&rsquo;m <em className="wl-title__name">{name}</em>
            <span className="wl-title__heart">
              <Sticker kind="heart" size={30} bob delay={1.2} tilt={12} />
            </span>
          </motion.h1>

          <motion.p className="wl-describe" {...rise(0.2)}>
            <span className="sr-only">People describe me as {listWords(profile.describedAs)}.</span>
            <span aria-hidden="true" className="wl-describe__im">
              i&rsquo;m
            </span>
            <FlipWord words={profile.describedAs} />
            <span className="wl-describe__tag">{profile.tagline}</span>
          </motion.p>

          <motion.p className="wl-lead" {...rise(0.28)}>
            welcome to <strong>{osName}</strong>, the little corner of the internet where my projects live.
          </motion.p>

          {profile.superpower ? (
            <motion.div className="wl-power" {...rise(0.36)}>
              <span className="wl-power__label">my superpower ✦</span>
              <p className="wl-power__text hand">
                <MotifText text={profile.superpower} />
              </p>
              <MotifSticker size={38} className="wl-power__motif" tilt={-8} bob delay={2.4} />
            </motion.div>
          ) : null}

          <motion.div className="wl-actions" {...rise(0.44)}>
            <button
              type="button"
              className="btn btn--accent wl-btn wl-btn--primary"
              onClick={open('projects')}
            >
              see what i made <span className="wl-btn__arrow" aria-hidden="true">→</span>
            </button>
            {isAppOn('guestbook') ? (
              <button type="button" className="btn wl-btn" onClick={open('guestbook')}>
                sign my guestbook <span aria-hidden="true">💌</span>
              </button>
            ) : null}
            <button type="button" className="btn btn--ghost wl-btn wl-btn--ghost" onClick={open('about')}>
              about me
            </button>
          </motion.div>
        </div>

        {!isMobile ? (
          <motion.p className="wl-psst" {...rise(0.9)}>
            <svg className="wl-psst__arrow" viewBox="0 0 120 70" aria-hidden="true" fill="none">
              <path
                className="wl-psst__path"
                pathLength={1}
                d="M112 50C92 64 60 64 40 46 26 33 20 20 14 8"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
              <path
                className="wl-psst__head"
                d="M5 17l9-10 6 13"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hand wl-psst__text">psst: double-click the icons!</span>
          </motion.p>
        ) : null}
      </div>

      <Sticker kind={night ? 'moon' : 'sun'} size={58} className="wl-st wl-st--sun" bob delay={0} tilt={night ? 6 : -10} />
      <Sticker kind="star" size={40} className="wl-st wl-st--star" bob delay={3.1} tilt={14} />
      <Sticker kind="sparkle" size={34} className="wl-st wl-st--sparkle" bob delay={1.7} tilt={-4} />
    </div>
  )
}
