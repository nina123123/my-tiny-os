import { LangText } from '../../components/LangText'
import { Reveal } from '../../components/Reveal'
import { responsiveProps } from '../../components/responsiveImage'
import type { ProjectImage } from '../../content/types'
import { ratioOf } from './media'

/*
 * Masonry photo grid (CSS columns). Each photo is a button that opens the
 * lightbox at that index.
 */

/** The little magnifier badge on a photo that opens larger (gallery + story photos). */
export function ZoomBadge() {
  return (
    <span className="pd-photo__zoom" aria-hidden="true">
      <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="8.5" cy="8.5" r="5.5" />
        <path d="M13 13l4 4M8.5 6v5M6 8.5h5" />
      </svg>
    </span>
  )
}

export function Gallery({ images, onOpen }: { images: ProjectImage[]; onOpen: (i: number) => void }) {
  return (
    <ul className="pd-gallery" role="list">
      {images.map((im, i) => (
        <li key={im.src + i} className="pd-gallery__item">
          <Reveal y={20} delay={(i % 3) * 70}>
            <button
              type="button"
              className="pd-photo"
              onClick={() => onOpen(i)}
            >
              <img
                src={im.src}
                {...responsiveProps(im.src, '(max-width: 767px) 50vw, 300px')}
                alt={im.alt}
                loading="lazy"
                decoding="async"
                style={{ aspectRatio: ratioOf(im.src) }}
              />
              <span className="sr-only"> (open larger)</span>
              <ZoomBadge />
            </button>
            {im.caption ? (
              <p className="pd-photo__caption">
                <LangText text={im.caption} />
              </p>
            ) : null}
          </Reveal>
        </li>
      ))}
    </ul>
  )
}
