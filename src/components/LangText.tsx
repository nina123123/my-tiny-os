import type { ReactElement } from 'react'

/*
 * Marks Korean and Chinese runs inside English text with their language, so
 * screen readers switch voice and pronunciation for them (WCAG 3.1.2):
 *   "In-yeon (인연)"  →  In-yeon (<span lang="ko">인연</span>)
 *   "Mountain 山"     →  Mountain <span lang="zh">山</span>
 * Text without any such run comes back unchanged. For visible text only;
 * aria-label strings can't carry lang and stay plain.
 */

// Hangul syllables + jamo (incl. compatibility jamo) | CJK ideographs + CJK
// punctuation (《》「」。、…) + the common full-width marks (，！？：；)
const RUN = /([\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]+)|([\u3400-\u4DBF\u4E00-\u9FFF\u3000-\u303F\uFF01\uFF0C\uFF1A\uFF1B\uFF1F]+)/g

export function LangText({ text }: { text: string }) {
  const out: (string | ReactElement)[] = []
  let last = 0
  for (const m of text.matchAll(RUN)) {
    const at = m.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    out.push(
      <span key={at} lang={m[1] ? 'ko' : 'zh'}>
        {m[0]}
      </span>,
    )
    last = at + m[0].length
  }
  if (!out.length) return text
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}
