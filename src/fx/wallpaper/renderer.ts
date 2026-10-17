import { BLOB_COUNT, fragSource, VERT } from './shader'
import { mixPalette, mixRGB, nightness, readPalette, type Palette, type RGB } from './palette'

/*
 * The wallpaper engine. Owns the WebGL context of one canvas and everything
 * around it: the frame loop (fps cap, pause when hidden, still frame for
 * reduced motion), mood crossfades (MutationObserver on <html>), pointer
 * parallax, resizing at ~0.5× CSS px, adaptive quality and context
 * loss. React never re-renders for any of this.
 */

export type WallpaperOptions = {
  /** WebGL is unavailable or the shader failed: show the CSS fallback */
  onFail: () => void
  /** First frame is on screen (fade the canvas in) */
  onReady?: () => void
  /** Context was lost (canvas is blank until restored) */
  onLost?: () => void
  /** Ignore failIfMajorPerformanceCaveat (dev/screenshots on software GL) */
  force?: boolean
}

export type WallpaperRenderer = {
  /**
   * Rest the loop while something opaque (a full-screen phone sheet) covers
   * the wallpaper. The last frame stays on the canvas; a running mood
   * crossfade still finishes. Resuming picks the drift back up.
   */
  setPaused: (paused: boolean) => void
  destroy: () => void
}

type Blob = {
  /** base position in screen units: y ∈ [-1, 1], x ∈ [-1, 1] (scaled by aspect) */
  x: number
  y: number
  z: number
  r: number
  /** drift amplitude + frequency (Hz) */
  ax: number
  ay: number
  fx: number
  fy: number
  ph: number
  /** cursor parallax strength (closer = more) */
  par: number
  /** how much it breathes into an ellipsoid */
  squish: number
}

/*
 * Two loose families that drift together and apart (so they melt into
 * soft pebbles now and then), a floater, and one tiny coral pop.
 */
const BLOBS: Blob[] = [
  { x: -0.84, y: -0.6, z: -0.35, r: 0.56, ax: 0.08, ay: 0.07, fx: 0.019, fy: 0.015, ph: 0.0, par: 0.45, squish: 0.1 },
  { x: -0.45, y: -0.84, z: 0.2, r: 0.25, ax: 0.14, ay: 0.08, fx: 0.027, fy: 0.021, ph: 2.4, par: 0.8, squish: 0.14 },
  { x: 0.88, y: 0.52, z: -0.6, r: 0.55, ax: 0.07, ay: 0.08, fx: 0.014, fy: 0.02, ph: 1.7, par: 0.4, squish: 0.09 },
  { x: 0.5, y: 0.82, z: 0.05, r: 0.22, ax: 0.13, ay: 0.07, fx: 0.024, fy: 0.03, ph: 4.0, par: 0.75, squish: 0.14 },
  { x: 0.62, y: -0.62, z: 0.1, r: 0.33, ax: 0.1, ay: 0.09, fx: 0.021, fy: 0.017, ph: 3.1, par: 0.65, squish: 0.12 },
  { x: -0.5, y: 0.6, z: 0.55, r: 0.15, ax: 0.18, ay: 0.12, fx: 0.023, fy: 0.029, ph: 5.2, par: 1.2, squish: 0.08 },
]

