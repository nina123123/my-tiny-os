import type { CSSProperties } from 'react'
import type { ProjectCategory } from '../../content/types'
import '../welcome/stickers.css'

/** Small tinted pill naming a project's category (uses the category color). */
export function CategoryChip({ category, className }: { category?: ProjectCategory; className?: string }) {
  if (!category) return null
  return (
    <span className={`wk-chip${className ? ` ${className}` : ''}`} style={{ '--chip': category.color } as CSSProperties}>
      <span className="wk-chip__dot" aria-hidden="true" />
      {category.label}
    </span>
  )
}
