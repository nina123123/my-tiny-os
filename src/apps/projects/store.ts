import { create } from 'zustand'

/*
 * Projects browser UI state. Lives at module level so closing and
 * re-opening the window (or switching sheets on mobile) keeps your place.
 */

export type ProjectsFilter = 'all' | 'featured' | (string & {})
export type ProjectsView = 'grid' | 'timeline'

type ProjectsUi = {
  filter: ProjectsFilter
  view: ProjectsView
  query: string
  setFilter: (f: ProjectsFilter) => void
  setView: (v: ProjectsView) => void
  setQuery: (q: string) => void
}

export const useProjectsUi = create<ProjectsUi>()((set) => ({
  filter: 'all',
  view: 'grid',
  query: '',
  setFilter: (filter) => set({ filter }),
  setView: (view) => set({ view }),
  setQuery: (query) => set({ query }),
}))
