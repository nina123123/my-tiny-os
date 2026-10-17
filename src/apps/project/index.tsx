import { AnimatePresence, motion, MotionConfig, useScroll, useTransform } from 'motion/react'
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { CountUp } from '../../components/CountUp'
import { CoverArt } from '../../components/CoverArt'
import { LangText } from '../../components/LangText'
import { Reveal } from '../../components/Reveal'
import { getProject } from '../../content/projects'
import type { Project, ProjectImage } from '../../content/types'
import { rectOf } from '../../os/anchors'
import { useWindows } from '../../os/store'
import type { AppProps } from '../../os/types'
import { useFinePointer, useReducedMotion } from '../../os/useMedia'
import { CategoryChip } from '../projects/CategoryChip'
import { categoryOf, fold, nextProject, openProject, yearLabel } from '../projects/shared'
import { Sticker } from '../welcome/Stickers'
import { Gallery } from './Gallery'
import { Lightbox } from './Lightbox'
import { Story } from './Story'
import { Videos } from './Videos'
import './project.css'

/*
 * One project, as a long scrolling story: hero with parallax cover, stats,
 * story sections, videos, a masonry gallery with a lightbox, links, and a
 * "next project →" card that opens the next one in its own window.
 */

const TINTS = ['var(--lavender-200)', 'var(--peach-200)', 'var(--butter-200)', 'var(--mint-200)', 'var(--pink-200)', 'var(--sky-200)']

function SectionTitle({ kicker, title, id }: { kicker: string; title: string; id: string }) {
  return (
    <div className="pd-block__head">
      <p className="kicker">{kicker}</p>
      <h2 id={id} className="pd-block__title">
        {title}
      </h2>
    </div>
  )
}

function NotFound({ id }: { id: string }) {
  return (
    <div className="pd pd--empty">
      <div className="pd-missing">
        <div className="pd-missing__art" aria-hidden="true">
          <Sticker kind="cloud" size={110} bob tilt={-4} />
          <span className="pd-missing__bubble">🫧</span>
        </div>
        <h2 className="pd-missing__title">hmm, this project floated away</h2>
        <p className="pd-missing__text">
          i couldn&rsquo;t find {id ? <code>{id}</code> : 'that one'}. it might have been renamed, or it&rsquo;s still in my drafts.
        </p>
        <button
          type="button"
          className="btn btn--accent pd-missing__btn"
          onClick={(e) => useWindows.getState().open('projects', { origin: rectOf(e.currentTarget) ?? undefined })}
        >
          browse all projects →
        </button>
      </div>
    </div>
  )
}

/**
 * Every photo of a project for the lightbox: the story's photos in reading
 * order, then the gallery's others (de-duplicated by src). `more` is what the
 * gallery grid still has to show after the story.
 */
function photosOf(p: Project): { all: ProjectImage[]; more: ProjectImage[] } {
  const gallery = new Map((p.gallery ?? []).map((g) => [g.src, g]))
  const seen = new Set<string>()
  const story: ProjectImage[] = []
  for (const s of p.story) {
    if (!s.image || seen.has(s.image)) continue
    seen.add(s.image)
    story.push(gallery.get(s.image) ?? { src: s.image, alt: s.imageAlt ?? '' })
  }
  const more: ProjectImage[] = []
  for (const g of p.gallery ?? []) {
    if (seen.has(g.src)) continue
    seen.add(g.src)
    more.push(g)
  }
  return { all: [...story, ...more], more }
}

