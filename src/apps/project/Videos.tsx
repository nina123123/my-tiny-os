import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { LangText } from '../../components/LangText'
import { responsiveProps } from '../../components/responsiveImage'
import type { ProjectVideo } from '../../content/types'
import { useWindows } from '../../os/store'
import { useReducedMotion } from '../../os/useMedia'

/*
 * YouTube videos: a strip of thumbnail cards. The player (privacy-enhanced
 * youtube-nocookie embed) is only loaded on click, one video at a time per
 * window. A video stops when its window is minimized or closed, or (phone)
 * when another sheet covers it.
 * A single video shows as one big poster that swaps into the player.
 * A video with a `poster` shows that local photo instead of YouTube's
 * thumbnail, so nothing is fetched from YouTube until someone presses play.
 */

const thumb = (id: string) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`
const embed = (id: string) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`

function PlayGlyph() {
  return (
    <span className="pd-vid__play" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22">
        <path d="M8.5 5.8v12.4a1 1 0 0 0 1.5.86l10-6.2a1 1 0 0 0 0-1.72l-10-6.2a1 1 0 0 0-1.5.86z" fill="currentColor" />
      </svg>
    </span>
  )
}

function Poster({ v, playing, big, colors, onPlay }: { v: ProjectVideo; playing: boolean; big?: boolean; colors: [string, string]; onPlay: () => void }) {
  const [failed, setFailed] = useState(false)
  return (
    <button
      type="button"
      className={`pd-vid${big ? ' pd-vid--big' : ''}${playing ? ' is-playing' : ''}${failed ? ' is-nothumb' : ''}`}
      aria-label={playing ? `${v.title} (playing)` : `Play video: ${v.title}`}
      aria-pressed={playing}
      style={{ '--va': colors[0], '--vb': colors[1] } as CSSProperties}
      onClick={onPlay}
    >
      <span className="pd-vid__thumb">
        {!failed ? (
          <img
            src={v.poster ?? thumb(v.youtubeId)}
            {...responsiveProps(v.poster, big ? '(max-width: 760px) 100vw, 720px' : '240px')}
            style={v.poster && v.posterFocus ? { objectPosition: v.posterFocus } : undefined}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : null}
        <span className="pd-vid__shade" aria-hidden="true" />
        {failed ? (
          <span className="pd-vid__yt" aria-hidden="true">
            youtube
          </span>
        ) : null}
        {playing ? (
          <span className="pd-vid__now" aria-hidden="true">
            <span className="pd-vid__bars">
              <i />
              <i />
              <i />
            </span>
            now playing
          </span>
        ) : (
          <PlayGlyph />
        )}
      </span>
      <span className="pd-vid__title">
        <LangText text={v.title} />
      </span>
    </button>
  )
}

/** The YouTube player. It leaves the moment its panel starts closing, so the sound stops at once. */
function Embed({ v }: { v: ProjectVideo }) {
  const present = useIsPresent()
  if (!present) return null
  return (
    <iframe
      src={embed(v.youtubeId)}
      title={v.title}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
}

export function Videos({
  videos,
  colors,
  windowId,
  isMobile,
}: {
  videos: ProjectVideo[]
  colors: [string, string]
  windowId: string
  isMobile: boolean
}) {
  const reduced = useReducedMotion()
  const [active, setActive] = useState<string | null>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const single = videos.length === 1
  const current = videos.find((v) => v.youtubeId === active)

  useEffect(() => {
    if (!active) return
    playerRef.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  }, [active, reduced])

  // stop when this window is minimized or closed, or (phone) covered by another sheet
  useEffect(() => {
    if (!active) return
    const check = (s = useWindows.getState()) => {
      const w = s.windows.find((x) => x.id === windowId)
      if (!w) return // not a managed window (dev harness); unmount stops it
      let top: (typeof s.windows)[number] | undefined
      for (const x of s.windows) if (!x.minimized && (!top || x.z > top.z)) top = x
      if (w.minimized || (isMobile && top?.id !== windowId)) setActive(null)
    }
    return useWindows.subscribe((s) => check(s))
  }, [active, windowId, isMobile])

  const play = (id: string) => setActive(id)
  const stop = () => setActive(null)

  return (
    <div className={`pd-vids${single ? ' pd-vids--single' : ''}`}>
      <AnimatePresence initial={false}>
        {current ? (
          <motion.div
            key="player"
            ref={playerRef}
            className="pd-player"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="pd-player__frame">
              <Embed key={current.youtubeId} v={current} />
            </div>
            <div className="pd-player__bar">
              <p className="pd-player__title">
                <span aria-hidden="true">▶ </span>
                <LangText text={current.title} />
              </p>
              <button type="button" className="pd-player__close" onClick={stop}>
                stop video
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {single ? (
        current ? null : (
          <Poster v={videos[0]} playing={false} big colors={colors} onPlay={() => play(videos[0].youtubeId)} />
        )
      ) : (
        <ul
          className="pd-vids__strip"
          role="list"
          // keep a keyboard-focused poster fully in view inside the sideways strip
          onFocus={(e) => (e.target as HTMLElement).scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })}
        >
          {videos.map((v) => (
            <li key={v.youtubeId}>
              <Poster v={v} playing={v.youtubeId === active} colors={colors} onPlay={() => play(v.youtubeId)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
