import { useId, type ReactNode } from 'react'
import type { AppId } from '../os/types'

/*
 * The OS's icon set (one per app in os/apps.ts).
 *
 * Every icon is the same little object: a true superellipse squircle with a
 * soft two-tone palette gradient, a warm color bloom, a glossy top sheen, an
 * inner rim (light on top, soft shadow at the bottom) and one bold custom glyph.
 * Drawn on a 64-unit grid. Under ~28px the fine details (grooves, trails,
 * text lines, glyph shadow) drop out so it stays crisp in title bars.
 *
 * Decorative (aria-hidden): the caller provides the accessible name.
 */

/* ── palette (fixed illustration colors, same as tokens.css) ─────────── */
const C = {
  white: '#ffffff',
  cream: '#fffaf0',
  lav200: '#e9e1ff',
  lav300: '#d6c8ff',
  lav400: '#bba6ff',
  lav500: '#9c82f0',
  peach100: '#fff3ec',
  peach200: '#ffe1d2',
  peach300: '#ffcbb3',
  peach400: '#ffb08f',
  butter100: '#fffbe6',
  butter200: '#fff4c7',
  butter300: '#ffe99a',
  butter400: '#ffd96a',
  mint300: '#aeead0',
  mint400: '#7fd8b2',
  sky200: '#d8eaff',
  sky300: '#b5d6ff',
  pink200: '#ffd6e7',
  pink300: '#ffb3d1',
  coral200: '#ffc9c1',
  coral300: '#ffa196',
  coral400: '#ff8475',
  coral500: '#ff6b5b',
  coral600: '#ee5444',
  coral700: '#c93a2c',
  plum800: '#3b2559',
  plum600: '#5e4782',
  plum400: '#8c7aa8',
  plum200: '#cbbfdc',
}

/* ── geometry helpers ────────────────────────────────────────────────── */

const f = (n: number) => +n.toFixed(2)

/**
 * A true superellipse |x|^n + |y|^n = 1, resampled evenly by arc length and
 * smoothed into cubic Béziers (Catmull-Rom), so it's compact and silky at 72px.
 */
function superellipse(size: number, n = 5, segments = 48): string {
  const r = size / 2
  const dense: [number, number][] = []
  const N = 2048
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    dense.push([r + Math.sign(c) * Math.abs(c) ** (2 / n) * r, r + Math.sign(s) * Math.abs(s) ** (2 / n) * r])
  }
  const lengths = [0]
  for (let i = 1; i <= N; i++) {
    const [ax, ay] = dense[i - 1]
    const [bx, by] = dense[i % N]
    lengths.push(lengths[i - 1] + Math.hypot(bx - ax, by - ay))
  }
  const total = lengths[N]
  const pts: [number, number][] = []
  let j = 0
  for (let k = 0; k < segments; k++) {
    const target = (k / segments) * total
    while (lengths[j + 1] < target) j++
    const span = lengths[j + 1] - lengths[j] || 1
    const u = (target - lengths[j]) / span
    const [ax, ay] = dense[j]
    const [bx, by] = dense[(j + 1) % N]
    pts.push([ax + (bx - ax) * u, ay + (by - ay) * u])
  }
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let k = 0; k < segments; k++) {
    const p0 = pts[(k - 1 + segments) % segments]
    const p1 = pts[k]
    const p2 = pts[(k + 1) % segments]
    const p3 = pts[(k + 2) % segments]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`
  }
  return d + 'Z'
}

const SQUIRCLE = superellipse(64)

/** 4-point sparkle, `k` = waist (0 = needle thin, 0.4 = chubby). */
function sparkle(cx: number, cy: number, r: number, k = 0.2): string {
  const w = r * k
  return (
    `M${f(cx)} ${f(cy - r)}` +
    `Q${f(cx + w)} ${f(cy - w)} ${f(cx + r)} ${f(cy)}` +
    `Q${f(cx + w)} ${f(cy + w)} ${f(cx)} ${f(cy + r)}` +
    `Q${f(cx - w)} ${f(cy + w)} ${f(cx - r)} ${f(cy)}` +
    `Q${f(cx - w)} ${f(cy - w)} ${f(cx)} ${f(cy - r)}Z`
  )
}

/** 5-point star (pair with stroke-linejoin=round + a same-color stroke for soft tips). */
function star(cx: number, cy: number, r: number, inner = 0.5, rot = -90): string {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const a = ((rot + i * 36) * Math.PI) / 180
    const rr = i % 2 ? r * inner : r
    d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`
  }
  return d + 'Z'
}

