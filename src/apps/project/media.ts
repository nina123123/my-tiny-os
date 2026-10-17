/*
 * Intrinsic sizes of the photos in public/media, so images can reserve their
 * aspect ratio before they load (no layout shift). Add a line per photo when
 * you add photos; photos missing from this map fall back to a sensible default ratio.
 */
const SIZES: Record<string, [number, number]> = {
  // 'my-project/cover.webp': [1600, 1067], (path under public/media → [width, height] in px)
}

/** width / height of a media path like "media/my-project/g1.webp" (or the fallback). */
export function ratioOf(src: string | undefined, fallback = 4 / 3): number {
  if (!src) return fallback
  const key = src.replace(/^\.?\/?media\//, '')
  const s = SIZES[key]
  return s ? s[0] / s[1] : fallback
}

/** True when we know the size of this photo. */
export const hasSize = (src: string | undefined) => !!src && src.replace(/^\.?\/?media\//, '') in SIZES
