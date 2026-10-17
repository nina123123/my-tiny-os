import { AnimatePresence, motion } from 'motion/react'
import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { CoverArt } from '../../components/CoverArt'
import type { Project } from '../../content/types'
import { CategoryChip } from './CategoryChip'
import { categoryOf, openProject, yearLabel, type BentoItem } from './shared'
import { useTilt } from './tilt'

/*
 * Bento grid: featured projects get big 2×2 tiles that alternate sides,
 * each followed by two small tiles (see bentoLayout). A list of only featured
 * projects becomes a two-up "duo" grid, and the last row is always filled
 * (one tile in it stretches), so no view leaves empty cells. Filtering
 * animates the re-layout with motion's layout animations.
 */

/**
 * Live column count of the grid: its `--cols`, which container queries (width)
 * and the duo class set. Read from the variable rather than the track list, so
 * a stretched tile's implicit tracks can't feed back into the count.
 */
function useGridCols(ref: RefObject<HTMLElement | null>, fallback = 3) {
  const [cols, setCols] = useState(fallback)
  const read = () => {
    const el = ref.current
    if (!el) return
    const n = parseInt(getComputedStyle(el).getPropertyValue('--cols'), 10)
    if (n > 0) setCols(n) // same value → React skips the re-render
  }
  // after every commit: the class (duo or not) may have changed the count
  useLayoutEffect(read)
  // and whenever the grid's width changes (container queries)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => read())
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref])
  return cols
}

/*
 * Width the cover photo is drawn at, for <img sizes> (picks the 640px copy
 * when that's enough). Covers are object-fit: cover, so a big (or stretched)
 * tile on desktop, ~480px tall, draws a landscape photo ~780px wide.
 */
const SIZES_BIG = '(max-width: 767px) 92vw, 780px'
const SIZES_SMALL = '(max-width: 767px) 46vw, 21vw'

function Tile({
  p,
  big,
  wide = false,
  banner = false,
  tiltOn,
}: {
  p: Project
  big: boolean
  wide?: boolean
  /** stretched over 3+ columns: photo beside the text, with room for the summary */
  banner?: boolean
  tiltOn: boolean
}) {
  const cat = categoryOf(p)
  const year = yearLabel(p)
  const tilt = useTilt(tiltOn, big ? 6 : 10)

  return (
    <button
      type="button"
      className={`pj-tile${big ? ' pj-tile--big' : ''}`}
      style={{ '--chip': cat?.color ?? 'var(--lavender-300)' } as CSSProperties}
      onClick={(e) => openProject(p, e.currentTarget)}
      {...tilt}
    >
      <span className="pj-tile__cover">
        <CoverArt
          colors={p.colors}
          emoji={p.emoji}
          src={p.cover}
          seed={p.id}
          focus={p.coverFocus}
          sizes={big || wide ? SIZES_BIG : SIZES_SMALL}
        />
      </span>
      <span className="pj-tile__glare" aria-hidden="true" />
      {big ? (
        <span className="pj-tile__pin" aria-hidden="true">
          ⭐ featured
        </span>
      ) : null}
      {p.placeholder ? (
        <span className="wk-draft pj-tile__draft" aria-label="draft">
          draft
        </span>
      ) : null}
      <span className="pj-tile__body">
        <span className="pj-tile__emoji" aria-hidden="true">
          {p.emoji}
        </span>
        <span className="pj-tile__title">{p.title}</span>
        {big || banner ? <span className="pj-tile__sum">{p.summary}</span> : null}
        <span className="pj-tile__meta">
          {year ? <span className="pj-tile__year">{year}</span> : null}
          <CategoryChip category={cat} />
        </span>
      </span>
    </button>
  )
}

/**
 * At 4 columns two big tiles interlock (left, then right one row lower), but a
 * big tile that starts a new pair needs four cells beside it: its two
 * followers and two more. Only the last big tile can be unpaired; with three
 * followers the last-row stretch closes the gap, with only two it can't, so
 * show it as a normal tile there (e.g. searching "dance").
 */
function fitBigTiles(items: BentoItem[], cols: number): BentoItem[] {
  if (cols < 4) return items
  let bigs = 0
  let last = -1
  items.forEach((x, i) => {
    if (x.big) {
      bigs++
      last = i
    }
  })
  if (bigs % 2 === 0 || items.length - 1 - last >= 3) return items
  return items.map((x, i) => (i === last ? { ...x, big: false } : x))
}

export function Grid({ items: layout, tiltOn }: { items: BentoItem[]; tiltOn: boolean }) {
  const ref = useRef<HTMLUListElement>(null)
  const cols = useGridCols(ref)
  const items = fitBigTiles(layout, cols)
  // only featured projects (Featured, Initiatives): no small tiles to sit beside
  // a big one, so show them two-up with the big tile's look
  const duo = items.length > 0 && items.every((x) => x.p.featured)

  // Fill the last row: count occupied cells (a big tile is 2×2 at 3+ columns,
  // a full row at 2, one cell at 1) and stretch one tile of the partial last
  // row over the gap; `row dense` packing keeps it in that row.
  const cellsOf = (x: BentoItem) => (x.big ? (cols >= 3 ? 4 : cols) : 1)
  const rem = cols > 1 ? items.reduce((n, x) => n + cellsOf(x), 0) % cols : 0
  let wide = -1
  if (rem) {
    wide = items.length - 1
    // the last `rem` one-cell tiles share that row; prefer stretching a featured one
    for (let k = items.length - 1, n = rem; k >= 0 && n > 0 && !items[k].big; k--, n--) {
      if (items[k].p.featured) wide = k
    }
  }

  const span = cols - rem + 1
  let bigSeen = 0
  return (
    <ul ref={ref} className={`pj-grid${duo ? ' pj-grid--duo' : ''}`} role="list">
      <AnimatePresence mode="popLayout">
        {items.map(({ p, big }, i) => {
          const right = big && bigSeen++ % 2 === 1
          return (
            <motion.li
              key={p.id}
              layout
              className={`pj-cell${big ? ' pj-cell--big' : ''}${right ? ' pj-cell--right' : ''}${i === wide ? ` pj-cell--wide${span >= 3 ? ' pj-cell--banner' : ''}` : ''}`}
              style={i === wide ? { gridColumn: `span ${span}` } : undefined}
              initial={{ opacity: 0, y: 22, scale: 0.96 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { delay: Math.min(i, 14) * 0.045, type: 'spring', stiffness: 260, damping: 24 },
              }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18, ease: 'easeIn' } }}
              transition={{ layout: { type: 'spring', stiffness: 380, damping: 34 } }}
            >
              <Tile p={p} big={big || duo} wide={i === wide} banner={i === wide && span >= 3} tiltOn={tiltOn} />
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ul>
  )
}
