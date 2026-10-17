import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useId, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { LangText } from '../../components/LangText'
import { Reveal } from '../../components/Reveal'
import { responsiveProps } from '../../components/responsiveImage'
import { profile } from '../../content/profile'
import { isAppOn } from '../../os/apps'
import { rectOf } from '../../os/anchors'
import { useWindows } from '../../os/store'
import type { AppId, AppProps } from '../../os/types'
import { useFinePointer, useReducedMotion } from '../../os/useMedia'
import { Lightbox } from '../project/Lightbox'
import { DrawnAvatar, MotifSticker, MotifText, Sticker, type StickerKind } from '../welcome/Stickers'
import './about.css'

/*
 * About Me: a scroll story. Hero → intro bubbles → the superpower moment →
 * polaroids → "people describe me as" stickers → bio → flip-card fun facts
 * → say hi. ("currently" lives in the desktop and phone home widgets.)
 */

const PASTELS = ['var(--lavender-200)', 'var(--peach-200)', 'var(--butter-200)', 'var(--mint-200)', 'var(--pink-200)', 'var(--sky-200)']
const INKS = ['var(--lavender-500)', 'var(--coral-500)', 'var(--butter-400)', 'var(--mint-400)', 'var(--pink-300)', 'var(--sky-300)']
const TILTS = [-6, 4, -3, 7, -5, 3, -2, 5]
const DOODLES: StickerKind[] = ['star', 'heart', 'sparkle', 'flower', 'sun', 'cloud', 'moon', 'star']