function Detail({ p, windowId, isMobile }: { p: Project; windowId: string; isMobile: boolean }) {
  const reduced = useReducedMotion()
  const verb = useFinePointer() ? 'click' : 'tap'
  const scrollRef = useRef<HTMLDivElement>(null)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const photos = useMemo(() => photosOf(p), [p])
  const openPhoto = (src: string) => {
    const i = photos.all.findIndex((x) => x.src === src)
    if (i >= 0) setLightbox(i)
  }
  const uid = useId()
  const cat = categoryOf(p)
  const year = yearLabel(p)
  const next = nextProject(p.id)

  // keep the window title in sync (e.g. when opened from a deep link without a title)
  useEffect(() => {
    const w = useWindows.getState().windows.find((x) => x.id === windowId)
    if (w && w.title !== p.title) useWindows.getState().setTitle(windowId, p.title)
  }, [windowId, p.title])

  // hero parallax: the cover drifts up a little as the page scrolls. At rest the
  // frame starts at the very top of the photo (heads stay in), and the bleed
  // below (see .pd-hero__img) covers the drift.
  const { scrollY } = useScroll({ container: scrollRef })
  const coverY = useTransform(scrollY, [0, 320], ['0%', '-8%'], { clamp: true })
  const coverScale = useTransform(scrollY, [0, 320], [1.02, 1.1], { clamp: true })

  // the role chip, unless the subtitle right above already says it ("Note-taker" twice)
  const roleShown = p.role && !(p.subtitle && fold(p.subtitle).includes(fold(p.role))) ? p.role : ''
  const metaBits = [year, roleShown].filter(Boolean) as string[]

  return (
    <div className={`pd${isMobile ? ' pd--mobile' : ''}`} style={{ '--pa': p.colors[0], '--pb': p.colors[1], '--chip': cat?.color } as CSSProperties}>
      <motion.div ref={scrollRef} className="pd-scroll" inert={lightbox !== null}>
        <header className="pd-hero">
          <div className="pd-hero__media">
            <motion.div className="pd-hero__img" style={reduced ? undefined : { y: coverY, scale: coverScale }}>
              <CoverArt colors={p.colors} emoji={p.emoji} src={p.cover} alt={p.coverAlt ?? ''} seed={p.id} focus={p.coverFocus} />
            </motion.div>
            <span className="pd-hero__veil" aria-hidden="true" />
          </div>

          <motion.div
            className="pd-hero__card"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26, delay: 0.08 }}
          >
            <span className="pd-hero__emoji" aria-hidden="true">
              {p.emoji}
            </span>
            {p.placeholder ? <span className="wk-draft pd-hero__draft">draft</span> : null}
            <h1 className="pd-title">{p.title}</h1>
            {p.subtitle ? <p className="pd-sub">{p.subtitle}</p> : null}
            <div className="pd-meta">
              {metaBits.map((m, i) => (
                <span key={i} className="pd-meta__bit">
                  {m}
                </span>
              ))}
              <CategoryChip category={cat} />
            </div>
            <p className="pd-lead">
              <LangText text={p.summary} />
            </p>
          </motion.div>
        </header>

        {p.placeholder ? (
          <p className="pd-banner" role="note">
            <span aria-hidden="true">✏️</span> this one&rsquo;s still a draft. the full story is coming soon!
          </p>
        ) : null}

        {p.stats?.length ? (
          <section className="pd-block pd-stats-wrap" aria-labelledby={`${uid}-stats`}>
            <h2 id={`${uid}-stats`} className="sr-only">
              By the numbers
            </h2>
            <ul className={`pd-stats pd-stats--n${Math.min(p.stats.length, 4)}`} role="list">
              {p.stats.map((s, i) => {
                const len = `${s.prefix ?? ''}${s.value.toLocaleString()}${s.suffix ?? ''}`.length
                return (
                <Reveal
                  as="li"
                  key={s.label}
                  className={`pd-stat${len > 8 ? ' pd-stat--xlong' : len > 4 ? ' pd-stat--long' : ''}`}
                  delay={i * 90}
                  y={16}
                  style={{ '--tint': TINTS[i % TINTS.length] } as CSSProperties}
                >
                  <CountUp to={s.value} prefix={s.prefix} suffix={s.suffix} className="pd-stat__num" />
                  <span className="pd-stat__label">{s.label}</span>
                </Reveal>
                )
              })}
            </ul>
          </section>
        ) : null}

        <Story project={p} onOpenImage={openPhoto} />

        {p.videos?.length ? (
          <section className="pd-block" aria-labelledby={`${uid}-videos`}>
            <SectionTitle id={`${uid}-videos`} kicker={p.videos.length === 1 ? '1 video' : `${p.videos.length} videos`} title="watch" />
            <Videos videos={p.videos} colors={p.colors} windowId={windowId} isMobile={isMobile} />
          </section>
        ) : null}

        {photos.more.length ? (
          <section className="pd-block" aria-labelledby={`${uid}-photos`}>
            <SectionTitle
              id={`${uid}-photos`}
              kicker={`${photos.more.length} ${photos.more.length === 1 ? 'photo' : 'photos'} · ${verb} to look closer`}
              title={photos.all.length > photos.more.length ? 'more photos' : 'photos'}
            />
            <Gallery images={photos.more} onOpen={(i) => setLightbox(photos.all.length - photos.more.length + i)} />
          </section>
        ) : null}

        {p.links?.length || p.tags.length ? (
          <section className="pd-block pd-block--links" aria-labelledby={`${uid}-links`}>
            <SectionTitle id={`${uid}-links`} kicker="dig deeper" title={p.links?.length ? 'links' : 'tags'} />
            {p.links?.length ? (
              <ul className="pd-links" role="list">
                {p.links.map((l) => (
                  <li key={l.href}>
                    <a className="pd-linkpill" href={l.href} target="_blank" rel="noopener noreferrer">
                      <span>{l.label}</span>
                      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 11l6-6M6 5h5v5" />
                      </svg>
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {p.tags.length ? (
              <ul className="pd-tags" role="list" aria-label="Tags">
                {p.tags.map((t) => (
                  <li key={t} className="pd-tag">
                    #{t}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {next ? (
          <footer className="pd-next-wrap">
            <Reveal y={20}>
              <button
                type="button"
                className="pd-next"
                style={{ '--chip': categoryOf(next)?.color } as CSSProperties}
                onClick={(e) => {
                  openProject(next, e.currentTarget)
                  // phone: swap this sheet for the next one instead of stacking
                  // (one back still returns to wherever you came from)
                  if (isMobile) useWindows.getState().close(windowId)
                }}
              >
                <span className="pd-next__thumb">
                  <CoverArt colors={next.colors} emoji={next.emoji} src={next.cover} seed={next.id} focus={next.coverFocus} sizes="128px" />
                </span>
                <span className="pd-next__text">
                  <span className="pd-next__kicker">next project →</span>
                  <span className="pd-next__title">
                    <span aria-hidden="true">{next.emoji} </span>
                    {next.title}
                  </span>
                  <CategoryChip category={categoryOf(next)} />
                </span>
                <span className="pd-next__arrow" aria-hidden="true">
                  →
                </span>
              </button>
            </Reveal>
          </footer>
        ) : null}
      </motion.div>

      <AnimatePresence>
        {lightbox !== null && photos.all.length ? (
          <Lightbox
            key="lbx"
            images={photos.all}
            index={lightbox}
            onIndex={setLightbox}
            onClose={() => setLightbox(null)}
            label={`Photos from ${p.title}`}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default function App({ windowId, params, isMobile }: AppProps) {
  const id = typeof params.projectId === 'string' ? params.projectId : ''
  const p = id ? getProject(id) : undefined
  return (
    <MotionConfig reducedMotion="user">
      {p ? <Detail key={p.id} p={p} windowId={windowId} isMobile={isMobile} /> : <NotFound id={id} />}
    </MotionConfig>
  )
}
