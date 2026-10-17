import { categories, getCategory, projects } from '../../content/projects'
import type { Project, ProjectCategory } from '../../content/types'
import { rectOf } from '../../os/anchors'
import { useWindows } from '../../os/store'

/*
 * Helpers shared by the Projects browser and the Project detail window.
 */

/** Open a project in its own window, growing out of `from` (the tile / card that was clicked). */
export function openProject(p: Project, from?: Element | null) {
  useWindows.getState().open('project', {
    windowId: `project:${p.id}`,
    params: { projectId: p.id },
    title: p.title,
    origin: rectOf(from ?? null) ?? undefined,
  })
}

export type BentoItem = { p: Project; big: boolean }

/**
 * Grid layout: featured projects come first, each followed by two regular
 * ones, so the bento zig-zags (big tile + two small) at every width.
 * Remaining regular projects follow in content order. A featured project only
 * gets a big tile when two small ones follow it (otherwise the big tile would
 * leave an empty column beside it).
 */
export function bentoLayout(list: Project[]): BentoItem[] {
  const featured = list.filter((p) => p.featured)
  const small = list.filter((p) => !p.featured)
  const out: BentoItem[] = []
  let s = 0
  for (const f of featured) {
    const followers = small.slice(s, s + 2)
    out.push({ p: f, big: followers.length === 2 })
    for (const p of followers) out.push({ p, big: false })
    s += 2
  }
  for (const p of small.slice(s)) out.push({ p, big: false })
  return out
}

/** The bento order as a plain list of projects. */
export const bentoOrder = (list: Project[]): Project[] => bentoLayout(list).map((x) => x.p)

/** The order "next project →" walks through (same as the Projects grid). */
export const PROJECT_ORDER = bentoOrder(projects)

export function nextProject(id: string): Project | undefined {
  const i = PROJECT_ORDER.findIndex((p) => p.id === id)
  if (i < 0 || PROJECT_ORDER.length < 2) return undefined
  return PROJECT_ORDER[(i + 1) % PROJECT_ORDER.length]
}

export const categoryOf = (p: Project): ProjectCategory | undefined => getCategory(p.categoryId)

export const countIn = (categoryId: string) => projects.filter((p) => p.categoryId === categoryId).length

export { categories, projects }

/** Lowercase + strip accents, for forgiving search. */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export function matches(p: Project, query: string) {
  const q = fold(query.trim())
  if (!q) return true
  const hay = fold([p.title, p.subtitle ?? '', p.summary, p.tags.join(' '), categoryOf(p)?.label ?? ''].join(' \u0001 '))
  return q.split(/\s+/).every((word) => hay.includes(word))
}

/** Year shown for a project (its own label; undated projects show nothing). */
export const yearLabel = (p: Project) => p.year.trim()
