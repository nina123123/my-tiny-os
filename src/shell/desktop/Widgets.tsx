import { profile } from '../../content/profile'
import { useSettings } from '../../os/settings'
import { useMinuteClock } from './hooks'

/*
 * The desktop's right-hand widgets column (≥ 1100px wide): a glass "now" card
 * with today's date + profile.currently. It lives on the desktop layer, so
 * windows slide over it; the wallpaper widgets keep clear of it (DecorLayer
 * measures it).
 */

// profile.currently has no per-item placeholder flag: while profile.placeholder is
// set, values like "add something here" show as "coming soon" instead.
const isTemplateValue = (v: string) => !!profile.placeholder && /^add\b.*\bhere\.?$/i.test(v.trim())

function greeting(h: number) {
  if (h < 5) return 'up late'
  if (h < 12) return 'good morning'
  if (h < 17) return 'good afternoon'
  if (h < 21) return 'good evening'
  return 'good night'
}

export function Widgets() {
  const now = useMinuteClock()
  const booted = useSettings((s) => s.booted)
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const date = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toLowerCase()

  return (
    <aside className="dwidgets" aria-label="Desktop widgets" data-show={booted}>
      <section className="dwidget glass" aria-label="Now">
        <div className="dwidget__head">
          <span className="dwidget__live" aria-hidden="true" />
          <span className="kicker">now · {greeting(now.getHours())}</span>
        </div>
        <p className="dwidget__day">
          <time dateTime={now.toISOString().slice(0, 10)}>{weekday}</time>
        </p>
        <p className="dwidget__date">{date}</p>
        <dl className="dwidget__list">
          {profile.currently.map((item) => (
            <div key={item.label} className="dwidget__row">
              <dt className="kicker">{item.label}</dt>
              <dd>
                {isTemplateValue(item.value) ? (
                  <span className="dwidget__soon" title={`${profile.firstName.toLowerCase()} is still writing this one`}>
                    <span aria-hidden="true">✏️</span> coming soon
                  </span>
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </aside>
  )
}
