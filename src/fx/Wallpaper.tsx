import { useEffect, useRef, useState } from 'react'
import { WALLPAPER } from '../content/look'
import { useWindows } from '../os/store'
import { useIsMobile } from '../os/useMedia'
import { createWallpaperRenderer, type WallpaperRenderer } from './wallpaper/renderer'
import './wallpaper/wallpaper.css'

/*
 * The wallpaper — the "3D moment". Fixed, full-viewport, behind everything.
 *
 * Layers (bottom → top):
 *   .wp__base    var(--bg-grad): instant paint, and what shows if GL is lost
 *   .wp__canvas  WebGL raymarched pastel metaballs (see wallpaper/renderer.ts)
 *     or .wp__css  CSS fallback: a few slow blurred blobs (no WebGL / compile failure)
 *   .wp__grain   static film grain at device resolution
 *
 * Dev: add `?gl=force` to run the shader on software GL (e.g. headless screenshots).
 *
 * On phones every app is a full-screen milk-glass sheet, so once one has
 * covered the screen the wallpaper rests (WebGL loop paused on its last frame,
 * CSS blobs paused). It wakes as soon as the sheet is dragged by its header
 * or closed.
 */

/** Wait for the sheet's opening zoom to cover the screen before pausing. */
const COVER_DELAY = 700

function useCovered(): boolean {
  const isMobile = useIsMobile()
  const sheetOpen = useWindows((s) => s.windows.some((w) => !w.minimized))
  const active = isMobile && sheetOpen
  const [lifting, setLifting] = useState(false)
  const [settled, setSettled] = useState(false)

  // The phone shell marks its home layer `.mhome-wrap.is-lifting` while the
  // bottom sheet is pulled down by its header (the wallpaper peeks out).
  useEffect(() => {
    if (!active) return
    const home = document.querySelector('.mhome-wrap')
    if (!home) return
    const sync = () => setLifting(home.classList.contains('is-lifting'))
    const mo = new MutationObserver(sync)
    mo.observe(home, { attributes: true, attributeFilter: ['class'] })
    sync()
    return () => {
      mo.disconnect()
      setLifting(false)
    }
  }, [active])

  const hidden = active && !lifting
  useEffect(() => {
    if (!hidden) return
    const t = window.setTimeout(() => setSettled(true), COVER_DELAY)
    return () => {
      window.clearTimeout(t)
      setSettled(false)
    }
  }, [hidden])

  return hidden && settled
}

function forceGL() {
  try {
    return new URLSearchParams(location.search).get('gl') === 'force'
  } catch {
    return false
  }
}

function prefersCSS() {
  try {
    return new URLSearchParams(location.search).get('gl') === 'off'
  } catch {
    return false
  }
}

export function Wallpaper() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WallpaperRenderer | null>(null)
  const [mode, setMode] = useState<'gl' | 'css' | 'flat'>(() =>
    WALLPAPER === 'flat' ? 'flat' : WALLPAPER === 'soft' || prefersCSS() ? 'css' : 'gl',
  )
  const covered = useCovered()
  const coveredRef = useRef(covered)

  useEffect(() => {
    const canvas = canvasRef.current
    if (mode !== 'gl' || !canvas) return
    canvas.dataset.ready = 'false'
    const renderer = createWallpaperRenderer(canvas, {
      force: forceGL(),
      onFail: () => setMode('css'),
      onReady: () => {
        canvas.dataset.ready = 'true'
      },
      onLost: () => {
        canvas.dataset.ready = 'false'
      },
    })
    renderer?.setPaused(coveredRef.current)
    rendererRef.current = renderer
    return () => {
      rendererRef.current = null
      renderer?.destroy()
    }
  }, [mode])

  useEffect(() => {
    coveredRef.current = covered
    rendererRef.current?.setPaused(covered)
  }, [covered])

  return (
    <div className="wp" aria-hidden="true" data-mode={mode} data-covered={covered || undefined}>
      <div className="wp__base" />
      {mode === 'flat' ? null : mode === 'gl' ? (
        <canvas ref={canvasRef} className="wp__canvas" data-ready="false" />
      ) : (
        <div className="wp__css">
          <span className="wp__blob wp__blob--1" />
          <span className="wp__blob wp__blob--2" />
          <span className="wp__blob wp__blob--3" />
          <span className="wp__blob wp__blob--4" />
          <span className="wp__blob wp__blob--5" />
        </div>
      )}
      <div className="wp__grain" />
    </div>
  )
}
