#!/usr/bin/env node
/*
 * Screenshot helper for local visual checks (uses the preinstalled Chromium).
 *
 *   node scripts/screenshot.mjs <url> <out.png> [options]
 *
 * Options:
 *   --mobile               390×844 @2x, touch, coarse pointer (iPhone-ish)
 *   --size=1440x900        viewport (default 1440x900)
 *   --wait=1200            ms to wait after load (default 1200; use ~4500 for /?skipboot so the desktop settles)
 *   --settle=700           ms to wait after each step below (default 700; raise it for slow animations)
 *   --click="selector"     click a selector (repeatable; runs in order, 600ms apart)
 *   --dblclick="selector"  double-click a selector (repeatable)
 *   --press="Key"          keyboard press (repeatable), e.g. --press=Escape
 *   --type="text"          type text
 *   --hover="selector"     hover a selector
 *   --mouse=x,y            move the mouse to x,y
 *   --reduced              emulate prefers-reduced-motion: reduce
 *   --dark                 emulate prefers-color-scheme: dark
 *   --full                 full-page screenshot (the page only: windows scroll inside themselves, so use --scroll)
 *   --scroll               scroll every scrollable area (e.g. the open window's body) to its bottom
 *   --scroll="selector"    scroll just that element to its bottom (repeatable, like the other steps)
 * Prints console errors and page errors to stderr (exit code 2 if any).
 */
import { chromium } from 'playwright'

const [url, out, ...rest] = process.argv.slice(2)
if (!url || !out) {
  console.error('usage: node scripts/screenshot.mjs <url> <out.png> [options]')
  process.exit(1)
}
const opts = { steps: [] }
for (const arg of rest) {
  const [k, ...v] = arg.replace(/^--/, '').split('=')
  const val = v.join('=')
  if (['click', 'dblclick', 'press', 'type', 'hover', 'mouse', 'scroll'].includes(k)) opts.steps.push([k, val])
  else opts[k] = val === '' ? true : val
}
const mobile = !!opts.mobile
const [w, h] = (opts.size || (mobile ? '390x844' : '1440x900')).split('x').map(Number)
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: w, height: h },
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
  hasTouch: mobile,
  reducedMotion: opts.reduced ? 'reduce' : 'no-preference',
  colorScheme: opts.dark ? 'dark' : 'light',
})
const page = await context.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(Number(opts.wait ?? 1200))
for (const [k, val] of opts.steps) {
  try {
    if (k === 'click') await (mobile ? page.tap(val) : page.click(val))
    else if (k === 'dblclick') await page.dblclick(val)
    else if (k === 'press') await page.keyboard.press(val)
    else if (k === 'type') await page.keyboard.type(val, { delay: 40 })
    else if (k === 'hover') await page.hover(val)
    else if (k === 'scroll')
      await page.evaluate((sel) => {
        const els = sel ? [...document.querySelectorAll(sel)] : [...document.querySelectorAll('*')]
        for (const el of els) {
          const oy = getComputedStyle(el).overflowY
          if (sel || ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 4)) el.scrollTo(0, el.scrollHeight)
        }
      }, val === true || val === '' ? '' : val)
    else if (k === 'mouse') {
      const [x, y] = val.split(',').map(Number)
      await page.mouse.move(x, y, { steps: 12 })
    }
  } catch (e) {
    errors.push(`step ${k}=${val} failed: ${e.message.split('\n')[0]}`)
  }
  await page.waitForTimeout(Number(opts.settle ?? 700))
}
await page.screenshot({ path: out, fullPage: !!opts.full })
await browser.close()
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(2)
}
console.log(`saved ${out}`)
