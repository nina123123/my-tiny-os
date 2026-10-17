import type { CSSProperties, MouseEvent } from 'react'
import { openProject, PROJECT_ORDER } from '../../apps/projects/shared'
import { CoverArt } from '../../components/CoverArt'
import { profile } from '../../content/profile'
import { preloadApp } from '../../os/preload'
import { rectOf } from '../../os/anchors'
import { getApp } from '../../os/apps'
import { useWindows } from '../../os/store'

/*
 * Two small home-screen widgets: "latest project" (the newest project, with its
 * cover) and "currently" (profile.currently). The first opens that project, the
 * second About Me.
 */

/** The most recent dated project (the first one when none has a date) */
const LATEST = [...PROJECT_ORDER].filter((p) => !p.placeholder).sort((a, b) => b.sortDate - a.sortDate)[0]

function Latest({ index }: { index: number }) {
  const p = LATEST
  if (!p) return null
  return (
    <button
      type="button"
      className="mwidget mwidget--project glass"
      data-rise
      style={{ '--i': index } as CSSProperties}
      aria-label={`Latest project: ${p.title}. Open it`}
      onClick={(e: MouseEvent<HTMLElement>) => openProject(p, e.currentTarget)}
      onPointerDown={() => preloadApp('project')}
    >
      <span className="mwidget__art" aria-hidden="true">
        <CoverArt colors={p.colors} emoji={p.emoji} src={p.cover} seed={p.id} focus={p.coverFocus} sizes="96px" />
      </span>
      <span className="mwidget__track" aria-hidden="true">
        <span className="mwidget__kicker kicker">latest project</span>
        <span className="mwidget__title">{p.title}</span>
        {p.year ? <span className="mwidget__sub">{p.year}</span> : null}
      </span>
    </button>
  )
}

function Currently({ index }: { index: number }) {
  const open = useWindows((s) => s.open)
  const items = profile.currently.slice(0, 3)
  if (!items.length) return null
  const summary = items.map((c) => `${c.label}: ${c.value}`).join('; ')
  return (
    <button
      type="button"
      className="mwidget mwidget--now glass"
      data-rise
      style={{ '--i': index } as CSSProperties}
      aria-label={`Currently, ${summary}. Open ${getApp('about').name}`}
      onClick={(e: MouseEvent<HTMLElement>) => open('about', { origin: rectOf(e.currentTarget) ?? undefined })}
      onPointerDown={() => preloadApp('about')}
    >
      <span className="mwidget__kicker kicker" aria-hidden="true">
        <span className="mwidget__pulse" />
        currently
      </span>
      <span className="mwidget__list" aria-hidden="true">
        {items.map((c) => (
          <span key={c.label} className="mwidget__item">
            <span className="mwidget__label2">{c.label}</span>
            <span className="mwidget__value">{c.value}</span>
          </span>
        ))}
      </span>
    </button>
  )
}

export function Widgets() {
  return (
    <div className="mwidgets">
      <Latest index={1} />
      <Currently index={2} />
    </div>
  )
}
