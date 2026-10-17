import type { CSSProperties, ReactNode } from 'react'
import { profile } from '../../content/profile'
import './stickers.css'

/*
 * Die-cut sticker doodles shared by the work apps (welcome, about, projects,
 * project). Decorative only: always aria-hidden. Fixed palette colors on
 * purpose (they're illustrations), with a white sticker edge that reads in
 * every mood.
 */

export type StickerKind = 'sun' | 'moon' | 'star' | 'heart' | 'sparkle' | 'cloud' | 'flower'

const EDGE = { stroke: '#fff', strokeWidth: 7, strokeLinejoin: 'round', strokeLinecap: 'round' } as const

function Shape({ kind }: { kind: StickerKind }) {
  switch (kind) {
    case 'sun':
      return (
        <>
          <g {...EDGE}>
            <circle cx="32" cy="32" r="15" fill="#fff" />
            {RAYS.map((d) => (
              <path key={d} d={d} fill="none" />
            ))}
          </g>
          <g stroke="var(--butter-400)" strokeWidth="4.5" strokeLinecap="round" fill="none">
            {RAYS.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <circle cx="32" cy="32" r="14" fill="var(--butter-300)" stroke="var(--butter-400)" strokeWidth="2" />
          <circle cx="27" cy="30" r="1.8" fill="var(--plum-800)" />
          <circle cx="37" cy="30" r="1.8" fill="var(--plum-800)" />
          <path d="M27.5 35.5q4.5 4 9 0" fill="none" stroke="var(--plum-800)" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="24" cy="34.5" r="2.2" fill="var(--coral-300)" opacity=".7" />
          <circle cx="40" cy="34.5" r="2.2" fill="var(--coral-300)" opacity=".7" />
        </>
      )
    case 'moon':
      // a sleepy crescent (the sun's night shift) with a tiny twinkle
      return (
        <>
          <path d={MOON} fill="#fff" {...EDGE} />
          <path d={TWINKLE} fill="#fff" {...EDGE} strokeWidth={5} />
          <path d={MOON} fill="var(--butter-300)" stroke="var(--butter-400)" strokeWidth="2" strokeLinejoin="round" />
          <path d={TWINKLE} fill="var(--lavender-300)" stroke="var(--lavender-400)" strokeWidth="1.2" strokeLinejoin="round" />
          <g fill="none" stroke="var(--plum-800)" strokeWidth="1.8" strokeLinecap="round">
            <path d="M13.2 35.2q2.2 2.2 4.6 .6" />
            <path d="M21.4 39.6q2.2 2.2 4.6 .6" />
            <path d="M17.6 44.6q2.6 1.8 5 .2" />
          </g>
          <circle cx="12.6" cy="40.6" r="2.1" fill="var(--coral-300)" opacity=".7" />
          <circle cx="27.4" cy="45.2" r="2.1" fill="var(--coral-300)" opacity=".7" />
        </>
      )
    case 'star':
      return (
        <>
          <path d={STAR} fill="#fff" {...EDGE} />
          <path d={STAR} fill="var(--coral-400)" stroke="var(--coral-400)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M25 26q2-5 5-7" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="2.6" strokeLinecap="round" />
        </>
      )
    case 'heart':
      return (
        <>
          <path d={HEART} fill="#fff" {...EDGE} />
          <path d={HEART} fill="var(--pink-300)" stroke="var(--pink-300)" strokeWidth="2" strokeLinejoin="round" />
          <path d="M20 25q1.5-5 6.5-5.5" fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="2.6" strokeLinecap="round" />
        </>
      )
    case 'sparkle':
      return (
        <>
          <path d={SPARKLE} fill="#fff" {...EDGE} />
          <path d={SPARKLE} fill="var(--lavender-400)" stroke="var(--lavender-400)" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="50" cy="15" r="4" fill="var(--butter-300)" stroke="#fff" strokeWidth="2.5" />
        </>
      )
    case 'cloud':
      return (
        <>
          <path d={CLOUD} fill="#fff" {...EDGE} />
          <path d={CLOUD} fill="var(--sky-200)" stroke="var(--sky-300)" strokeWidth="2" strokeLinejoin="round" />
        </>
      )
    case 'flower':
      return (
        <>
          <g {...EDGE} fill="#fff">
            {PETALS.map((r) => (
              <ellipse key={r} cx="32" cy="18" rx="8" ry="11" transform={`rotate(${r} 32 32)`} />
            ))}
          </g>
          {PETALS.map((r) => (
            <ellipse key={r} cx="32" cy="18" rx="8" ry="11" transform={`rotate(${r} 32 32)`} fill="var(--peach-300)" />
          ))}
          <circle cx="32" cy="32" r="7.5" fill="var(--butter-400)" stroke="#fff" strokeWidth="2.5" />
        </>
      )
  }
}

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
  const a = (deg * Math.PI) / 180
  const p = (r: number) => `${(32 + Math.cos(a) * r).toFixed(1)} ${(32 + Math.sin(a) * r).toFixed(1)}`
  return `M${p(21)}L${p(27)}`
})
const PETALS = [0, 72, 144, 216, 288]
const STAR =
  'M32 8.5l6.7 14.1 15.4 1.9-11.3 10.7 2.9 15.3L32 43l-13.7 7.5 2.9-15.3L9.9 24.5l15.4-1.9z'
