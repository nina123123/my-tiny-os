import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useBackDismiss } from '../../lib/useBackDismiss'
import { useReducedMotion } from '../../os/useMedia'
import { ratioOf } from './media'
import './lightbox.css'

/*
 * Accessible photo lightbox, rendered INSIDE the app (absolute, over the
 * app's scroll area) so it belongs to its window. Arrows / ←→ keys / swipe
 * to move, Esc or the × to close, focus is trapped while open and handed
 * back to whatever opened it.
 *
 * In a phone sheet it moves up into the sheet's panel so the photo covers the
 * sheet header too (its "‹ back" would otherwise close the whole app), and the
 * phone's back gesture closes the photo first (useBackDismiss).
 *
 * The parent should make its scroll area `inert` while this is open.
 */

export type LightboxImage = { src: string; alt: string; caption?: string }

type Props = {
  images: LightboxImage[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
  /** Accessible name of the dialog, e.g. "Photos from Robot Rally" */
  label: string
}

const SWIPE = 60

export function Lightbox({ images, index, onIndex, onClose, label }: Props) {
  const reduced = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  // Grab the opener during render: by the time effects run, the parent has made
  // its scroll area inert, which already blurred the button that opened us.
  const [opener] = useState<Element | null>(() => (typeof document === 'undefined' ? null : document.activeElement))
  const [dir, setDir] = useState(0)
  const captionId = useId()
  const count = images.length
  const img = images[index]
  const close = useBackDismiss(onClose)

  // Where to render: the phone sheet's panel (covers its header), else in place.
  // undefined = not measured yet (first layout pass, before paint).
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [host, setHost] = useState<HTMLElement | null | undefined>(undefined)
  useLayoutEffect(() => {
    setHost(anchorRef.current?.closest<HTMLElement>('.msheet__panel') ?? null)
  }, [])
  const ready = host !== undefined

  // focus the close button once the viewer is in the DOM
  useEffect(() => {
    if (ready) closeRef.current?.focus({ preventScroll: true })
  }, [ready])

  // give focus back to the opener on close
  useEffect(() => {
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) {
        // wait a frame so the parent's `inert` is gone before focusing back
        requestAnimationFrame(() => opener.focus({ preventScroll: true }))
      }
    }
  }, [opener])

  const go = (step: number) => {
    if (count < 2) return
    setDir(step)
    onIndex((index + step + count) % count)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(-1)
    } else if (e.key === 'Tab') {
      // focus trap
      const nodes = rootRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"])')
      if (!nodes || !nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE || info.velocity.x < -500) go(1)
    else if (info.offset.x > SWIPE || info.velocity.x > 500) go(-1)
  }

  const anchor = <span ref={anchorRef} className="lbx__anchor" hidden />
  if (!img || !ready) return anchor
  const ratio = ratioOf(img.src, 4 / 3)

  const viewer = (
    <motion.div
      ref={rootRef}
      className={`lbx${host ? ' lbx--sheet' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onKeyDown={onKeyDown}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.12 : 0.22 }}
    >
      <button type="button" className="lbx__scrim" tabIndex={-1} aria-hidden="true" onClick={close} />

      {/* what changed, in words: "2 of 8: <alt>. <caption>" */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {`${index + 1} of ${count}: ${img.alt}${img.caption ? `. ${img.caption}` : ''}`}
      </p>

      <div className="lbx__top">
        <span className="lbx__count" aria-hidden="true">
          {index + 1} / {count}
        </span>
        <button ref={closeRef} type="button" className="lbx__btn lbx__close" aria-label="Close photo viewer" onClick={close}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </button>
      </div>

      <div className="lbx__stage">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.figure
            key={img.src}
            className="lbx__figure"
            custom={dir}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: dir * 80, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: dir * -80, scale: 0.96 }}
            transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 320, damping: 32 }}
            drag={count > 1 && !reduced ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.55}
            onDragEnd={onDragEnd}
            // reduced motion: the photo doesn't follow the finger, but a swipe still turns the page
            onPanEnd={count > 1 && reduced ? onDragEnd : undefined}
          >
            <img
              className="lbx__img"
              src={img.src}
              alt={img.alt}
              draggable={false}
              decoding="async"
              style={{ aspectRatio: ratio }}
              aria-describedby={img.caption ? captionId : undefined}
            />
            {img.caption ? (
              <figcaption id={captionId} className="lbx__caption">
                {img.caption}
              </figcaption>
            ) : null}
          </motion.figure>
        </AnimatePresence>
      </div>

      {count > 1 ? (
        <>
          <button type="button" className="lbx__btn lbx__nav lbx__nav--prev" aria-label="Previous photo" onClick={() => go(-1)}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3L5 8l5 5" />
            </svg>
          </button>
          <button type="button" className="lbx__btn lbx__nav lbx__nav--next" aria-label="Next photo" onClick={() => go(1)}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3l5 5-5 5" />
            </svg>
          </button>
          <div className="lbx__dots" aria-hidden="true">
            {images.map((im, i) => (
              <span key={im.src + i} className={`lbx__dot${i === index ? ' is-on' : ''}`} />
            ))}
          </div>
        </>
      ) : null}
    </motion.div>
  )

  return (
    <>
      {anchor}
      {host ? createPortal(viewer, host) : viewer}
    </>
  )
}