/** A nickname in brackets gets italics: "Sam (Sunny) Lee" → Sam <em>(Sunny)</em> Lee */
function FancyName({ name }: { name: string }) {
  const parts = name.split(/(\([^)]*\))/)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <em key={i} className="ab-name__nick">
            {part}
          </em>
        ) : (
          part
        ),
      )}
    </>
  )
}

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Splits "to 🔧 build things that…" into its big word (profile.motif's) and the rest; null without a motif. */
function splitSuperpower(text: string) {
  const motif = profile.motif
  if (!motif) return null
  const m = text.match(new RegExp(`^(.*?)(?:${escape(motif.emoji)}\\s*)?(${escape(motif.word)})\\b[,.!]?\\s*(.*)$`, 'iu'))
  if (!m) return null
  return { lead: m[1].trim(), emoji: motif.emoji, word: m[2], rest: m[3].trim() }
}

/**
 * Front of a fun-fact card when the fact has no hand-written `front`: its first
 * sentence when that's short, else its first words (cut at a word boundary).
 */
function teaser(text: string, max = 80) {
  const first = text.match(/^.+?[.!?](?=\s|$)/)?.[0]
  if (first && first.length <= 90) return first
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,.;:!?]$/, '')}…`
}

type Fact = (typeof profile.funFacts)[number]

function SectionHead({ kicker, title, id, children }: { kicker: string; title: ReactNode; id: string; children?: ReactNode }) {
  return (
    <Reveal className="ab-head" y={14}>
      <p className="kicker">{kicker}</p>
      <h2 id={id} className="ab-head__title">
        {title}
      </h2>
      {children}
    </Reveal>
  )
}

function FunFact({ fact, n, verb }: { fact: Fact; n: number; verb: 'click' | 'tap' }) {
  const [flipped, setFlipped] = useState(false)
  const textId = useId()
  const text = typeof fact === 'string' ? fact : fact.back
  const front = typeof fact === 'string' ? teaser(fact) : fact.front
  const tint = PASTELS[n % PASTELS.length]
  return (
    <li className="ab-fact" style={{ '--tint': tint, '--ink-tint': INKS[n % INKS.length], '--tilt': `${TILTS[n % TILTS.length] * 0.25}deg` } as CSSProperties}>
      <button
        type="button"
        className={`ab-fact__card${flipped ? ' is-flipped' : ''}`}
        aria-pressed={flipped}
        aria-label={`Fun fact ${n + 1}`}
        aria-describedby={textId}
        onClick={() => setFlipped((f) => !f)}
      >
        <span className="ab-fact__face ab-fact__front" aria-hidden="true">
          <span className="ab-fact__num">{String(n + 1).padStart(2, '0')}</span>
          <span className="ab-fact__label">fun fact</span>
          <span className="ab-fact__tease">
            <LangText text={front} />
          </span>
          <span className="ab-fact__hint">{verb} to flip ↻</span>
          <Sticker kind={DOODLES[n % DOODLES.length]} size={34} className="ab-fact__doodle" tilt={TILTS[n % TILTS.length] * 2} />
        </span>
        <span className="ab-fact__face ab-fact__back" aria-hidden="true">
          <span className="ab-fact__label">fun fact {String(n + 1).padStart(2, '0')}</span>
          <span className="ab-fact__text">
            <LangText text={text} />
          </span>
        </span>
      </button>
      <p id={textId} className="sr-only">
        <LangText text={text} />
      </p>
    </li>
  )
}

function Wiggle({ word, i }: { word: string; i: number }) {
  const [poke, setPoke] = useState(0)
  return (
    <motion.li
      className="ab-word"
      style={{ '--tint': PASTELS[i % PASTELS.length], '--tilt': `${TILTS[i % TILTS.length]}deg` } as CSSProperties}
      initial={{ opacity: 0, scale: 0.4, rotate: -20 }}
      whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ type: 'spring', stiffness: 380, damping: 14, delay: i * 0.11 }}
      onClick={() => setPoke((n) => n + 1)}
    >
      <span key={poke} className={`ab-word__sticker${poke ? ' is-poked' : ''}`}>
        {word}
      </span>
    </motion.li>
  )
}

export default function App({ isMobile }: AppProps) {
  const reduced = useReducedMotion()
  const verb = useFinePointer() ? 'click' : 'tap'
  const [photo, setPhoto] = useState<number | null>(null)
  const uid = useId()
  const photos = profile.photos ?? []
  const power = profile.superpower ? splitSuperpower(profile.superpower) : null
  const initial = profile.firstName.slice(0, 1).toUpperCase()

  const open = (appId: AppId) => (e: MouseEvent<HTMLElement>) => {
    useWindows.getState().open(appId, { origin: rectOf(e.currentTarget) ?? undefined })
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className={`ab${isMobile ? ' ab--mobile' : ''}`}>
        <div className="ab-scroll" inert={photo !== null}>
          {/* ── hero ─────────────────────────────────────────── */}
          <header className="ab-hero">
            <span className="ab-hero__glow" aria-hidden="true" />
            <motion.div
              className="ab-avatar"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7, rotate: -12 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 16 }}
            >
              <span className="ab-avatar__ring" aria-hidden="true" />
              {profile.avatar ? (
                <img className="ab-avatar__img" src={profile.avatar} alt={profile.avatarAlt ?? `Photo of ${profile.firstName}`} width={160} height={160} decoding="async" />
              ) : (
                <DrawnAvatar initial={initial} size={150} />
              )}
              <span className="ab-avatar__wave" aria-hidden="true">
                👋
              </span>
              <Sticker kind="sparkle" size={30} className="ab-avatar__spark" bob delay={0.6} />
            </motion.div>

            <motion.div
              className="ab-hero__text"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24, delay: 0.1 }}
            >
              <p className="kicker ab-hero__kicker">about me</p>
              <h1 className="ab-name">
                <FancyName name={profile.fullName} />
              </h1>
              <ul className="ab-facts" role="list" aria-label="Quick facts">
                {profile.origin ? (
                  <li className="ab-pill">
                    <span className="ab-pill__k">from</span> {profile.origin}
                  </li>
                ) : null}
                {profile.location ? (
                  <li className="ab-pill">
                    <span className="ab-pill__k">now</span> {profile.location}
                  </li>
                ) : null}
              </ul>
              <p className="ab-tagline">{profile.tagline}</p>
              {profile.languages?.length ? (
                <div className="ab-langs">
                  <span className="ab-langs__k" id={`${uid}-langs`}>
                    i speak
                  </span>
                  <ul className="ab-langs__list" role="list" aria-labelledby={`${uid}-langs`}>
                    {profile.languages.map((l, i) => (
                      <li key={l} className="ab-lang" style={{ '--tint': PASTELS[(i + 1) % PASTELS.length] } as CSSProperties}>
                        <LangText text={l} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </motion.div>
          </header>

          {/* ── intro bubbles ───────────────────────────────── */}
          {profile.intro?.length ? (
            <section className="ab-sec ab-intro" aria-label="Hello">
              <ol className="ab-bubbles" role="list">
                {profile.intro.map((line, i) => (
                  <Reveal as="li" key={i} className="ab-bubble" delay={i * 140} y={14} scale={0.96}>
                    <MotifText text={line} />
                  </Reveal>
                ))}
              </ol>
            </section>
          ) : null}

          {/* ── the superpower moment ───────────────────────── */}
          {profile.superpower ? (
            <section className="ab-sec" aria-labelledby={`${uid}-power`}>
              <Reveal className="ab-power" y={30} scale={0.97}>
                <span className="ab-power__bg" aria-hidden="true" />
                <p className="ab-power__kicker" id={`${uid}-power`}>
                  my superpower is{power?.lead ? ` ${power.lead}` : ''}…
                </p>
                {power ? (
                  <>
                    <p className="ab-power__word">
                      <span className="ab-power__emoji" aria-hidden="true">
                        {power.emoji}
                      </span>
                      <span className="ab-power__text">{power.word.toLowerCase()}</span>
                    </p>
                    {power.rest ? <p className="ab-power__rest hand">{power.rest}</p> : null}
                  </>
                ) : (
                  <p className="ab-power__rest hand">
                    <MotifText text={profile.superpower} />
                  </p>
                )}
                <Sticker kind="star" size={40} className="ab-power__st ab-power__st--a" bob tilt={12} />
                <Sticker kind="heart" size={34} className="ab-power__st ab-power__st--b" bob delay={1.6} tilt={-10} />
                <Sticker kind="sparkle" size={30} className="ab-power__st ab-power__st--c" bob delay={2.8} />
              </Reveal>
            </section>
          ) : null}

          {/* ── polaroids ────────────────────────────────────── */}
          {photos.length ? (
            <section className="ab-sec" aria-labelledby={`${uid}-photos`}>
              <SectionHead kicker={`${photos.length} snapshots`} title="a few pictures of me" id={`${uid}-photos`}>
                <p className="ab-head__note hand" aria-hidden="true">
                  {verb} one to look closer!
                </p>
              </SectionHead>
              <ul
                className="ab-polas"
                role="list"
                // keep a keyboard-focused polaroid fully in view inside the sideways scroller
                onFocus={(e) => (e.target as HTMLElement).scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })}
              >
                {photos.map((ph, i) => (
                  <li key={ph.src} className="ab-pola" style={{ '--tilt': `${TILTS[i % TILTS.length]}deg` } as CSSProperties}>
                    <Reveal y={26} delay={(i % 3) * 90}>
                      <button type="button" className="ab-pola__btn" onClick={() => setPhoto(i)}>
                        <span className="ab-pola__tape" aria-hidden="true" />
                        <img
                          src={ph.src}
                          {...responsiveProps(ph.src, '240px')}
                          alt={ph.alt}
                          loading="lazy"
                          decoding="async"
                          style={ph.focus ? { objectPosition: ph.focus } : undefined}
                        />
                        {ph.caption ? <span className="ab-pola__cap hand">{ph.caption}</span> : null}
                        <span className="sr-only"> (open larger)</span>
                      </button>
                    </Reveal>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* ── people describe me as ────────────────────────── */}
          {profile.describedAs.length ? (
            <section className="ab-sec ab-words-sec" aria-labelledby={`${uid}-words`}>
              <SectionHead kicker="according to my friends" title="people describe me as" id={`${uid}-words`} />
              <ul className="ab-words" role="list">
                {profile.describedAs.map((w, i) => (
                  <Wiggle key={w} word={w} i={i} />
                ))}
              </ul>
            </section>
          ) : null}

          {/* ── bio ──────────────────────────────────────────── */}
          {profile.bio.length ? (
            <section className="ab-sec" aria-labelledby={`${uid}-bio`}>
              <SectionHead kicker="the longer version" title="my story" id={`${uid}-bio`} />
              <div className="ab-bio">
                {profile.bio.map((para, i) => (
                  <Reveal as="p" key={i} y={18} delay={60}>
                    {para}
                  </Reveal>
                ))}
              </div>
            </section>
          ) : null}

          {/* ── fun facts ────────────────────────────────────── */}
          {profile.funFacts.length ? (
            <section className="ab-sec" aria-labelledby={`${uid}-facts`}>
              <SectionHead kicker={`${profile.funFacts.length} cards · ${verb} to flip`} title="fun facts" id={`${uid}-facts`} />
              <ul className="ab-factgrid" role="list">
                {profile.funFacts.map((f, i) => (
                  <FunFact key={i} fact={f} n={i} verb={verb} />
                ))}
              </ul>
            </section>
          ) : null}

          {/* ── say hi ───────────────────────────────────────── */}
          <section className="ab-sec ab-end" aria-labelledby={`${uid}-end`}>
            <Reveal className="ab-end__card" y={22}>
              <MotifSticker fallback="heart" size={52} className="ab-end__sticker" bob tilt={-14} />
              <h2 id={`${uid}-end`} className="ab-end__title">
                thanks for stopping by!
              </h2>
              <p className="ab-end__text">
                {isAppOn('guestbook')
                  ? 'thanks for reading all the way down here. say hi, or leave a little note in my guestbook.'
                  : 'thanks for reading all the way down here. come say hi anytime.'}
              </p>
              {isAppOn('contact') || isAppOn('guestbook') ? (
                <div className="ab-end__actions">
                  {isAppOn('contact') ? (
                    <button type="button" className="btn btn--accent ab-end__btn" onClick={open('contact')}>
                      say hi <span aria-hidden="true">→</span>
                    </button>
                  ) : null}
                  {isAppOn('guestbook') ? (
                    <button type="button" className="btn ab-end__btn" onClick={open('guestbook')}>
                      sign my guestbook <span aria-hidden="true">✍️</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </Reveal>
          </section>
        </div>

        <AnimatePresence>
          {photo !== null ? (
            <Lightbox
              key="lbx"
              images={photos}
              index={photo}
              onIndex={setPhoto}
              onClose={() => setPhoto(null)}
              label={`Photos of ${profile.firstName}`}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}