/** Blob albedos from the palette, for day and night skies. */
function blobColors(p: Palette, night: number): RGB[] {
  const day: RGB[] = [
    mixRGB(p.b, p.d, 0.3),
    mixRGB(p.a, p.e, 0.25),
    mixRGB(p.a, p.e, 0.5),
    mixRGB(p.c, p.b, 0.2),
    mixRGB(p.b, p.a, 0.5),
    mixRGB(p.d, p.b, 0.12),
  ]
  const dark: RGB[] = [
    mixRGB(p.e, p.b, 0.45),
    mixRGB(p.d, p.e, 0.35),
    mixRGB(p.e, p.c, 0.4),
    mixRGB(p.d, p.e, 0.55),
    mixRGB(p.e, p.a, 0.25),
    p.d,
  ]
  return day.map((c, i) => mixRGB(c, dark[i], night))
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function createWallpaperRenderer(canvas: HTMLCanvasElement, opts: WallpaperOptions): WallpaperRenderer | null {
  const attrs: WebGLContextAttributes = {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'low-power',
    failIfMajorPerformanceCaveat: !opts.force,
  }
  let gl: WebGLRenderingContext | null = null
  try {
    gl = canvas.getContext('webgl', attrs) as WebGLRenderingContext | null
  } catch {
    gl = null
  }
  if (!gl) {
    opts.onFail()
    return null
  }
  const ctx = gl

  /* ── GL resources ─────────────────────────────────────────────── */
  let program: WebGLProgram | null = null
  let buffer: WebGLBuffer | null = null
  let U: Record<string, WebGLUniformLocation | null> = {}

  function compile(type: number, src: string) {
    const sh = ctx.createShader(type)
    if (!sh) return null
    ctx.shaderSource(sh, src)
    ctx.compileShader(sh)
    if (!ctx.getShaderParameter(sh, ctx.COMPILE_STATUS) && !ctx.isContextLost()) {
      if (import.meta.env.DEV) console.warn('[wallpaper] shader:', ctx.getShaderInfoLog(sh))
      ctx.deleteShader(sh)
      return null
    }
    return sh
  }

  function init(): boolean {
    const hp = ctx.getShaderPrecisionFormat(ctx.FRAGMENT_SHADER, ctx.HIGH_FLOAT)
    const vs = compile(ctx.VERTEX_SHADER, VERT)
    const fs = compile(ctx.FRAGMENT_SHADER, fragSource(!!hp && hp.precision > 0))
    if (!vs || !fs) return false
    const prog = ctx.createProgram()
    if (!prog) return false
    ctx.attachShader(prog, vs)
    ctx.attachShader(prog, fs)
    ctx.bindAttribLocation(prog, 0, 'aPos')
    ctx.linkProgram(prog)
    ctx.deleteShader(vs)
    ctx.deleteShader(fs)
    if (!ctx.getProgramParameter(prog, ctx.LINK_STATUS)) {
      if (import.meta.env.DEV) console.warn('[wallpaper] link:', ctx.getProgramInfoLog(prog))
      ctx.deleteProgram(prog)
      return false
    }
    program = prog
    ctx.useProgram(prog)
    buffer = ctx.createBuffer()
    ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer)
    ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), ctx.STATIC_DRAW)
    ctx.enableVertexAttribArray(0)
    ctx.vertexAttribPointer(0, 2, ctx.FLOAT, false, 0, 0)
    U = {}
    for (const name of ['uRes', 'uTime', 'uSkyA', 'uSkyB', 'uSkyC', 'uSkyD', 'uSkyE', 'uBlob', 'uShape', 'uCol', 'uK', 'uNight']) {
      U[name] = ctx.getUniformLocation(prog, name)
    }
    return true
  }

  function release() {
    if (ctx.isContextLost()) return
    if (buffer) ctx.deleteBuffer(buffer)
    if (program) ctx.deleteProgram(program)
    buffer = null
    program = null
  }

  if (!init()) {
    release()
    opts.onFail()
    return null
  }

  /* ── environment ──────────────────────────────────────────────── */
  const root = document.documentElement
  const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const mqLite = window.matchMedia('(pointer: coarse), (max-width: 767px)')
  let reduced = mqReduced.matches
  let fpsCap = mqLite.matches ? 30 : 60
  let scale = 0.5
  let lost = false
  let destroyed = false
  let readySent = false
  let paused = false

  /* palette crossfade */
  let palFrom = readPalette(root)
  let palTo = palFrom
  let palStart = -1
  let pal = palFrom
  const FADE_MS = 900

  /* cursor parallax (target from pointer, smoothed in the loop) */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 }

  /* simulation clock: starts mid-drift so the first frame is already composed */
  let sim = 40
  let lastNow = 0
  let lastDraw = 0

  /* adaptive quality */
  let slowFrames = 0
  let sampled = 0

  const blobData = new Float32Array(BLOB_COUNT * 4)
  const shapeData = new Float32Array(BLOB_COUNT * 4)
  const colData = new Float32Array(BLOB_COUNT * 3)

  function resize() {
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    // ≈0.5× CSS px (devicePixelRatio ignored), and never more than ~0.75 MP
    const s = Math.min(scale, Math.sqrt(750_000 / Math.max(1, w * h)))
    const cw = Math.max(2, Math.round(w * s))
    const ch = Math.max(2, Math.round(h * s))
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw
      canvas.height = ch
    }
  }

  function draw(now: number) {
    if (lost || destroyed || !program) return
    const W = canvas.width
    const H = canvas.height
    const aspect = W / H

    /* palette crossfade */
    if (palStart >= 0) {
      const t = Math.min(1, (now - palStart) / FADE_MS)
      pal = mixPalette(palFrom, palTo, ease(t))
      if (t >= 1) {
        palStart = -1
        pal = palTo
      }
    }
    const night = nightness(pal)

    /* world mapping: visible half-height at z = 0. Portrait phones get
       smaller blobs pushed toward the corners so the screen stays airy. */
    const halfH = 6 * 0.42
    const a = Math.min(1.6, Math.max(0.42, aspect))
    const rScale = Math.min(1, Math.pow(a, 0.8))
    const spreadX = aspect < 1 ? 1.02 : 0.94

    for (let i = 0; i < BLOB_COUNT; i++) {
      const b = BLOBS[i]
      const tt = sim * 2 * Math.PI
      let x = b.x + b.ax * Math.sin(tt * b.fx + b.ph) + 0.03 * Math.sin(tt * b.fx * 2.7 + b.ph * 1.3)
      let y = b.y + b.ay * Math.cos(tt * b.fy + b.ph * 0.7)
      // gentle drift toward the cursor (closer blobs move more)
      x += mouse.x * 0.075 * b.par
      y += mouse.y * 0.06 * b.par
      const breathe = 1 + 0.035 * Math.sin(tt * 0.05 + i * 2.1)
      // slow ellipsoid "breathing" (roughly volume-preserving)
      const w = Math.sin(tt * (b.fx + b.fy) * 0.6 + b.ph * 1.7) * b.squish
      const sx = 1 + w
      const sy = 1 / Math.sqrt(1 + w)
      const sz = 1 / Math.sqrt(1 + w)
      blobData[i * 4] = x * aspect * halfH * spreadX
      blobData[i * 4 + 1] = y * halfH * 0.94
      blobData[i * 4 + 2] = b.z + 0.25 * Math.sin(tt * b.fy * 0.8 + b.ph)
      blobData[i * 4 + 3] = b.r * halfH * rScale * breathe
      shapeData[i * 4] = 1 / sx
      shapeData[i * 4 + 1] = 1 / sy
      shapeData[i * 4 + 2] = 1 / sz
      shapeData[i * 4 + 3] = Math.min(sx, sy, sz)
    }
    const cols = blobColors(pal, night)
    for (let i = 0; i < BLOB_COUNT; i++) {
      colData[i * 3] = cols[i][0]
      colData[i * 3 + 1] = cols[i][1]
      colData[i * 3 + 2] = cols[i][2]
    }

    ctx.viewport(0, 0, W, H)
    ctx.uniform2f(U.uRes, W, H)
    ctx.uniform1f(U.uTime, sim)
    ctx.uniform3fv(U.uSkyA, pal.a)
    ctx.uniform3fv(U.uSkyB, pal.b)
    ctx.uniform3fv(U.uSkyC, pal.c)
    ctx.uniform3fv(U.uSkyD, pal.d)
    ctx.uniform3fv(U.uSkyE, pal.e)
    ctx.uniform4fv(U.uBlob, blobData)
    ctx.uniform4fv(U.uShape, shapeData)
    ctx.uniform3fv(U.uCol, colData)
    ctx.uniform1f(U.uK, 0.9 * rScale)
    ctx.uniform1f(U.uNight, night)
    ctx.drawArrays(ctx.TRIANGLES, 0, 3)

    if (!readySent) {
      readySent = true
      opts.onReady?.()
    }
  }

  /* ── loop ─────────────────────────────────────────────────────── */
  let raf = 0
  /** In reduced motion (or while covered) we only animate while a crossfade is running. */
  const animating = () => palStart >= 0 || (!reduced && !paused)

  function frame(now: number) {
    raf = 0
    if (destroyed || lost) return
    const interval = 1000 / fpsCap
    if (lastDraw && now - lastDraw < interval - 2) {
      raf = requestAnimationFrame(frame)
      return
    }
    const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0
    lastNow = now

    // adaptive quality: if we keep missing the cap, step down
    // (60fps → 30fps → smaller render → 20fps at the smallest size)
    if (lastDraw && !reduced) {
      sampled++
      if (now - lastDraw > interval * 1.6) slowFrames++
      if (sampled >= 90) {
        if (slowFrames > 45) {
          if (fpsCap > 30) fpsCap = 30
          else if (scale > 0.38) {
            scale = 0.38
            resize()
          } else if (fpsCap > 20) {
            fpsCap = 20
            scale = 0.3
            resize()
          }
        }
        sampled = 0
        slowFrames = 0
      }
    }
    lastDraw = now

    if (!reduced) {
      sim += dt
      const k = Math.min(1, dt * 2.2)
      mouse.x += (mouse.tx - mouse.x) * k
      mouse.y += (mouse.ty - mouse.y) * k
    }
    draw(now)
    if (animating() && !document.hidden) raf = requestAnimationFrame(frame)
  }

  function start() {
    if (raf || destroyed || lost || document.hidden) return
    lastNow = 0
    lastDraw = 0
    raf = requestAnimationFrame(frame)
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  /** Draw once now (reduced motion / resize while paused). */
  function redraw() {
    if (destroyed || lost) return
    if (raf) return
    draw(performance.now())
    if (animating()) start()
  }

  /* ── listeners ────────────────────────────────────────────────── */
  const onMood = () => {
    const next = readPalette(root)
    const same = (['a', 'b', 'c', 'd', 'e'] as const).every((k) => next[k].every((v, i) => Math.abs(v - palTo[k][i]) < 1e-3))
    if (!same) {
      palFrom = pal
      palTo = next
      palStart = performance.now()
    }
    if (reduced || paused) redraw()
    else start()
  }
  const mo = new MutationObserver(onMood)
  mo.observe(root, { attributes: true, attributeFilter: ['data-mood', 'style', 'class'] })

  const ro = new ResizeObserver(() => {
    resize()
    if (!raf) redraw()
  })
  ro.observe(canvas)

  const onVisibility = () => {
    if (document.hidden) stop()
    else if (animating()) start()
  }
  document.addEventListener('visibilitychange', onVisibility)

  const onPointer = (e: PointerEvent) => {
    if (reduced) return
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1
    mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1)
  }
  window.addEventListener('pointermove', onPointer, { passive: true })

  const onReduced = () => {
    reduced = mqReduced.matches
    if (reduced) {
      mouse.x = mouse.tx = 0
      mouse.y = mouse.ty = 0
      stop()
      redraw()
    } else if (animating()) start()
  }
  mqReduced.addEventListener('change', onReduced)

  const onLite = () => {
    fpsCap = mqLite.matches ? 30 : 60
  }
  mqLite.addEventListener('change', onLite)

  const onLost = (e: Event) => {
    e.preventDefault()
    lost = true
    stop()
    opts.onLost?.()
  }
  const onRestored = () => {
    lost = false
    readySent = false
    if (!init()) {
      opts.onFail()
      return
    }
    resize()
    redraw()
    if (animating()) start()
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)

  resize()
  if (reduced) redraw()
  else start()

  return {
    setPaused(p: boolean) {
      if (p === paused || destroyed) return
      paused = p
      if (!paused) {
        if (animating()) start()
        return
      }
      // a crossfade finishes on its own, then the loop sleeps (see animating)
      if (palStart >= 0) return
      stop()
      // never leave an empty canvas behind (e.g. paused before the first frame)
      if (!readySent) redraw()
    },
    destroy() {
      destroyed = true
      stop()
      mo.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointermove', onPointer)
      mqReduced.removeEventListener('change', onReduced)
      mqLite.removeEventListener('change', onLite)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      release()
    },
  }
}
