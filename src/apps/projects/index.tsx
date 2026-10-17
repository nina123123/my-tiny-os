import { AnimatePresence, LayoutGroup, motion, MotionConfig } from 'motion/react'
import { useEffect, useId, useMemo, useRef, type CSSProperties } from 'react'
import type { ProjectCategory } from '../../content/types'
import { preloadApp } from '../../os/preload'
import type { AppProps } from '../../os/types'
import { useFinePointer, useReducedMotion } from '../../os/useMedia'
import { MotifSticker, Sticker } from '../welcome/Stickers'
import { Grid } from './Grid'
import { bentoLayout, categories, countIn, matches, projects } from './shared'
import { useProjectsUi, type ProjectsFilter, type ProjectsView } from './store'
import { Timeline } from './Timeline'
import './projects.css'

/*
 * Projects: the centerpiece. Folder sidebar (chip scroller when narrow),
 * a sticky toolbar with search + [Grid | Timeline], and the work itself.
 */

type NavItem = { id: ProjectsFilter; label: string; emoji: string; count: number; color?: string }

const NAV_TOP: NavItem[] = [
  { id: 'all', label: 'All', emoji: '🗂️', count: projects.length },
  { id: 'featured', label: 'Featured', emoji: '⭐', count: projects.filter((p) => p.featured).length },
]
const NAV_CATS: NavItem[] = categories.map((c) => ({
  id: c.id,
  label: c.label,
  emoji: c.emoji,
  count: countIn(c.id),
  color: c.color,
}))

const TOP_TAGS = (() => {
  const freq = new Map<string, number>()
  for (const p of projects) for (const t of p.tags) freq.set(t, (freq.get(t) ?? 0) + 1)
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([t]) => t)
})()

function NavButton({ item, active, variant, onPick }: { item: NavItem; active: boolean; variant: 'side' | 'chips'; onPick: (id: ProjectsFilter) => void }) {
  return (
    <button
      type="button"
      className={`pj-nav__item${active ? ' is-active' : ''}`}
      aria-pressed={active}
      style={item.color ? ({ '--chip': item.color } as CSSProperties) : undefined}
      onClick={() => onPick(item.id)}
    >
      {active ? (
        <motion.span
          layoutId={`pj-nav-pill-${variant}`}
          className="pj-nav__pill"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      ) : null}
      <span className="pj-nav__emoji" aria-hidden="true">
        {item.emoji}
      </span>
      <span className="pj-nav__label">{item.label}</span>
      <span className="pj-nav__count">
        <span className="sr-only">, </span>
        {item.count}
        <span className="sr-only"> {item.count === 1 ? 'project' : 'projects'}</span>
      </span>
    </button>
  )
}

