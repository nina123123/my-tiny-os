import type { CSSProperties } from 'react'
import { responsiveProps, retryWithoutSrcSet } from './responsiveImage'
import './CoverArt.css'

/*
 * Generated dreamy cover art for projects.
 *
 * Fills its parent (width/height 100%). Without `src` it paints soft blurred
 * gradient blobs from `colors` (positions vary deterministically per `seed`),
 * a fine film grain, and the `emoji` centered in a little frosted bubble.
 * With `src` it renders the photo (object-fit: cover, lazy) over a plain
 * version of the generated art, which doubles as the loading placeholder
 * and as the fallback if the image fails. Pass `sizes` (the rendered width,
 * as for <img sizes>) on small thumbnails so a 640px copy of the photo is used
 * where it's enough (see responsiveImage.ts).
 *
 * Root is a <span> (display:block) so it's valid inside buttons and links.
 * Decorative unless `alt` is given.
 */

export type CoverVariant = 'bubble' | 'emoji' | 'plain'

/** mulberry32: tiny deterministic PRNG */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const pct = (n: number) => `${n.toFixed(1)}%`

/** The layered gradient for a cover. */
function coverBackground(colors: [string, string], seed: number | string = 0): string {
  const r = rng(typeof seed === 'number' ? hash(`n${seed}`) : hash(seed))
  const [c0, c1] = colors
  const between = (lo: number, hi: number) => lo + r() * (hi - lo)
  const angle = Math.round(between(115, 215))
  const light = `color-mix(in oklab, ${c0} 45%, white)`
  const glow = `color-mix(in oklab, ${c1} 55%, white)`
  const deep = `color-mix(in oklab, ${c1} 78%, #5e4782)`
  const warm = `color-mix(in oklab, ${c0} 70%, #ff8475)`
  const flip = r() > 0.5
  const blob = (color: string, x: number, y: number, size: number) =>
    `radial-gradient(${pct(size)} ${pct(size * 1.25)} at ${pct(x)} ${pct(y)}, ${color} 0%, color-mix(in oklab, ${color} 55%, transparent) 40%, transparent 100%)`
  return [
    blob(light, between(30, 75), between(-5, 25), between(38, 55)),
    blob(warm, flip ? between(70, 100) : between(0, 30), between(35, 70), between(28, 42)),
    blob(c0, flip ? between(0, 35) : between(65, 100), between(0, 45), between(55, 80)),
    blob(deep, flip ? between(55, 100) : between(0, 45), between(80, 110), between(42, 62)),
    blob(glow, between(20, 80), between(55, 95), between(48, 70)),
    `linear-gradient(${angle}deg, ${c0}, ${c1})`,
  ].join(', ')
}

export function CoverArt({
  colors,
  emoji,
  src,
  alt = '',
  seed,
  className,
  variant = 'bubble',
  focus,
  sizes,
}: {
  colors: [string, string]
  emoji?: string
  src?: string
  alt?: string
  /** Varies blob placement. Defaults to a hash of colors + emoji, so different items differ. */
  seed?: number | string
  className?: string
  /** bubble: emoji in a frosted bubble (default) · emoji: big floating emoji · plain: no emoji */
  variant?: CoverVariant
  /** Focal point of the photo when it's cropped (CSS object-position, e.g. "50% 0%") */
  focus?: string
  /** Rendered width as an <img sizes> value; enables the small photo copy. Leave out for heroes. */
  sizes?: string
}) {
  const s = seed ?? `${colors[0]}|${colors[1]}|${emoji ?? ''}`
  const style = { backgroundImage: coverBackground(colors, s) } as CSSProperties
  const cls = ['cover', className].filter(Boolean).join(' ')
  const showEmoji = !!emoji && variant !== 'plain'

  const art = (
    <>
      <span className="cover__art" style={style} aria-hidden="true" />
      {showEmoji && (
        <span className={variant === 'emoji' ? 'cover__float' : 'cover__bubble'} aria-hidden="true">
          <span className="cover__emoji">{emoji}</span>
        </span>
      )}
    </>
  )

  if (src) {
    return (
      <span className={`${cls} cover--photo`} data-state="loading">
        {art}
        <img
          className="cover__img"
          src={src}
          {...responsiveProps(src, sizes)}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          style={focus ? { objectPosition: focus } : undefined}
          ref={(img) => {
            // cached images may have finished before React attached onLoad
            if (img?.complete && img.naturalWidth > 0) img.parentElement?.setAttribute('data-state', 'loaded')
          }}
          onLoad={(e) => e.currentTarget.parentElement?.setAttribute('data-state', 'loaded')}
          onError={(e) => {
            if (retryWithoutSrcSet(e.currentTarget)) return
            e.currentTarget.parentElement?.setAttribute('data-state', 'error')
          }}
        />
      </span>
    )
  }

  return (
    <span className={cls} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
      {art}
    </span>
  )
}
