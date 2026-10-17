import { motion, useScroll, useSpring } from 'motion/react'
import { useMemo, useRef, type CSSProperties, type RefObject } from 'react'
import { CoverArt } from '../../components/CoverArt'
import { Reveal } from '../../components/Reveal'
import type { Project } from '../../content/types'
import { CategoryChip } from './CategoryChip'
import { categoryOf, openProject, yearLabel } from './shared'

/*
 * Vertical timeline ordered by sortDate (newest first). Year markers sit on
 * a line that draws itself as you scroll. Undated projects (sortDate 0) go
 * into an "along the way" group at the end, never a made-up date.
 */

type Group = { key: string; label: string; undated: boolean; items: Project[] }

function groupByYear(list: Project[]): Group[] {
  const dated = list.filter((p) => p.sortDate > 0).sort((a, b) => b.sortDate - a.sortDate)
  const undated = list.filter((p) => !(p.sortDate > 0))
  const groups: Group[] = []
  for (const p of dated) {
    const y = String(Math.floor(p.sortDate / 100))
    const last = groups[groups.length - 1]
    if (last && last.key === y) last.items.push(p)
    else groups.push({ key: y, label: y, undated: false, items: [p] })
  }
  if (undated.length) groups.push({ key: 'undated', label: 'along the way', undated: true, items: undated })
  return groups
}

function Card({ p }: { p: Project }) {
  const cat = categoryOf(p)
  const year = yearLabel(p)
  return (
    <button
      type="button"
      className="pj-tl__card"
      style={{ '--chip': cat?.color ?? 'var(--lavender-300)' } as CSSProperties}
      onClick={(e) => openProject(p, e.currentTarget)}
    >
      <span className="pj-tl__thumb">
        <CoverArt colors={p.colors} emoji={p.emoji} src={p.cover} seed={p.id} focus={p.coverFocus} sizes="96px" />
        <span className="pj-tl__emoji" aria-hidden="true">
          {p.emoji}
        </span>
      </span>
      <span className="pj-tl__text">
        <span className="pj-tl__meta">
          <CategoryChip category={cat} />
          {year ? <span className="pj-tl__when">{year}</span> : null}
          {p.placeholder ? <span className="wk-draft pj-tl__draft">draft</span> : null}
        </span>
        <span className="pj-tl__title">{p.title}</span>
        <span className="pj-tl__sum">{p.summary}</span>
      </span>
    </button>
  )
}

export function Timeline({
  items,
  scrollRef,
  reduced,
}: {
  items: Project[]
  scrollRef: RefObject<HTMLElement | null>
  reduced: boolean
}) {
  const groups = useMemo(() => groupByYear(items), [items])
  const rootRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ container: scrollRef, target: rootRef, offset: ['start 72%', 'end 80%'] })
  const draw = useSpring(scrollYProgress, { stiffness: 180, damping: 30, restDelta: 0.001 })

  let n = 0
  return (
    <div className="pj-tl" ref={rootRef}>
      <span className="pj-tl__track" aria-hidden="true">
        <motion.span className="pj-tl__draw" style={{ scaleY: reduced ? 1 : draw }} />
      </span>
      {groups.map((g) => (
        <section key={g.key} className={`pj-tl__group${g.undated ? ' pj-tl__group--undated' : ''}`} aria-label={g.label}>
          <Reveal className="pj-tl__marker" y={10} scale={0.9}>
            <span className="pj-tl__year">
              {g.undated ? <span className="pj-tl__loop" aria-hidden="true">✦</span> : null}
              {g.label}
            </span>
            <span className="pj-tl__count">{g.items.length === 1 ? '1 project' : `${g.items.length} projects`}</span>
          </Reveal>
          <ol className="pj-tl__list" role="list">
            {g.items.map((p) => {
              const side = n++ % 2 === 0 ? 'left' : 'right'
              return (
                <li key={p.id} className={`pj-tl__item pj-tl__item--${side}`}>
                  <span
                    className="pj-tl__dot"
                    aria-hidden="true"
                    style={{ '--chip': categoryOf(p)?.color ?? 'var(--lavender-300)' } as CSSProperties}
                  />
                  <Reveal className="pj-tl__reveal" y={24} delay={60}>
                    <Card p={p} />
                  </Reveal>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
