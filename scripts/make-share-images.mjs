#!/usr/bin/env node
/*
 * Makes the two images people see when your link is shared or saved:
 *   public/og.jpg              1200×630 link preview (iMessage, WhatsApp, Instagram DMs…)
 *   public/apple-touch-icon.png 180×180 home-screen icon, drawn from public/favicon.svg
 *
 * Run it with the dev server up (npm run dev):
 *   node scripts/make-share-images.mjs [http://localhost:5173] [--icon-bg=#ffffff] [--mood=night]
 *
 * The preview is a screenshot of your desktop (the welcome card included), saved as a
 * JPEG under 300 KB so every app shows it. Re-run it after a big look change.
 */
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const base = (args.find((a) => !a.startsWith('--')) || 'http://localhost:5173').replace(/\/$/, '')
const opt = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback

const browser = await chromium.launch()

// 1) link preview
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
const mood = opt('mood', '')
await page.goto(`${base}/?skipboot`, { waitUntil: 'networkidle' })
if (mood) {
  await page.evaluate((m) => (document.documentElement.dataset.mood = m), mood)
}
await page.waitForTimeout(4500)
let quality = 85
let size = Infinity
while (quality >= 45) {
  const buf = await page.screenshot({ path: 'public/og.jpg', type: 'jpeg', quality })
  size = buf.length
  if (size <= 300 * 1024) break
  quality -= 10
}
console.log(`saved public/og.jpg (${Math.round(size / 1024)} KB, quality ${quality})`)

// 2) home-screen icon from the favicon
const svg = await readFile('public/favicon.svg', 'utf8')
const icon = await browser.newPage({ viewport: { width: 180, height: 180 } })
const bg = opt('icon-bg', '#ffffff')
await icon.setContent(
  `<body style="margin:0;width:180px;height:180px;display:grid;place-items:center;background:${bg}">
     <div style="width:132px;height:132px">${svg.replace('<svg', '<svg width="132" height="132"')}</div>
   </body>`,
)
await icon.screenshot({ path: 'public/apple-touch-icon.png' })
console.log('saved public/apple-touch-icon.png')

await browser.close()
console.log('Now update the og:image:alt text in index.html to describe the new preview.')