const HEART = 'M32 52S11 39.5 11 25.5C11 18.6 16.2 14 22 14c4.6 0 8 2.6 10 6.2C34 16.6 37.4 14 42 14c5.8 0 11 4.6 11 11.5C53 39.5 32 52 32 52z'
const SPARKLE = 'M30 8c1.6 11.2 5.4 15.6 18 18-12.6 2.4-16.4 6.8-18 20-1.6-13.2-5.4-17.6-18-20 12.6-2.4 16.4-6.8 18-18z'
// crescent: the long way round a circle at (29,33) r20, back along a cut circle at (41,25) r17
const MOON = 'M29 13A20 20 0 1 0 47.4 40.7A17 17 0 0 1 29 13Z'
const TWINKLE = 'M51 6.5c.7 4.2 2 5.7 6.4 6.5-4.4.8-5.7 2.3-6.4 6.9-.7-4.6-2-6.1-6.4-6.9 4.4-.8 5.7-2.3 6.4-6.5z'
const CLOUD = 'M19 46c-6 0-10-4.2-10-9.4 0-5 3.8-8.8 8.6-9.2C18.6 20.4 24.4 16 31 16c6.4 0 11.4 4 13 9.6 5.8.2 10 4.6 10 10.2 0 5.8-4.6 10.2-10.4 10.2z'

type StickerProps = {
  kind: StickerKind
  size?: number
  className?: string
  style?: CSSProperties
  /** Gentle floating loop (off for reduced motion via global.css) */
  bob?: boolean
  /** Seconds offset for the bob loop so neighbours don't move in sync */
  delay?: number
  /** Resting tilt, degrees */
  tilt?: number
}

export function Sticker({ kind, size = 44, className, style, bob = false, delay = 0, tilt = 0 }: StickerProps) {
  return (
    <span
      aria-hidden="true"
      className={`wk-sticker${bob ? ' wk-sticker--bob' : ''}${className ? ` ${className}` : ''}`}
      style={
        {
          width: size,
          height: size,
          '--wk-tilt': `${tilt}deg`,
          '--wk-delay': `${-delay}s`,
          ...style,
        } as CSSProperties
      }
    >
      <svg viewBox="0 0 64 64" width={size} height={size} overflow="visible">
        <Shape kind={kind} />
      </svg>
    </span>
  )
}

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Renders text with the owner's signature (profile.motif: "{emoji} {word}", any
 * casing, an optional trailing emoji) wrapped in a highlighted <mark>. Without
 * a motif, or when the text doesn't contain it, the text comes back unchanged.
 */
export function MotifText({ text, className = 'wk-motif' }: { text: string; className?: string }): ReactNode {
  const motif = profile.motif
  if (!motif) return text
  const e = escape(motif.emoji)
  const parts = text.split(new RegExp(`(${e}\\s*${escape(motif.word)}\\s*(?:${e})?)`, 'iu'))
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className={className}>
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

/**
 * profile.motif's emoji as a die-cut sticker. Without a motif it draws the `fallback` sticker
 * (or nothing). Decorative: always aria-hidden.
 */
export function MotifSticker({ fallback, ...props }: Omit<StickerProps, 'kind' | 'style'> & { fallback?: StickerKind }) {
  const { size = 40, className, bob = false, delay = 0, tilt = 0 } = props
  if (!profile.motif) return fallback ? <Sticker kind={fallback} {...props} /> : null
  return (
    <span
      aria-hidden="true"
      className={`wk-sticker wk-sticker--emoji${bob ? ' wk-sticker--bob' : ''}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.7), '--wk-tilt': `${tilt}deg`, '--wk-delay': `${-delay}s` } as CSSProperties}
    >
      <span className="wk-sticker__emoji">{profile.motif.emoji}</span>
    </span>
  )
}

/** A soft drawn avatar used when there's no photo: dreamy gradient circle + initial. */
export function DrawnAvatar({ initial, size = 96 }: { initial: string; size?: number }) {
  return (
    <span className="wk-drawn-avatar" style={{ width: size, height: size, fontSize: size * 0.46 }} aria-hidden="true">
      {initial}
    </span>
  )
}