/** Plump heart centered at (cx, cy), roughly `s` wide. */
function heart(cx: number, cy: number, s: number): string {
  const k = s / 20
  const p = (x: number, y: number) => `${f(cx + x * k)} ${f(cy + y * k)}`
  return (
    `M${p(0, 8.6)}` +
    `C${p(-2.4, 6.9)} ${p(-10, 2)} ${p(-10, -3.4)}` +
    `C${p(-10, -7.6)} ${p(-6.9, -10)} ${p(-4.3, -10)}` +
    `C${p(-2.2, -10)} ${p(-0.6, -8.8)} ${p(0, -7.2)}` +
    `C${p(0.6, -8.8)} ${p(2.2, -10)} ${p(4.3, -10)}` +
    `C${p(6.9, -10)} ${p(10, -7.6)} ${p(10, -3.4)}` +
    `C${p(10, 2)} ${p(2.4, 6.9)} ${p(0, 8.6)}Z`
  )
}

/** Folder silhouette: tab + body, rounded. */
function folder(x: number, y: number, w: number, h: number): string {
  const r = 3.6
  const tabW = w * 0.42
  return (
    `M${x + r} ${y}` +
    `H${f(x + tabW - 2)}` +
    `Q${f(x + tabW + 0.6)} ${y} ${f(x + tabW + 2.4)} ${y + 2.2}` +
    `L${f(x + tabW + 3.4)} ${y + 3.6}` +
    `H${x + w - r}` +
    `Q${x + w} ${y + 3.6} ${x + w} ${f(y + 3.6 + r)}` +
    `V${y + h - r}` +
    `Q${x + w} ${y + h} ${x + w - r} ${y + h}` +
    `H${x + r}` +
    `Q${x} ${y + h} ${x} ${y + h - r}` +
    `V${y + r}` +
    `Q${x} ${y} ${x + r} ${y}Z`
  )
}

/* ── per-app recipes ─────────────────────────────────────────────────── */

type Ctx = { small: boolean; id: (k: string) => string }

type Recipe = {
  /** two-tone background, top-left → bottom-right */
  from: string
  to: string
  /** soft color bloom in the bottom-right corner */
  bloom: string
  /** glyph drop-shadow tint */
  shade: string
  glyph: (c: Ctx) => ReactNode
}

