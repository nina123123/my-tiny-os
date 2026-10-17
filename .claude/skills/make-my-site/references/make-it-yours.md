# Make it theirs: what to change, and where

The demo is deliberately only *one* possible look. It's dreamy pastel: glossy 3D bubbles, a coral accent, a soft serif plus a handwritten font, rounded frosted-glass windows, and a playful sticker layer (bobbing stickers, doodles, tilted cards, sparkles). Treat all of that as scaffolding. The person's brief (`docs/DESIGN.md`) decides the look, and every section below needs a deliberate decision.

A useful way to think about it is four layers, from cheapest to deepest. A calm or serious brief usually needs all four; a dreamy-playful brief might only need the first two.

1. **Identity & words**: name, logo, the voice of every label.
2. **Color & type**: palette, moods, fonts, wallpaper.
3. **Shape & texture**: corner radii, glass vs. paper vs. flat, shadows, grain.
4. **Playfulness**: stickers, doodles, tilts, wiggles. Turn this up, down, or swap it for their own signature.

## 1. Identity & words

| What | Where | Notes |
| --- | --- | --- |
| Name, OS name, tagline, motif, intro, bio | `src/content/profile.ts` | Every UI string that names the owner or the OS reads from here (menu bar, status bar, boot screen, About dialog, app titles, tab title). Change it here, never by search-and-replace in components. **Don't put the motif emoji inside `superpower`**: the welcome card and About add `motif.emoji` themselves, so it would show twice. |
| Projects, contact links | `src/content/projects.ts`, `src/content/links.ts` | See `docs/EDITING.md`. Use `{ front, back }` pairs for `funFacts`. A plain string shows the same text on both sides of the flip card. |
| Which apps exist | `HIDDEN_APPS` in `src/os/apps.ts` | e.g. `['guestbook']`. Every icon, menu item and button that opens a hidden app disappears too. On the phone, set `homeDock: true` on the remaining apps so the dock doesn't hold just one icon. `welcome`, `projects`, `project` and `about` always stay on. |
| App names, window titles, descriptions | `src/os/apps.ts` | In their voice ("say hi", "the lab", "Get in touch"). |
| Mood names, mood emoji, mood menu name | `src/content/moods.ts` | Used by the menu bar, the right-click menu and the phone status bar. |
| Every other visible word | Run `node scripts/list-ui-text.mjs` | It lists ~150 lines of UI text living in code: boot messages, menu hints, the battery label, toasts, error states, section headings, button labels, aria labels. Do a **voice pass** over all of it. A sentence-case or polished brief means touching most of these lines. Make aria labels match the visible words. |
| Guestbook copy, stickers and paper colors | `src/apps/guestbook/` (incl. `local.ts` sample notes), `src/lib/guestbook.ts` | The sticker and color lists must stay in sync with `supabase/guestbook.sql`, which checks them. Change both together. |
| Page title, description, link preview | `index.html` meta tags; `node scripts/make-share-images.mjs` | `index.html` can't read profile.ts, so edit it by hand. The script renders `public/og.jpg` (≤ 300 KB) from their desktop and `public/apple-touch-icon.png` from the favicon. Run it with the dev server up, after the look is done. |

## 2. Color & type

