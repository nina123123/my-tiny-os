import { useEffect, useRef, type PointerEvent } from 'react'

/*
 * 3D tilt toward the mouse with a soft glare. Writes CSS custom properties
 * straight onto the element (one rAF per pointer move, no React state), and
 * only reacts to real mice, so touch and pens never tilt. Pass enabled=false
 * for reduced motion / coarse pointers.
 *
 * CSS reads: --rx, --ry (deg), --gx, --gy (glare position, %), [data-tilt].
 */
export function useTilt(enabled: boolean, max = 9) {
  const raf = useRef(0)

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!enabled || e.pointerType !== 'mouse') return
    const el = e.currentTarget
    const { clientX, clientY } = e
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return
      const px = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
      const py = Math.min(1, Math.max(0, (clientY - r.top) / r.height))
      el.style.setProperty('--rx', `${((0.5 - py) * max).toFixed(2)}deg`)
      el.style.setProperty('--ry', `${((px - 0.5) * max * 1.15).toFixed(2)}deg`)
      el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`)
      el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`)
      el.dataset.tilt = 'on'
    })
  }

  const onPointerLeave = (e: PointerEvent<HTMLElement>) => {
    cancelAnimationFrame(raf.current)
    const el = e.currentTarget
    el.style.removeProperty('--rx')
    el.style.removeProperty('--ry')
    delete el.dataset.tilt
  }

  return enabled ? { onPointerMove, onPointerLeave } : {}
}
