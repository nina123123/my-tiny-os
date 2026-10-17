import { useEffect, useLayoutEffect, useRef } from 'react'

type CountUpProps = {
  to: number
  prefix?: string
  suffix?: string
  /** ms */
  duration?: number
  className?: string
}

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Counts from 0 to `to` once it scrolls into view. The ticking digits are
 * written straight to a text node in rAF (no React state per frame); screen
 * readers get the final value only.
 */
export function CountUp({ to, prefix = '', suffix = '', duration = 1400, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const numRef = useRef<HTMLSpanElement>(null)
  const format = (n: number) => `${prefix}${n.toLocaleString()}${suffix}`
  const formatRef = useRef(format)
  useLayoutEffect(() => {
    formatRef.current = format
  })

  // Paint the starting value before the first frame (the span has no React children).
  useLayoutEffect(() => {
    const num = numRef.current
    if (num) num.textContent = formatRef.current(reduced() ? to : 0)
  }, [to])

  useEffect(() => {
    const el = ref.current
    const num = numRef.current
    if (!el || !num) return
    const paint = (n: number) => {
      num.textContent = formatRef.current(n)
    }
    if (reduced() || typeof IntersectionObserver === 'undefined') {
      paint(to)
      return
    }
    let raf = 0
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration)
          const eased = 1 - Math.pow(1 - t, 4)
          paint(Math.round(to * eased))
          if (t < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [to, duration])

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{format(to)}</span>
      <span ref={numRef} aria-hidden="true" />
    </span>
  )
}
