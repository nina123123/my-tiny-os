#!/usr/bin/env node
/*
 * Lists the words the site shows that live in code rather than in src/content/:
 * button labels, menu items, headings, hints, boot messages, error messages,
 * aria labels… grouped by file with line numbers. Use it for the "voice pass":
 * make every line sound like the owner (lowercase and chill, polished, loud…).
 *
 *   node scripts/list-ui-text.mjs            all files
 *   node scripts/list-ui-text.mjs about      only files whose path contains "about"
 *
 * It's a quick text scan, not a parser: it can miss a line or show a non-UI string.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const filter = process.argv[2] ?? ''
const SKIP = ['src/content/', 'src/dev/', 'src/lib/supabase', 'src/fx/wallpaper/']

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx|ts)$/.test(f) ? [p] : []
  })
}

const PROP = /\b(label|hint|title|placeholder|aria-label|alt|description|name|kicker|text|caption)\s*[:=]\s*\{?\s*(['"`])((?:(?!\2).)*[a-zA-Z]{2,}(?:(?!\2).)*)\2/g
const JSX_TEXT = />\s*([^<>{}=;]*[a-zA-Z]{2,}[^<>{}=;]*?)\s*</g
const SENTENCE = /(['"`])((?:(?!\1).)*[a-z]{2,} [a-z]{2,}(?:(?!\1).)*[.!?…♡)]?)\1/g

let total = 0
for (const file of walk('src').sort()) {
  if (SKIP.some((s) => file.startsWith(s)) || !file.includes(filter)) continue
  const hits = []
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const t = line.trim()
      if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('import ')) return
      if (/className=|console\.|throw new Error|querySelector|matchMedia|localStorage|addEventListener/.test(t)) return
      const found = new Set()
      for (const m of t.matchAll(PROP)) found.add(m[3])
      if (file.endsWith('.tsx')) for (const m of t.matchAll(JSX_TEXT)) found.add(m[1])
      for (const m of t.matchAll(SENTENCE)) found.add(m[2])
      for (const s of found) if ((!/^[\w-]+$/.test(s) || /\s/.test(s)) && !/\(e:|&&|=>|\|\|/.test(s)) hits.push(`  ${String(i + 1).padStart(4)}  ${s}`)
    })
  if (hits.length) {
    console.log(`\n${file}`)
    console.log([...new Set(hits)].join('\n'))
    total += hits.length
  }
}
console.log(`\n${total} lines of UI text outside src/content/`)