| What | Where | Notes |
| --- | --- | --- |
| Palette | The raw palette at the top of `src/styles/tokens.css`, then the semantic tokens in `:root` | **Never rename or delete a token.** Change values only. About 200 references to the raw names (`--coral-500`, `--lavender-200` …) live in component CSS and in the project categories in `projects.ts`, so renaming silently breaks them. Want names that fit the new palette? Add new variables (`--sage-500`), then point the old names at them (`--lavender-300: var(--sage-200)`), so everything keeps working. |
| Moods | The `[data-mood='sunset']` and `[data-mood='night']` blocks in tokens.css | Recolor all three. Night must stay a real dark mode, and every mood must pass contrast (see the quality bar below). For a dark-first brief, set the default mood in `src/os/settings.ts`. |
| Colors that live outside tokens.css | ~200 `rgb()`/hex values in component CSS, plus `src/App.tsx` (`theme-color` per mood), the `.preboot` sky in `index.html`, `SUNRISE` in `src/fx/wallpaper/palette.ts`, `CoverArt.tsx`, `AppIcon.tsx` (palette at the top), the contact tiles and plane in `src/apps/contact/` | Find them with `grep -rnE "rgb\(\|#[0-9a-fA-F]{3,6}" src --include=*.css \| grep -v tokens.css` and the same over `*.tsx`. Most are the demo's plum ink (`59 37 89`) or pastel washes. Map them in one pass, from old color to new, and keep the alpha values. |
| Fonts | `src/styles/global.css` (`@import '@fontsource…'`), `package.json`, `--font-display / --font-body / --font-hand / --font-mono` (+ `--display-axes`) in tokens.css | Install with `npm i @fontsource-variable/<name>` or `@fontsource/<name>`; fonts are the one kind of dependency you should add. Remove fonts you stop using. If the display font isn't variable, set `--display-axes: normal`. `--font-hand` is used by ~19 rules tuned for a script font (Caveat). If you swap it for an italic or typewriter face, re-check sizes and weights there. Two families plus one accent face is typical, but a flyer or zine look can justify a third. |
| Wallpaper | `WALLPAPER` in `src/content/look.ts`; colors `--wp-a … --wp-e` and `--bg-grad` in each mood; art in `src/fx/wallpaper/wallpaper.css` | Options: `'blobs'` (glossy 3D, the demo), `'soft'` (blurred CSS blobs), `'flat'` (just `--bg-grad` + grain). Use `'flat'` for paper, concrete, graph paper, print or minimal looks, then paint the texture on `.wp__base` with CSS gradients. Glossy blobs read as "startup" on a gritty or scholarly brief. The soft CSS blobs blend toward white, so give night its own washes, or they turn grey. |
| Logo + icons | `src/components/Logo.tsx`, `public/favicon.svg`, then `make-share-images.mjs` for the touch icon | Draw a small SVG mark from their motif. It must read at 14px in the menu bar and look good at 64px on the boot screen. Use tokens or `currentColor` so it follows the moods. |
| App icons | `src/components/AppIcon.tsx` (palette constants at the top, one glyph per app) | Recolor them to the palette. Redraw a glyph if it clashes with the motif (e.g. a setlist for a musician's Projects). |
| Window controls | `--ctl-close / --ctl-min / --ctl-max` in tokens.css | Small, but visible on every window. |

## 3. Shape & texture

| What | Where | Notes |
| --- | --- | --- |
| Corner radii | `--r-*` and `--r-window` in tokens.css; ~140 hard-coded `border-radius` values in component CSS; `CARD_RADIUS` in `src/shell/mobile/AppSheet.tsx`; the corner cap in `src/shell/mobile/geometry.ts` | Round and soft is the demo. Print, flyer and brutalist looks want small or zero radii. Change the tokens first, then sweep the hard-coded values. |
| Glass vs. paper | `--glass-blur`, `--surface*` and `--border` in tokens.css; ~40 `backdrop-filter` rules in component CSS | For paper or flat looks, make the surfaces opaque, drop the blur (`--glass-blur: 0px`, and remove the rules that hard-code blur), and use borders or hard shadows instead. |
| Shadows | `--shadow-*` in tokens.css | Soft and deep is the demo. Hard offset shadows (`4px 4px 0 var(--ink)`) suit sticker or flyer looks. Hairlines suit scholarly ones. |
| Grain and texture | `.wp__grain` in `wallpaper.css`, and any texture you paint on `.wp__base` | Halftone, photocopy grain, paper fibre, graph lines. |
| Boot screen | `src/shell/boot/BootScreen.tsx` + `boot.css` | The first 2 seconds. Rebuild the animation around their logo and motif (a drummer's count-in, a seedling growing). Rewrite the messages in their voice. |

## 4. Playfulness

The demo's sticker-book layer is spread across several components. Decide whether it stays, gets toned down, or gets replaced by **one** signature of theirs (masking tape, ink stamps, pixel sparkles…).

| Element | Where |
| --- | --- |
| Floating stickers, motif sticker, waving hand | `src/apps/welcome/Stickers.tsx` + `stickers.css` (`MotifSticker`, used by welcome and About) |
| Handwritten "psst" note and arrow doodle | `src/apps/welcome/index.tsx` (`wl-psst`) + `welcome.css` |
| Tilted cards, hover tilt | `src/apps/projects/tilt.ts`, `src/shell/desktop/PhotoStack.tsx` + `photostack.css` |
| ✦ sparkles on headings and stats, spinning rings | `src/apps/projects/`, `src/apps/project/`, `src/apps/about/` (search for `✦`, `spark`, `ring`) |
| Phone greeting blobs, sparkles, flip words | `src/shell/mobile/Greeting.tsx` + `mobile.css` |
| Jokey copy ("100% energy", "good vibes") | Covered by the voice pass (`node scripts/list-ui-text.mjs`) |

## "Different from the demo" checklist

Before showing the first full version, confirm each item.

- [ ] OS name, owner name and tagline come from profile.ts and show everywhere (menu bar, phone status bar, boot screen, tab title, link preview).
- [ ] Only the apps they wanted are on (`HIDDEN_APPS`), and the phone dock still looks full.
- [ ] Palette values replaced (names kept). The accent is **their** color, not the demo coral, unless they asked for coral. The hard-coded colors are remapped too.
- [ ] All three moods recolored and renamed in `src/content/moods.ts`. The wallpaper style fits the brief.
- [ ] The display font is chosen for them. The body font is changed, or kept deliberately (and noted in the brief).
- [ ] Shape and texture match the brief: radii, glass or paper, shadows.
- [ ] Playfulness set deliberately: kept, toned down, or replaced with their signature.
- [ ] New logo from their motif, plus favicon, touch icon and link preview (`make-share-images.mjs`).
- [ ] Boot screen and its messages fit the motif and voice.
- [ ] Voice pass done over `node scripts/list-ui-text.mjs`.
- [ ] `check-leftovers.sh` "Must fix" is clean.

## Quality bar while restyling

- **Contrast:** body text needs ≥ 4.5:1 against the surfaces in every mood, and the focus ring ≥ 3:1. Use `--accent-ink` for accent-colored text on light backgrounds. Set `--on-accent` (the text color on accent buttons) to whatever passes, which is often dark ink rather than white.
- **The accent is a pop.** If everything is accent-colored, nothing stands out.
- **Phone first** when visitors come from group chats or Instagram: check the phone screenshots before the desktop ones.
- **Reduced motion** must still work after any animation change (`prefers-reduced-motion`).
- **Screenshots:** `/?skipboot` needs `--wait=4500` to settle. Use `--settle=` after clicks, and `--scroll` to see the bottom of a window.
