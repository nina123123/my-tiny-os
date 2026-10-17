/*
 * Wallpaper palette: reads --wp-a … --wp-e from <html> and helps crossfade.
 */

export type RGB = [number, number, number]
export type Palette = { a: RGB; b: RGB; c: RGB; d: RGB; e: RGB }

const KEYS = ['a', 'b', 'c', 'd', 'e'] as const

/** Sunrise defaults (tokens.css), used if a var is missing or unparsable. */
export const SUNRISE: Palette = {
  a: hex('#e6dcff'),
  b: hex('#ffd9c7'),
  c: hex('#fff1bd'),
  d: hex('#ff8f80'),
  e: hex('#cfe6ff'),
}

function hex(s: string): RGB {
  return parseColor(s) ?? [1, 1, 1]
}

export function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase()
  let m = /^#([0-9a-f]{3})$/.exec(s)
  if (m) {
    const [r, g, b] = m[1].split('').map((ch) => parseInt(ch + ch, 16) / 255)
    return [r, g, b]
  }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s)
  if (m) {
    const n = parseInt(m[1], 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s)
  if (m) return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255]
  return null
}

export function readPalette(el: HTMLElement = document.documentElement): Palette {
  const cs = getComputedStyle(el)
  const out = {} as Palette
  for (const k of KEYS) out[k] = parseColor(cs.getPropertyValue(`--wp-${k}`)) ?? SUNRISE[k]
  return out
}

export function mixRGB(x: RGB, y: RGB, t: number): RGB {
  return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]
}

export function mixPalette(x: Palette, y: Palette, t: number): Palette {
  return {
    a: mixRGB(x.a, y.a, t),
    b: mixRGB(x.b, y.b, t),
    c: mixRGB(x.c, y.c, t),
    d: mixRGB(x.d, y.d, t),
    e: mixRGB(x.e, y.e, t),
  }
}

export function luminance([r, g, b]: RGB) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** 0 for light skies, 1 for a night sky (from the luminance of --wp-a). */
export function nightness(p: Palette) {
  return Math.min(1, Math.max(0, (0.62 - luminance(p.a)) / 0.45))
}
