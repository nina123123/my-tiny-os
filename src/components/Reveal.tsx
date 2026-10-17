import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  as?: ElementType
  className?: string
  style?: CSSProperties
  /** ms delay before this element animates in (stagger siblings with i * 70) */
  delay?: number
  /** px to rise from */
  y?: number
  /** starting scale, e.g. 0.96 */
  scale?: number
  /** keep re-animating when scrolled out and back in */
  repeat?: boolean
  /** IntersectionObserver threshold */
  threshold?: number
  /** Called once the element becomes visible */
  onReveal?: () => void
}

/**
 * Fades/rises/unblurs its children in when scrolled into view — works inside
 * scrolling windows and sheets too (IO clips by overflow ancestors).
 * Styling lives in global.css (.reveal); the visible state is the
 * `data-revealed="true"` attribute, written straight to the DOM so revealing
 * never re-renders the subtree.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  className,
  style,
  delay = 0,
  y = 18,
  scale = 1,
  repeat = false,
  threshold = 0.15,
  onReveal,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null)
  const onRevealRef = useRef(onReveal)
  useLayoutEffect(() => {
    onRevealRef.current = onReveal
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const show = (on: boolean) => {
      el.dataset.revealed = on ? 'true' : 'false'
      if (on) onRevealRef.current?.()
    }
    if (typeof IntersectionObserver === 'undefined') {
      show(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          show(true)
          if (!repeat) io.disconnect()
        } else if (repeat && el.dataset.revealed === 'true') {
          show(false)
        }
      },
      { threshold, rootMargin: '0px 0px -6% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [repeat, threshold])

  return (
    <Tag
      ref={ref}
      className={className ? `reveal ${className}` : 'reveal'}
      style={
        {
          ...style,
          '--reveal-delay': `${delay}ms`,
          '--reveal-y': `${y}px`,
          '--reveal-scale': scale,
        } as CSSProperties
      }
    >
      {children}
    </Tag>
  )
}
