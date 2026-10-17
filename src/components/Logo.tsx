import { useId } from 'react'

/*
 * The OS's logo mark: a little sun rising over a horizon.
 * Half sun + five rays in a gradient from the --logo-1 / --logo-2 / --logo-3
 * tokens (tokens.css); the horizon line uses currentColor so it follows the
 * surrounding ink (plum by day, cream at night).
 * Works from 14px (one horizon line, chunkier rays) to 64px+ (two horizon
 * lines and a soft glow). Decorative unless `title` is given.
 */

const RAY_ANGLES = [-162, -126, -90, -54, -18]

export function Logo({ size = 18, title, className }: { size?: number; title?: string; className?: string }) {
  const raw = useId()
  const uid = `nl${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const tiny = size < 22
  const big = size >= 40
  const rayW = tiny ? 2.9 : 2.4
  const r1 = tiny ? 11.6 : 11.4
  const r2 = tiny ? 14.4 : 14.6

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={className}
      style={{ display: 'block', flex: 'none' }}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={`${uid}-sun`} x1="0" y1="5" x2="0" y2="21.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--logo-1)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--logo-2)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-3)' }} />
        </linearGradient>
        {big && (
          <radialGradient id={`${uid}-glow`} cx="16" cy="20" r="14" gradientUnits="userSpaceOnUse">
            <stop offset="0" style={{ stopColor: 'var(--logo-1)', stopOpacity: 0.45 }} />
            <stop offset="1" style={{ stopColor: 'var(--logo-3)', stopOpacity: 0 }} />
          </radialGradient>
        )}
        <clipPath id={`${uid}-sky`}>
          <rect x="0" y="0" width="32" height={tiny ? 21.4 : 21.2} />
        </clipPath>
      </defs>
      {big && <circle cx="16" cy="20" r="14" fill={`url(#${uid}-glow)`} clipPath={`url(#${uid}-sky)`} />}
      <g stroke={`url(#${uid}-sun)`} strokeWidth={rayW} strokeLinecap="round">
        {RAY_ANGLES.map((deg) => {
          const a = (deg * Math.PI) / 180
          return (
            <line
              key={deg}
              x1={+(16 + Math.cos(a) * r1).toFixed(2)}
              y1={+(21 + Math.sin(a) * r1).toFixed(2)}
              x2={+(16 + Math.cos(a) * r2).toFixed(2)}
              y2={+(21 + Math.sin(a) * r2).toFixed(2)}
            />
          )
        })}
      </g>
      <circle cx="16" cy="21" r={tiny ? 8.4 : 8.6} fill={`url(#${uid}-sun)`} clipPath={`url(#${uid}-sky)`} />
      {big && <ellipse cx="13.4" cy="16.4" rx="2.6" ry="1.5" fill="#fff" opacity={0.45} transform="rotate(-24 13.4 16.4)" />}
      <g stroke="currentColor" strokeLinecap="round" fill="none">
        <path d={tiny ? 'M3.6 25.4h24.8' : 'M3.4 24.8h25.2'} strokeWidth={tiny ? 2.9 : 2.4} />
        {!tiny && <path d="M9.6 28.8h12.8" strokeWidth={2.2} opacity={0.5} />}
      </g>
    </svg>
  )
}