function Nav({ variant, filter, onPick }: { variant: 'side' | 'chips'; filter: ProjectsFilter; onPick: (id: ProjectsFilter) => void }) {
  const headId = useId()
  const listRef = useRef<HTMLUListElement>(null)

  // keep the active chip in view inside the horizontal scroller
  useEffect(() => {
    const list = listRef.current
    const chip = list?.querySelector<HTMLElement>('.is-active')
    if (!list || !chip || !list.clientWidth) return
    const l = chip.offsetLeft - 16
    const r = chip.offsetLeft + chip.offsetWidth + 16 - list.clientWidth
    if (l < list.scrollLeft) list.scrollTo({ left: l, behavior: 'smooth' })
    else if (r > list.scrollLeft) list.scrollTo({ left: r, behavior: 'smooth' })
  }, [filter])

  if (variant === 'chips') {
    return (
      <nav className="pj-chips" aria-label="Project folders">
        <ul ref={listRef} role="list" className="pj-chips__list">
          {[...NAV_TOP, ...NAV_CATS].map((item) => (
            <li key={item.id}>
              <NavButton item={item} active={filter === item.id} variant="chips" onPick={onPick} />
            </li>
          ))}
        </ul>
      </nav>
    )
  }
  return (
    <nav className="pj-nav" aria-label="Project folders">
      <ul role="list" className="pj-nav__list">
        {NAV_TOP.map((item) => (
          <li key={item.id}>
            <NavButton item={item} active={filter === item.id} variant="side" onPick={onPick} />
          </li>
        ))}
      </ul>
      <p className="pj-nav__head" id={headId}>
        folders
      </p>
      <ul role="list" className="pj-nav__list" aria-labelledby={headId}>
        {NAV_CATS.map((item) => (
          <li key={item.id}>
            <NavButton item={item} active={filter === item.id} variant="side" onPick={onPick} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Header({ filter, category, verb }: { filter: ProjectsFilter; category?: ProjectCategory; verb: 'click' | 'tap' }) {
  if (category) {
    return (
      <header className="pj-head" style={{ '--chip': category.color } as CSSProperties}>
        <span className="pj-head__badge" aria-hidden="true">
          {category.emoji}
        </span>
        <div className="pj-head__text">
          <p className="kicker">
            {countIn(category.id) === 1 ? '1 project' : `${countIn(category.id)} projects`} · one folder
          </p>
          <h3 className="pj-head__title">{category.label}</h3>
          {category.blurb ? (
            <blockquote className="pj-head__blurb">
              <p>{category.blurb}</p>
              <span className="hand pj-head__sig" aria-hidden="true">
                — in my words
              </span>
            </blockquote>
          ) : null}
        </div>
      </header>
    )
  }
  if (filter === 'featured') {
    return (
      <header className="pj-head pj-head--plain">
        <span className="pj-head__badge pj-head__badge--star" aria-hidden="true">
          ⭐
        </span>
        <div className="pj-head__text">
          <p className="kicker">pinned to the top</p>
          <h3 className="pj-head__title">the big ones</h3>
        </div>
      </header>
    )
  }
  return (
    <header className="pj-head pj-head--plain">
      <div className="pj-head__text">
        <p className="kicker">
          {projects.length === 1 ? '1 project' : `${projects.length} projects`} · {categories.length === 1 ? '1 folder' : `${categories.length} folders`}
        </p>
        <h3 className="pj-head__title">
          all the things <span className="pj-head__spark" aria-hidden="true">✦</span>
        </h3>
      </div>
      <p className="hand pj-head__hint" aria-hidden="true">
        {verb} a tile to open its story ↓
      </p>
    </header>
  )
}

function Empty({ query, onClear, onTry }: { query: string; onClear: () => void; onTry: (t: string) => void }) {
  return (
    <motion.div
      className="pj-empty"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
    >
      <div className="pj-empty__art" aria-hidden="true">
        <Sticker kind="cloud" size={96} bob tilt={-4} />
        <span className="pj-empty__glass">🔍</span>
        <Sticker kind="sparkle" size={30} className="pj-empty__spark" bob delay={1.4} />
      </div>
      <p className="pj-empty__title">
        nothing called <q>{query.trim()}</q> here… yet!
      </p>
      <p className="pj-empty__text">try another word, or peek at one of these:</p>
      <div className="pj-empty__tags">
        {TOP_TAGS.map((t) => (
          <button key={t} type="button" className="pj-tag" onClick={() => onTry(t)}>
            #{t}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--accent pj-empty__clear" onClick={onClear}>
        clear search
      </button>
    </motion.div>
  )
}

const VIEWS: { id: ProjectsView; label: string }[] = [
  { id: 'grid', label: 'Grid' },
  { id: 'timeline', label: 'Timeline' },
]

function ViewIcon({ id }: { id: ProjectsView }) {
  return id === 'grid' ? (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="currentColor">
      <rect x="1.5" y="1.5" width="7" height="7" rx="2" />
      <rect x="10" y="1.5" width="4.5" height="5" rx="1.6" />
      <rect x="10" y="8" width="4.5" height="6.5" rx="1.6" />
      <rect x="1.5" y="10" width="7" height="4.5" rx="1.6" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 1.5v13" />
      <circle cx="4" cy="4" r="2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="11" r="2" fill="currentColor" stroke="none" />
      <path d="M8 4h6.5M8 11h4.5" />
    </svg>
  )
}

export default function App({ isMobile }: AppProps) {
  const filter = useProjectsUi((s) => s.filter)
  const view = useProjectsUi((s) => s.view)
  const query = useProjectsUi((s) => s.query)
  const { setFilter, setView, setQuery } = useProjectsUi.getState()
  const reduced = useReducedMotion()
  const fine = useFinePointer()
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchId = useId()

  const category = categories.find((c) => c.id === filter)
  const scoped = useMemo(
    () =>
      filter === 'all' ? projects : filter === 'featured' ? projects.filter((p) => p.featured) : projects.filter((p) => p.categoryId === filter),
    [filter],
  )
  const visible = useMemo(() => scoped.filter((p) => matches(p, query)), [scoped, query])
  const gridItems = useMemo(() => bentoLayout(visible), [visible])

  // Warm up the project window's code while the visitor browses, so the first
  // tile click opens instantly instead of waiting on the chunk.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 400))
    const cancel = window.cancelIdleCallback ?? window.clearTimeout
    const handle = idle(() => preloadApp('project'))
    return () => cancel(handle)
  }, [])

  // new folder or view → back to the top of the list
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    scrollRef.current?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }, [filter, view, reduced])


  // "/" focuses search while focus is anywhere in this window (including the
  // window frame itself, which is where focus lands when the window opens)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const host = root.closest<HTMLElement>('[data-window-id], [role="dialog"]') ?? root
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    host.addEventListener('keydown', onKeyDown)
    return () => host.removeEventListener('keydown', onKeyDown)
  }, [])

  const countLabel = query.trim() || filter !== 'all' ? `${visible.length} of ${projects.length}` : `${projects.length}`

  return (
    <MotionConfig reducedMotion="user">
      <div ref={rootRef} className={`pj${isMobile ? ' pj--mobile' : ''}`}>
        <aside className="pj-side">
          <LayoutGroup id="pj-side">
            <Nav variant="side" filter={filter} onPick={setFilter} />
          </LayoutGroup>
          <p className="pj-side__note hand" aria-hidden="true">
            every tile opens
            <br />
            its own window ✨
          </p>
        </aside>

        <motion.div className="pj-main" ref={scrollRef} layoutScroll>
          <div className="pj-bar">
            <div className="pj-bar__row">
              <h2 className="pj-bar__title">
                Projects <span className="pj-bar__count">{countLabel}</span>
              </h2>
              <div className={`pj-search${query ? '' : ' is-empty'}`}>
                <label htmlFor={searchId} className="sr-only">
                  Search projects
                </label>
                <svg className="pj-search__icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="8.5" cy="8.5" r="5.5" />
                  <path d="M13 13l4 4" />
                </svg>
                <input
                  ref={searchRef}
                  id={searchId}
                  className="pj-search__input"
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={isMobile ? 'search projects' : 'search projects & tags'}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query ? (
                  <button type="button" className="pj-search__clear" aria-label="Clear search" onClick={() => { setQuery(''); searchRef.current?.focus() }}>
                    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
                    </svg>
                  </button>
                ) : (
                  <kbd className="pj-search__kbd" aria-hidden="true">
                    /
                  </kbd>
                )}
              </div>
              <div className="pj-seg" role="group" aria-label="View as">
                {VIEWS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`pj-seg__btn${view === v.id ? ' is-active' : ''}`}
                    aria-pressed={view === v.id}
                    onClick={() => setView(v.id)}
                  >
                    {view === v.id ? (
                      <motion.span layoutId="pj-seg-pill" className="pj-seg__pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                    ) : null}
                    <ViewIcon id={v.id} />
                    <span className="pj-seg__label">{v.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <LayoutGroup id="pj-chips">
              <Nav variant="chips" filter={filter} onPick={setFilter} />
            </LayoutGroup>
          </div>

          <div className="pj-content">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={filter}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <Header filter={filter} category={category} verb={fine ? 'click' : 'tap'} />
              </motion.div>
            </AnimatePresence>

            {query.trim() && visible.length > 0 ? (
              <p className="pj-results">
                {visible.length === 1 ? '1 match' : `${visible.length} matches`} for <q>{query.trim()}</q>
                <button type="button" className="pj-results__clear" onClick={() => setQuery('')}>
                  clear
                </button>
              </p>
            ) : null}

            {visible.length === 0 ? (
              <Empty
                query={query}
                onClear={() => {
                  setQuery('')
                  searchRef.current?.focus()
                }}
                onTry={(t) => {
                  setFilter('all')
                  setQuery(t)
                }}
              />
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={view}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {view === 'grid' ? (
                    <Grid items={gridItems} tiltOn={fine && !reduced} />
                  ) : (
                    <Timeline items={visible} scrollRef={scrollRef} reduced={reduced} />
                  )}
                </motion.div>
              </AnimatePresence>
            )}

            {visible.length > 0 ? (
              <p className="pj-foot" aria-hidden="true">
                <MotifSticker fallback="star" size={26} tilt={-12} /> that&rsquo;s everything (for now!)
              </p>
            ) : null}
          </div>

          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {visible.length === 1 ? '1 project shown' : `${visible.length} projects shown`}
          </p>
        </motion.div>
      </div>
    </MotionConfig>
  )
}
