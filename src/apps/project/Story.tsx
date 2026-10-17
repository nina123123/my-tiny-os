import type { CSSProperties, ReactNode } from 'react'
import { LangText } from '../../components/LangText'
import { Reveal } from '../../components/Reveal'
import type { Project, ProjectSection } from '../../content/types'
import { MotifSticker, Sticker, type StickerKind } from '../welcome/Stickers'
import { ZoomBadge } from './Gallery'
import { ratioOf } from './media'

/*
 * Story sections: alternating image / text when a section has a photo,
 * otherwise a roomy text column with a big soft numeral and a sticker.
 * Paragraphs that open with a quotation become pull quotes (a short tail
 * like "– Name" is its attribution; a longer tail continues as prose), and
 * paragraphs that start with an em dash are styled as citations.
 * Story photos are buttons that open the project's lightbox (`onOpenImage`).
 */

const CLOSE_FOR: Record<string, string> = { '"': '"', '“': '”', '„': '“', '«': '»' }
const ATTRIB = /^[—–-]\s|^\(/

/** Splits a paragraph that opens with a quotation into [quote, rest]. */
function splitQuote(p: string): [string, string] | null {
  const close = CLOSE_FOR[p[0]]
  if (!close) return null
  const end = p.indexOf(close, 1)
  if (end < 0) return null
  return [p.slice(0, end + 1), p.slice(end + 1).trim()]
}

function Paragraphs({ body }: { body: string }) {
  const paras = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  return (
    <>
      {paras.map((p, i) => {
        if (/^[—–]\s/.test(p)) {
          return (
            <p key={i} className="pd-cite">
              <LangText text={p} />
            </p>
          )
        }
        const q = splitQuote(p)
        if (q) {
          const [quote, rest] = q
          // a short tail like "– a coach" or "(my grandma)" is the quote's attribution
          const attribution = rest && (ATTRIB.test(rest) || rest.length < 40) ? rest : ''
          return (
            <div key={i} className="pd-quote-wrap">
              <blockquote className="pd-quote">
                <p>
                  <LangText text={quote} />
                </p>
                {attribution ? (
                  <footer className="pd-quote__by">
                    <LangText text={attribution.replace(/^[—–-]\s*/, '— ')} />
                  </footer>
                ) : null}
              </blockquote>
              {rest && !attribution ? (
                <p>
                  <LangText text={rest} />
                </p>
              ) : null}
            </div>
          )
        }
        return (
          <p key={i}>
            <LangText text={p} />
          </p>
        )
      })}
    </>
  )
}

const DOODLES: StickerKind[] = ['sparkle', 'flower', 'star', 'heart', 'cloud', 'sun']

function Heading({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="pd-sec__head">
      <span className="pd-sec__num" aria-hidden="true">
        {String(n).padStart(2, '0')}
      </span>
      <h3 className="pd-sec__title">{children}</h3>
    </div>
  )
}

function Section({
  s,
  n,
  side,
  doodle,
  polaroid,
  onOpenImage,
}: {
  s: ProjectSection
  n: number
  side: 'left' | 'right'
  doodle?: StickerKind
  polaroid?: { src: string; alt: string }
  onOpenImage?: (src: string) => void
}) {
  if (s.image) {
    const src = s.image
    const img = (
      <img src={src} alt={s.imageAlt ?? ''} loading="lazy" decoding="async" style={{ aspectRatio: ratioOf(src) } as CSSProperties} />
    )
    return (
      <Reveal as="section" className={`pd-sec pd-sec--media pd-sec--${side}`} y={28}>
        <figure className="pd-sec__figure">
          {onOpenImage ? (
            <button
              type="button"
              className="pd-sec__zoom"
              aria-label={s.imageAlt ? undefined : `Open photo ${n} larger`}
              onClick={() => onOpenImage(src)}
            >
              {img}
              {s.imageAlt ? <span className="sr-only"> (open larger)</span> : null}
              <ZoomBadge />
            </button>
          ) : (
            img
          )}
        </figure>
        <div className="pd-sec__text">
          <Heading n={n}>
            <LangText text={s.heading} />
          </Heading>
          <div className="pd-prose">
            <Paragraphs body={s.body} />
          </div>
        </div>
      </Reveal>
    )
  }
  return (
    <Reveal as="section" className={`pd-sec pd-sec--text${polaroid ? ' pd-sec--polaroid' : ''}`} y={24}>
      <span className="pd-sec__bignum" aria-hidden="true">
        {String(n).padStart(2, '0')}
      </span>
      {doodle ? <Sticker kind={doodle} size={40} className="pd-sec__doodle" bob delay={n * 0.7} tilt={n % 2 ? 10 : -8} /> : null}
      {polaroid ? (
        <figure className="pd-polaroid">
          <img src={polaroid.src} alt={polaroid.alt} loading="lazy" decoding="async" style={{ aspectRatio: ratioOf(polaroid.src) }} />
        </figure>
      ) : null}
      <div className="pd-sec__text">
        <Heading n={n}>
          <LangText text={s.heading} />
        </Heading>
        <div className="pd-prose">
          <Paragraphs body={s.body} />
        </div>
      </div>
    </Reveal>
  )
}

export function Story({ project, onOpenImage }: { project: Project; onOpenImage?: (src: string) => void }) {
  const { story } = project
  if (!story.length) return null
  // Projects with no story photos (and no gallery) borrow their cover as a
  // little polaroid next to the first section, so the page never feels bare.
  const photoless = !story.some((s) => s.image) && !project.gallery?.length
  let media = 0
  let text = 0
  return (
    <div className="pd-story">
      {story.map((s, i) => {
        const side = s.image ? (media++ % 2 === 0 ? 'left' : 'right') : 'left'
        const t = s.image ? -1 : text++
        const doodle = t >= 0 && t % 2 === 1 ? DOODLES[(t >> 1) % DOODLES.length] : undefined
        const polaroid = photoless && i === 0 && project.cover ? { src: project.cover, alt: project.coverAlt ?? '' } : undefined
        return (
          <div key={i} className="pd-story__item">
            {i > 0 ? (
              <span className="pd-link" aria-hidden="true">
                <MotifSticker fallback="sparkle" size={28} tilt={i % 2 ? 20 : -20} />
              </span>
            ) : null}
            <Section s={s} n={i + 1} side={side} doodle={doodle} polaroid={polaroid} onOpenImage={onOpenImage} />
          </div>
        )
      })}
    </div>
  )
}
