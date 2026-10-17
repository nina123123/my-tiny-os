/* Tiny inline glyphs used by the desktop chrome. All decorative (aria-hidden). */

type G = { size?: number; className?: string }

export function CheckGlyph({ size = 12, className }: G) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" fill="none">
      <path d="M2.2 6.4 4.8 8.9 9.8 3.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChevronGlyph({ size = 10, className }: G) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 10 10" aria-hidden="true" fill="none">
      <path d="M3.6 1.8 6.8 5 3.6 8.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function BatteryGlyph() {
  return (
    <svg className="mbar__battery-glyph" width="22" height="12" viewBox="0 0 22 12" aria-hidden="true" fill="none">
      <rect x="0.75" y="0.75" width="18" height="10.5" rx="3.2" stroke="currentColor" strokeWidth="1.3" opacity=".55" />
      <rect x="19.6" y="3.8" width="1.8" height="4.4" rx=".9" fill="currentColor" opacity=".55" />
      <rect className="mbar__battery-fill" x="2.4" y="2.4" width="14.7" height="7.2" rx="2" />
    </svg>
  )
}

export function CloseGlyph({ size = 8 }: G) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" aria-hidden="true" fill="none">
      <path d="m1.6 1.6 4.8 4.8M6.4 1.6 1.6 6.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function MinGlyph({ size = 8 }: G) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" aria-hidden="true" fill="none">
      <path d="M1.4 4h5.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function MaxGlyph({ size = 8, restore }: G & { restore?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" aria-hidden="true" fill="currentColor">
      {restore ? (
        <>
          <path d="M3.6 0.9v2.7H0.9z" />
          <path d="M4.4 7.1V4.4h2.7z" />
        </>
      ) : (
        <>
          <path d="M1.2 4.4V1.2h3.2z" />
          <path d="M6.8 3.6v3.2H3.6z" />
        </>
      )}
    </svg>
  )
}