const RECIPES: Record<AppId, Recipe> = {
  /* stacked folders + sparkle */
  projects: {
    from: C.coral400,
    to: C.peach300,
    bloom: C.butter300,
    shade: C.coral700,
    glyph: ({ small, id }) => (
      <>
        <defs>
          <linearGradient id={id('fold')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.white} />
            <stop offset="1" stopColor={C.peach100} />
          </linearGradient>
        </defs>
        <path d={folder(19.5, 16, 33, 25)} fill={C.white} opacity={0.55} />
        <path d={folder(12.5, 22.5, 35, 27)} fill={`url(#${id('fold')})`} />
        {!small && <path d="M19 40.5h12" stroke={C.coral300} strokeWidth={2.6} strokeLinecap="round" />}
        <path d={sparkle(46.5, 45.5, small ? 9 : 8.5, 0.24)} fill={C.butter300} stroke={C.white} strokeWidth={1.6} paintOrder="stroke" />
        {!small && <circle cx="52.5" cy="35.5" r="1.9" fill={C.white} />}
      </>
    ),
  },

  /* a sunny smiling face */
  about: {
    from: C.butter300,
    to: C.peach400,
    bloom: C.coral300,
    shade: C.coral600,
    glyph: ({ small }) => {
      const rays = Array.from({ length: 8 }, (_, i) => {
        const a = (i * 45 * Math.PI) / 180
        const r1 = small ? 17.5 : 17.8
        const r2 = small ? 23 : 22.6
        return (
          <line
            key={i}
            x1={f(32 + Math.cos(a) * r1)}
            y1={f(32.5 + Math.sin(a) * r1)}
            x2={f(32 + Math.cos(a) * r2)}
            y2={f(32.5 + Math.sin(a) * r2)}
          />
        )
      })
      return (
        <>
          <g stroke={C.white} strokeWidth={small ? 5 : 4.2} strokeLinecap="round">
            {rays}
          </g>
          <circle cx="32" cy="32.5" r="13.6" fill={C.cream} />
          <circle cx="27.2" cy="30.6" r={small ? 2.3 : 2} fill={C.plum800} />
          <circle cx="36.8" cy="30.6" r={small ? 2.3 : 2} fill={C.plum800} />
          <path d="M26.4 35.4Q32 41.6 37.6 35.4" fill="none" stroke={C.plum800} strokeWidth={small ? 2.8 : 2.4} strokeLinecap="round" />
          {!small && (
            <>
              <ellipse cx="23.8" cy="36" rx="2.6" ry="1.8" fill={C.coral300} opacity={0.75} />
              <ellipse cx="40.2" cy="36" rx="2.6" ry="1.8" fill={C.coral300} opacity={0.75} />
            </>
          )}
        </>
      )
    },
  },

  /* an envelope with a heart */
  guestbook: {
    from: C.peach300,
    to: C.pink300,
    bloom: C.butter200,
    shade: C.coral600,
    glyph: ({ small }) => (
      <>
        <rect x="11.5" y="18.5" width="41" height="29" rx="5.5" fill={C.white} />
        {!small && (
          <path d="M13.5 45.5 26 34.5M50.5 45.5 38 34.5" stroke={C.pink200} strokeWidth={2.2} strokeLinecap="round" />
        )}
        <path d="M13.8 21.6 32 35.2l18.2-13.6" fill="none" stroke={C.pink300} strokeWidth={small ? 3 : 2.6} strokeLinecap="round" strokeLinejoin="round" />
        <path d={heart(32, 35.6, small ? 15 : 13.5)} fill={C.coral500} stroke={C.white} strokeWidth={1.8} paintOrder="stroke" />
        {!small && <ellipse cx="28.9" cy="32.4" rx="1.6" ry="1.1" fill={C.white} opacity={0.7} transform="rotate(-30 28.9 32.4)" />}
      </>
    ),
  },

  /* a paper plane */
  contact: {
    from: C.mint300,
    to: C.sky300,
    bloom: C.lav200,
    shade: '#3f8f8a',
    glyph: ({ small }) => (
      <>
        {!small && (
          <path
            d="M7.5 52.5c3-4.6 7.6-7.6 13.6-8.6"
            fill="none"
            stroke={C.white}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeDasharray="0.1 4.4"
            opacity={0.95}
          />
        )}
        <path d="M51.5 12.5 11.5 28.6c-1.6.6-1.6 2.8 0 3.5l14.3 5.4Z" fill={C.white} strokeLinejoin="round" />
        <path d="M51.5 12.5 25.8 37.5l5.6 14.3c.6 1.6 2.9 1.6 3.5 0Z" fill={C.sky200} />
        <path d="M51.5 12.5 25.8 37.5 27.4 46l4-5.6Z" fill={C.sky300} opacity={0.9} />
      </>
    ),
  },

  /* a waving hand */
  welcome: {
    from: C.lav300,
    to: C.peach300,
    bloom: C.butter300,
    shade: C.lav500,
    glyph: ({ small }) => {
      const w = small ? 6.4 : 5.6
      return (
        <>
          {!small && (
            <g fill="none" stroke={C.white} strokeWidth={2.4} strokeLinecap="round">
              <path d="M46.6 12.2q4.6 2.2 6.3 7" />
              <path d="M47.6 5.8q8 3.4 10.8 11.4" opacity={0.6} />
              <path d="M11.6 22.6q-2.4 4.4-.6 9.4" opacity={0.75} />
            </g>
          )}
          <g transform="rotate(-14 32 40)" strokeLinecap="round">
            <path d="M23.8 33V18.6" stroke={C.cream} strokeWidth={w} />
            <path d="M30.6 31V14.6" stroke={C.butter100} strokeWidth={w} />
            <path d="M37.4 32V16.8" stroke={C.cream} strokeWidth={w} />
            <path d="M43.8 35V23.4" stroke={C.butter100} strokeWidth={w} />
            <path d="M20.8 29.4h26V41a12 12 0 0 1-12 12h-2a12 12 0 0 1-12-12Z" fill={C.cream} />
            <path d="M15.6 36.2 22.6 44.6" stroke={C.cream} strokeWidth={w + 0.4} />
            {!small && (
              <g stroke={C.peach300} strokeWidth={1.5} opacity={0.9}>
                <path d="M27.2 29.6v-3.4" />
                <path d="M34 29v-3.6" />
                <path d="M40.6 30v-3" />
              </g>
            )}
          </g>
        </>
      )
    },
  },

  /* a document with a star */
  project: {
    from: C.sky300,
    to: C.lav400,
    bloom: C.pink200,
    shade: C.lav500,
    glyph: ({ small }) => (
      <>
        <path d="M21.5 11.5h14.2l10.8 10.8V47a4.5 4.5 0 0 1-4.5 4.5H21.5A4.5 4.5 0 0 1 17 47V16a4.5 4.5 0 0 1 4.5-4.5Z" fill={C.white} />
        <path d="M35.7 11.5v7.3a3.5 3.5 0 0 0 3.5 3.5h7.3Z" fill={C.lav200} />
        <g stroke={small ? C.lav300 : C.lav400} strokeWidth={small ? 3 : 2.5} strokeLinecap="round">
          <path d="M23 29h15" />
          <path d="M23 35h11" />
          {!small && <path d="M23 41h7" />}
        </g>
        <path
          d={star(44, 44.5, small ? 10.5 : 9.6, 0.5)}
          fill={C.coral500}
          stroke={C.white}
          strokeWidth={2.4}
          strokeLinejoin="round"
          paintOrder="stroke"
        />
      </>
    ),
  },
}

