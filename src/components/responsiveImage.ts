import { PHOTO_WIDTHS } from './photoWidths'

/*
 * Responsive photos. scripts/resize-photos.py writes a 640px copy
 * (<name>-640.webp) next to every photo in public/media and lists them in
 * ./photoWidths.ts. Small thumbnails offer both files through srcset so a
 * 200px tile doesn't download a 1600px photo; heroes and the lightbox keep
 * using the plain `src`.
 */

export const SMALL_PHOTO = 640

const keyOf = (src: string) => src.replace(/^\.?\/?media\//, '')

/** `media/x/cover.webp` → `media/x/cover-640.webp` */
export const smallPhoto = (src: string) => src.replace(/\.webp$/, `-${SMALL_PHOTO}.webp`)

/**
 * srcset for a photo in public/media, or undefined when it has no small copy
 * (not generated yet, or already 640px wide or less).
 */
export function srcSetOf(src: string | undefined): string | undefined {
  if (!src || !src.endsWith('.webp')) return undefined
  const width = PHOTO_WIDTHS[keyOf(src)]
  if (!width || width <= SMALL_PHOTO) return undefined
  return `${smallPhoto(src)} ${SMALL_PHOTO}w, ${src} ${width}w`
}

/** Props to spread on an <img>: srcSet + sizes when a small copy exists. */
export function responsiveProps(src: string | undefined, sizes: string | undefined) {
  const srcSet = sizes ? srcSetOf(src) : undefined
  return srcSet ? { srcSet, sizes } : {}
}

/**
 * onError helper: if the small copy is missing (e.g. deleted), drop srcset so
 * the browser falls back to the full photo. Returns true when it retried.
 */
export function retryWithoutSrcSet(img: HTMLImageElement): boolean {
  if (!img.srcset) return false
  img.removeAttribute('srcset')
  img.removeAttribute('sizes')
  return true
}
