import { Component, createElement, lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { APPS } from './apps'
import type { AppId, AppProps } from './types'

/*
 * Renders an app by id with code-splitting, a loading state and an error
 * boundary. Used by both the desktop WindowFrame and the mobile AppSheet.
 */

/*
 * One lazy component per app, created once at module load (never during
 * render), so React keeps each app's state across re-renders.
 */
const LAZY_APPS = new Map<AppId, ComponentType<AppProps>>(APPS.map((a) => [a.id, lazy(a.load)]))

/*
 * A lazy chunk that failed to load (offline, or a redeploy replaced the hashed
 * file) can't be retried in place: React.lazy caches the rejection and the
 * browser caches the failed module URL. Only a page reload fetches it again.
 */
const isChunkError = (e: unknown) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
    String((e as Error | null)?.message ?? e),
  )

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    const { error } = this.state
    if (error) {
      const chunk = isChunkError(error)
      return (
        <div className="app-host__state" role="alert">
          <span aria-hidden="true" style={{ fontSize: 40 }}>
            {chunk ? '📡' : '🫠'}
          </span>
          <p>{chunk ? "couldn't load this app. check your connection?" : 'oops, this app tripped over its shoelaces.'}</p>
          <button className="btn" onClick={() => (chunk ? window.location.reload() : this.setState({ error: null }))}>
            try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function Loading() {
  return (
    <div className="app-host__state" aria-busy="true" aria-live="polite">
      <span className="app-host__spinner" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}

export function AppHost({ appId, ...props }: AppProps & { appId: AppId }) {
  return (
    <AppErrorBoundary>
      <Suspense fallback={<Loading />}>
        <LazyApp appId={appId} {...props} />
      </Suspense>
    </AppErrorBoundary>
  )
}

/** Looks the app up in the static LAZY_APPS table (stable identity per app id). */
function LazyApp({ appId, ...props }: AppProps & { appId: AppId }) {
  const app = LAZY_APPS.get(appId)
  if (!app) throw new Error(`Unknown app: ${appId}`)
  return createElement(app, props)
}
