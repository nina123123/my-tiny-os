import type { ComponentType } from 'react'

export type AppId = 'welcome' | 'projects' | 'project' | 'about' | 'guestbook' | 'contact'

/** Props every app component receives. */
export type AppProps = {
  /** Id of the window (desktop) or sheet (mobile) hosting this app */
  windowId: string
  /** Free-form params passed to open(), e.g. { projectId } for the project app */
  params: Record<string, unknown>
  /** True when rendered inside the mobile shell (full-screen sheet) */
  isMobile: boolean
}

export type AppDef = {
  id: AppId
  /** Name under icons and in the dock tooltip */
  name: string
  /** Default window title (can be overridden per window) */
  title: string
  /** Short description for screen readers / tooltips */
  description: string
  /** Lazily loaded app module; its default export is the app component */
  load: () => Promise<{ default: ComponentType<AppProps> }>
  defaultSize: { width: number; height: number }
  minSize: { width: number; height: number }
  /** Show as a desktop icon */
  desktop: boolean
  /** Show in the dock (desktop) */
  dock: boolean
  /** Show on the mobile home screen grid */
  home: boolean
  /** Show in the mobile home screen's bottom dock row */
  homeDock: boolean
  /** Only one window of this app may exist (re-opening focuses it) */
  singleton: boolean
  /** Window body is transparent & chrome-light (e.g. welcome card) */
  chromeless?: boolean
}

export type Rect = { x: number; y: number; width: number; height: number }

export type WindowState = {
  id: string
  appId: AppId
  title: string
  params: Record<string, unknown>
  x: number
  y: number
  width: number
  height: number
  /**
   * The size the window wants (its opening size, or the size the visitor last
   * resized it to). A smaller viewport may squeeze width/height below it; the
   * window grows back towards it when the viewport grows again.
   */
  prefWidth?: number
  prefHeight?: number
  /** Stacking order; higher is on top. Render with z-index: 100 + z */
  z: number
  minimized: boolean
  maximized: boolean
  /** Screen rect the window should animate from when it opens (icon position) */
  origin?: Rect
  /** Monotonic counter, bumps each time open() is called on an existing window (for a "hello again" wiggle) */
  pokes: number
}

export type OpenOptions = {
  /** Explicit window id; defaults to appId for singletons, `${appId}:${n}` otherwise */
  windowId?: string
  title?: string
  params?: Record<string, unknown>
  /** Screen rect to animate from (e.g. the clicked icon's getBoundingClientRect()) */
  origin?: Rect
}