export function AppIcon({ appId, size = 64, className }: { appId: AppId; size?: number; className?: string }) {
  const raw = useId()
  const uid = `ai${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const id = (k: string) => `${uid}-${k}`
  const r = RECIPES[appId] ?? RECIPES.welcome
  const small = size < 28

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      data-app-icon={appId}
      className={className}
      style={{ display: 'block', flex: 'none', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={id('bg')} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={r.from} />
          <stop offset="1" stopColor={r.to} />
        </linearGradient>
        <radialGradient id={id('bloom')} cx="0.92" cy="1" r="0.62">
          <stop offset="0" stopColor={r.bloom} stopOpacity={0.85} />
          <stop offset="1" stopColor={r.bloom} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={id('light')} cx="0.18" cy="0.08" r="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity={0.5} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={id('sheen')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.42} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <linearGradient id={id('rim')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.95} />
          <stop offset="0.32" stopColor="#fff" stopOpacity={0.12} />
          <stop offset="0.7" stopColor={C.plum800} stopOpacity={0} />
          <stop offset="1" stopColor={C.plum800} stopOpacity={0.2} />
        </linearGradient>
        <clipPath id={id('clip')}>
          <path d={SQUIRCLE} />
        </clipPath>
        {!small && (
          <filter id={id('drop')} x="-20%" y="-20%" width="140%" height="150%" colorInterpolationFilters="sRGB">
            <feDropShadow dx="0" dy="1.6" stdDeviation="1.5" floodColor={r.shade} floodOpacity={0.32} />
          </filter>
        )}
      </defs>
      <g clipPath={`url(#${id('clip')})`}>
        <path d={SQUIRCLE} fill={`url(#${id('bg')})`} />
        <rect width="64" height="64" fill={`url(#${id('bloom')})`} />
        <rect width="64" height="64" fill={`url(#${id('light')})`} />
        <path d="M0 0h64v25c-9 5.6-21 7.4-32 7.4S9 30.6 0 25Z" fill={`url(#${id('sheen')})`} />
        <g filter={small ? undefined : `url(#${id('drop')})`}>{r.glyph({ small, id })}</g>
        <path d={SQUIRCLE} fill="none" stroke={`url(#${id('rim')})`} strokeWidth={small ? 2.6 : 2.2} />
      </g>
    </svg>
  )
}
