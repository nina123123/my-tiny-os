# Architecture

A personal website that looks like a tiny operating system. Static, client-only, deployed to
GitHub Pages. This is the developer overview; content editing is in [EDITING.md](EDITING.md),
the guestbook backend in [GUESTBOOK.md](GUESTBOOK.md).

**Stack:** Vite + React 19 + TypeScript, `motion` (import from `motion/react`) for animation,
`zustand` for state, plain CSS co-located with components. Fonts are self-hosted through
`@fontsource` packages. Avoid new npm dependencies (write the small thing yourself); fonts are the
exception: add the `@fontsource` packages the owner's look needs.

**Conventions:** class names are prefixed per module (`.win__titlebar`, `.dock__btn`,
`.pj-tile`, `.gb__note`, `.msheet__body`) so modules never collide. Components mostly use the
semantic tokens from `src/styles/tokens.css` so every mood works, but many illustration colors,
radii and blurs are still hard-coded in component CSS (a restyle has to sweep them; see the
make-my-site skill's `make-it-yours.md`). Never rename or delete a token. UI never hard-codes
the owner's name: it comes from `src/content/profile.ts`. Other UI wording lives in the
components; `node scripts/list-ui-text.mjs` lists it.

## Folder map

```
index.html                 static <head>: tab title, description, og/twitter tags, pre-paint mood script
src/
  main.tsx                 mounts <App/>, or the dev Harness when ?app= is in the URL (dev only)
  App.tsx                  Wallpaper → <main class="os"> (DesktopShell | MobileShell) → Toaster → BootScreen
  content/                 ALL owner content: profile.ts, projects.ts, links.ts (+ types.ts)
  os/
    types.ts               AppId, AppDef, AppProps, WindowState, OpenOptions, Rect
    apps.ts                app registry: APPS (order = icon order), getApp()
    store.ts               useWindows (window manager), openApp(), workArea(), clampRect(), fitRect()
    settings.ts            useSettings: mood (persisted), booted, seenBoot
    AppHost.tsx            lazy-loads an app with Suspense + an error boundary
    preload.ts             preloadApp(appId): warm an app's chunk early
    anchors.ts             registerAnchor / getAnchor / rectOf: icon rects for open/minimize animations
    notify.ts              useNotify / notify(): toasts
    useMedia.ts            useIsMobile (MOBILE_QUERY), useReducedMotion, useFinePointer, useMedia
  apps/<id>/index.tsx      one folder per app; default export = component(AppProps)
  shell/desktop/           DesktopShell: MenuBar, Desktop (icons, context menu, Widgets, DecorLayer +
                           PhotoStack), WindowLayer/WindowFrame, Dock, Menu, AboutDialog, shellStore
  shell/mobile/            MobileShell: StatusBar, HomeScreen (Greeting, Widgets, HomeIcon grid + dock),
                           SheetStack/AppSheet, useSheetHistory
  shell/boot/              BootScreen
  fx/                      Wallpaper (+ wallpaper/renderer.ts, shader.ts, palette.ts), Toaster
  components/              AppIcon, Logo, OsName, CoverArt, CountUp, Reveal, LangText,
                           responsiveImage.ts + photoWidths.ts (generated)
  lib/                     supabase.ts, guestbook.ts, osName.ts, windowStash.ts, useBackDismiss.ts, env.d.ts
  styles/                  tokens.css (palette, moods, type, sizes), global.css (fonts, reset, utilities),
                           os.css (root layout, AppHost states)
  dev/Harness.tsx          dev-only single-app harness
public/                    favicon.svg, apple-touch-icon.png, og.jpg, media/ (photos, created by the owner)
supabase/guestbook.sql     the guestbook table, RLS policies and flood-guard trigger
scripts/                   resize-photos.py (metadata strip + 640px copies), screenshot.mjs (Playwright)
.github/workflows/deploy.yml   lint + build every branch, deploy main to GitHub Pages
.claude/skills/make-my-site/   Claude skill that customizes the template for a new owner
```

## Apps: contract and registry

`src/os/apps.ts` exports `APPS: AppDef[]`. Today: `welcome` (the chromeless Hello card),
`projects`, `project` (one project's story, never an icon), `about`, `guestbook`, `contact`.
`HIDDEN_APPS` switches apps off: their icons go, and every menu item and button that opens them
checks `isAppOn(id)` (menu bar, desktop context menu, welcome card, phone greeting, About's end
card, Contact's paper plane, the privacy note). When you add a new way to open an app, guard it
with `isAppOn` too.
Each `AppDef` has:

| Field | Meaning |
| --- | --- |
| `id`, `name`, `title`, `description` | id (`AppId` union in `types.ts`), icon label, default window title, tooltip / screen-reader text (several read `profile.firstName`) |
| `load` | `() => import('../apps/<id>')`: every app is code-split |
| `defaultSize`, `minSize` | desktop window sizes |
| `desktop`, `dock` | desktop icon / dock icon |
| `home`, `homeDock` | phone home grid (`home && !homeDock`) / phone dock row (`home && homeDock`) |
| `singleton` | one window per app; re-opening focuses it and bumps `pokes` |
| `chromeless` | transparent frame, floating close; the app draws its own card (`welcome`) |

Apps receive `AppProps = { windowId, params, isMobile }`. An app should fill its container
(`height: 100%`), own its single scroll container, keep a transparent background (the frame
provides the glass; use `--surface-strong` for cards), work from 320px to a maximized window
(prefer container queries), and not duplicate the title on mobile (the sheet header shows it).
Chromeless apps mark their drag region with `data-window-drag`.

**Adding an app:** add the id to `AppId` (`os/types.ts`), an entry in `APPS`, a folder
`src/apps/<id>/` with a default-exported component, and a recipe in `RECIPES` in
`src/components/AppIcon.tsx` (typed `Record<AppId, …>`, so TypeScript reminds you).

## Window manager (`src/os/store.ts`)

`useWindows` holds `windows: WindowState[]`, `focusedId` and `topZ`. It is the single source of
truth for **both** shells: desktop windows, and the phone's stack of sheets.

- `open(appId, { windowId?, title?, params?, origin? }) → id`. Singletons use `appId` as the id;
  others get `${appId}:${n}` unless a `windowId` is given. Projects always open through
  `openProject()` (`apps/projects/shared.ts`): `windowId: 'project:' + id`,
  `params: { projectId }`, `title: project.title`.
- `close`, `closeAll`, `focus`, `minimize`, `restore`, `toggleMaximize`, `move` (via
  `clampRect`: the title bar stays reachable), `resize` (min size enforced), `setTitle`.
  `openApp()` is the non-hook shortcut.
- Window z-index is `100 + w.z`. `workArea()` is the viewport minus `MENUBAR_H` (32) and
  `DOCK_H` (78); keep those in sync with `--menubar-h` / `--dock-h` in `tokens.css`.
- New windows cascade and are placed with `fitRect()` (fully inside the work area, with headroom
  for chromeless cards). `prefWidth`/`prefHeight` remember the wanted size: a viewport resize
  squeezes windows, and they grow back when there's room again (rAF-batched refit).
- `setDesktopIconsEdge(px)` lets the desktop report where its left icon columns end, so the
  welcome card opens beside them on narrow screens.
- `origin` is the rect a window grows out of (`rectOf(el)`); shells register icon rects with
  `registerAnchor(appId, …)` so minimize/close can fly back into the dock or home icon. Dock
  tiles for minimized windows without their own icon (a project) register via
  `registerDockTile()` in `shell/desktop/shellStore.ts`.

`AppHost` keeps one `lazy()` component per app (created at module load) and an error boundary;
a failed chunk (offline, or a redeploy replaced hashed files) offers a reload.

## Desktop shell vs mobile shell

`App.tsx` renders **one** shell, chosen by `useIsMobile()`:
`MOBILE_QUERY = '(max-width: 767px), (pointer: coarse) and (max-width: 900px)'`. Crossing it
(rotating an iPad, resizing a window) unmounts one shell and mounts the other; the window store
survives, so open apps carry over.

- **Desktop** (`shell/desktop/DesktopShell.tsx`): `MenuBar` (OS menu with About / Privacy /
  Restart, File, Edit, Vibes, Help; mood toggle, clock), `Desktop` (icon grid with drag & snap,
  positions saved in `localStorage` `tinyos-desktop-icons-v1`; right-click / Shift+F10 context
  menu; `Widgets`, the "now" card from 1100px; `DecorLayer` places the `PhotoStack` of project
  polaroids in a free corner when it fits), `WindowLayer` → `WindowFrame` (drag, 8-edge resize,
  maximize, minimize-to-dock with FLIP transforms; minimized windows stay mounted), `Dock`
  (magnification via motion values, tiles for minimized project windows), `AboutDialog`.
- **Mobile** (`shell/mobile/MobileShell.tsx`): `StatusBar` (clock, wordmark that scrolls to top,
  mood toggle), `HomeScreen` (`Greeting` card, `Widgets`: latest project + "currently", the app
  grid, the glass dock row, an "about & privacy" link; long-press starts jiggle mode),
  `SheetStack` → `AppSheet` (each non-minimized window as a full-screen sheet ordered by `z`;
  stacked sheets become cards; drag the header down to dismiss), `AboutDialog`.
- **History on phones:** `useSheetHistory` pushes one history entry per open sheet so the back
  gesture closes the top sheet; `lib/useBackDismiss.ts` gives an in-app overlay (the Lightbox) its
  own entry so back closes it first. Desktop windows don't touch history.
- **Shell swaps:** `store.ts` re-lays out windows that only ever existed as sheets when the
  desktop shell takes over. `lib/windowStash.ts` (`keepForWindow` / `peekStash`) carries
  in-memory app state across the remount for as long as the window is open (the guestbook draft).
- `shellStore.ts` (`useShellUI`) holds the About dialog state: `openAbout()`, and
  `openPrivacy()` (opens it with the privacy note unfolded), used by both shells.

## Boot

`BootScreen` plays a sunrise with the OS's name (`osName`) letter by letter: ~2.6s the first
time, ~1.2s once `seenBoot` is persisted, a short fade with reduced motion; a click, tap,
Enter, Space or Escape skips it. `onDone` → `setBooted()`; on desktop-sized screens it then opens `welcome`. While not
booted, `<main class="os">` is `inert`. `?skipboot` in the URL skips the boot (handy for
screenshots and deep checks). **Restart…** in the OS menu calls `restartOS()`
(`shell/desktop/actions.ts`): close all windows and replay the boot. `index.html` paints a
`.preboot` sky before the JS arrives.

## Moods and settings

`useSettings` (`src/os/settings.ts`, zustand `persist` under `localStorage` key `tinyos-settings`,
wrapped in a storage that never throws) holds `mood` (`sunrise` | `sunset` | `night`, default
`sunrise`) and `seenBoot`; `booted` is per page load. `App.tsx` writes `<html data-mood>` and the
`theme-color` meta (hard-coded hex per mood there). The inline script in `index.html` applies a
saved mood before first paint. Moods are pure CSS: `tokens.css` defines every token under `:root`
(sunrise) and overrides some under `:root[data-mood='sunset']` / `:root[data-mood='night']`.
Mood switches live in the menu bar (the mood menu + the status glyph), the desktop context menu
and the phone status bar. Their names, emoji and the menu's title come from
`src/content/moods.ts`.

## Wallpaper (`src/fx/Wallpaper.tsx`)

Fixed, full-viewport, behind everything (`aria-hidden`). Layers: `.wp__base` (`--bg-grad`, instant
paint), `.wp__canvas` (WebGL raymarched pastel metaballs: `wallpaper/renderer.ts` owns the context,
fps cap, pause when hidden, still frame with reduced motion, pointer parallax, adaptive quality,
context loss; `wallpaper/shader.ts` holds the GLSL), or `.wp__css` blurred blobs when WebGL is
missing or fails, plus `.wp__grain`. Colors come from `--wp-a` … `--wp-e` (hex only), read by
`wallpaper/palette.ts` and crossfaded when `data-mood` changes (MutationObserver). On phones it
pauses once a sheet covers the screen and wakes while `.mhome-wrap.is-lifting` is set (a sheet
being dragged). `WALLPAPER` in `src/content/look.ts` picks the style: `'blobs'` (WebGL, falling
back to CSS blobs), `'soft'` (CSS blobs only) or `'flat'` (just `.wp__base` + grain, for textures
painted in `wallpaper.css`). Dev switches: `?gl=force` (run on software GL, e.g. headless
screenshots) and `?gl=off` (CSS fallback).

## Identity and theme

- `src/content/profile.ts` exports `profile` and `osName` (`profile.osName ?? firstName + 'OS'`).
  `osName` appears in the menu bar, boot screen, phone status bar, About dialog, Hello card and
  the page's `aria-label`.
- `src/lib/osName.ts` `splitOsName()` splits a trailing `OS` off for styling (`Alex` + `OS`);
  `src/components/OsName.tsx` `<OsWordmark/>` renders it (phone status bar); the boot screen uses
  the split for its letters.
- `src/components/Logo.tsx`: the rising-sun mark, colored by `--logo-1` … `--logo-3`, horizon in
  `currentColor`. `src/components/AppIcon.tsx`: the icon set (fixed illustration colors).
- `profile.motif` (`{ emoji, word }`) is highlighted by `MotifText` and drawn by `MotifSticker`
  (`src/apps/welcome/Stickers.tsx`, which also exports `Sticker` and `DrawnAvatar`).
- `index.html` is static: its `<title>`, description and og/twitter tags must be edited by hand.
- Fonts: imported at the top of `src/styles/global.css`, named by `--font-display`,
  `--font-body`, `--font-hand`, `--font-mono` in `tokens.css`.

## Content model

All owner content is typed in `src/content/types.ts`:

- **`Profile`** (`profile.ts`): `firstName`, `fullName`, optional `osName`, `tagline`, optional
  `motif`, `describedAs`, `bio`, `currently`, `funFacts`, and optional `avatar`/`avatarAlt`,
  `location`, `origin`, `superpower`, `intro`, `photos`, `languages`, `placeholder`.
- **`ProjectCategory`** and **`Project`** (`projects.ts`, with `getProject()` / `getCategory()`).
  Projects have `year` (display text, may be `''`) and `sortDate` (YYYYMM, `0` = undated → the
  Timeline's "along the way" group), `colors` for the generated cover (`CoverArt`), optional
  `cover`, `stats`, `story` sections (`\n\n` paragraphs), `gallery`, `videos` (YouTube ids),
  `links`, `tags`, `featured`, `placeholder`.
- **`ContactLink`** (`links.ts`): `mailto:` links get a copy button; `placeholder` or an empty
  `href` renders "coming soon".
- `apps/projects/shared.ts` is the one place for project logic: `openProject()`, `bentoLayout()`
  (featured first, each followed by two regular tiles), `PROJECT_ORDER`, `nextProject()`,
  `matches()` (accent-insensitive search), `categoryOf()`, `yearLabel()`. The desktop
  `PhotoStack` and the phone's latest-project widget skip `placeholder` projects.
- **Media paths** are relative (`media/<id>/<file>.webp`, no leading slash) because
  `vite.config.ts` uses `base: './'` and Pages serves from a sub-path. `scripts/resize-photos.py`
  writes `<name>-640.webp` copies and `src/components/photoWidths.ts`; thumbnails pass `sizes`
  (`<CoverArt sizes=…/>` or `responsiveProps()` from `components/responsiveImage.ts`) to get a
  srcset. `src/apps/project/media.ts` holds optional hand-written aspect ratios (`ratioOf()`).
- `LangText` marks Korean / Chinese runs with `lang` for screen readers.

## Guestbook data flow

```
apps/guestbook/index.tsx ──▶ lib/guestbook.ts ──▶ lib/supabase.ts ──▶ Supabase REST (PostgREST)
        │  isAvailable()?            listNotes() / addNote()     env + headers         public.guestbook
        └─ no ─▶ apps/guestbook/local.ts: SAMPLES + notes in localStorage (demo mode)
```

- `lib/supabase.ts`: reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (`supabaseEnv()`),
  `isConfigured()`, and `supabaseHeaders()` (`apikey`, plus `Authorization: Bearer` only for legacy
  `eyJ…` keys). Plain `fetch`, no SDK.
- `lib/guestbook.ts`: table from `VITE_GUESTBOOK_TABLE` (default `guestbook`, validated as a plain
  identifier). `listNotes()` = `GET <table>?select=id,name,message,sticker,color,created_at&hidden=eq.false&order=created_at.desc&limit=100`;
  `addNote()` = `POST <table>` with `name, message, sticker, color` and `Prefer: return=minimal`
  (visitors can't read their own hidden row back). 12s timeout; typed `GuestbookError` kinds
  (`not-configured`, `unavailable`, `network`, `invalid`, `rate-limited`, `forbidden`, `http`,
  `bad-response`). A 404 / `PGRST205` / `42P01` sets `tableMissing` for the visit, so
  `isAvailable()` turns false and the UI drops to demo mode. `STICKERS`, `NOTE_COLORS` and
  `LIMITS` mirror the SQL check constraints; change both together.
- `supabase/guestbook.sql`: columns `id, created_at, name, message, sticker, color, hidden`; RLS
  lets `anon` select `hidden = false` and insert; column grants limit inserts to the four form
  fields; a `security definer` trigger forces `hidden = true`, `created_at = now()`, trims, and
  raises `PT429` (HTTP 429) above 30 notes a minute or 300 waiting from the last day. No RPCs.
- `apps/guestbook/local.ts`: demo notes (`tinyos-guestbook-local`), the one-note-a-minute cooldown
  (`tinyos-guestbook-last-signed`), a mild profanity check, relative times. The form also has a
  honeypot field. The unsent draft survives a shell swap via `windowStash`.

## Privacy

Keep these true, and keep `PrivacyList` in `src/shell/desktop/AboutDialog.tsx` in step with them
(the OS menu's **Privacy** item and the phone's "about & privacy" link open it):

- **No tracking:** no analytics, ads or cookies. `localStorage` holds only `tinyos-settings`
  (mood, seenBoot), `tinyos-desktop-icons-v1` (icon spots) and the guestbook's two demo/cooldown keys.
- **Third parties only on a visitor's action or a visible need:** Supabase when the Guestbook opens
  or a note is sent (never when unconfigured); YouTube thumbnails (`i.ytimg.com`, no referrer) when a
  project window with videos opens, unless the video has a local `poster`, and the
  `youtube-nocookie.com` player only on play. Fonts are self-hosted. Don't add a script, font,
  image or iframe from another origin that loads on its own.
- **Photos:** `resize-photos.py` strips EXIF / XMP / IPTC losslessly in `public/`; the deploy runs
  `--strip-only dist` again so nothing slips onto the live site.
- **Keys:** only the publishable/anon key ever ships. Never the `service_role` / secret key or
  the database password (see [GUESTBOOK.md](GUESTBOOK.md#keys-whats-public-whats-secret)).

## Deploy (`.github/workflows/deploy.yml`)

Every push (any branch) and manual runs: `npm ci` → `npm run lint` (oxlint) → optional
`.env.production.local` from repo **Variables** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
(+ `VITE_GUESTBOOK_TABLE`), which override the committed `.env.production` → `npm run build`
(`tsc -b && vite build`) → `python3 scripts/resize-photos.py --strip-only dist`. Only `main`
uploads `dist` and deploys to GitHub Pages (one deploy at a time, newest waiting run wins). Pages
must be set to **Source: GitHub Actions** once.

## Dev harness and screenshots

- `npm run dev` (port 5173; `.claude/launch.json` has a `site` config for the preview pane).
- **Harness** (`src/dev/Harness.tsx`, only when `import.meta.env.DEV`): `/?app=<id>` renders one
  app alone in a desktop-sized glass frame; `&mobile=1` uses the full-viewport phone layout and
  `isMobile`; `&mood=night` (or `sunset`) sets the mood; `&params=<JSON>` passes params, e.g.
  `/?app=project&params=%7B%22projectId%22%3A%22club-robot%22%7D`.
- The full OS: `/?skipboot` (add `&gl=force` for headless WebGL).
- `node scripts/screenshot.mjs <url> <out.png> [--mobile] [--size=1440x900] [--wait=1200]
  [--settle=700] [--click=sel] [--dblclick=sel] [--press=Key] [--type=text] [--hover=sel]
  [--mouse=x,y] [--scroll[=sel]] [--reduced] [--dark] [--full]`: Playwright (devDependency)
  Chromium; prints console/page errors and exits 2 if there were any. Use `--wait=4500` for
  `/?skipboot`.
- `node scripts/make-share-images.mjs [url]`: renders `public/og.jpg` (link preview, ≤ 300 KB)
  and `public/apple-touch-icon.png` (from `favicon.svg`) with the dev server running.
- `node scripts/list-ui-text.mjs [path filter]`: lists the UI wording that lives in components,
  for a voice pass.

## Quality bar

- `npm run lint` and `npm run build` pass; no console errors.
- Clean up every listener, rAF, observer and timer on unmount.
- Animate only `transform` / `opacity` / `filter`; during drags write motion values or styles and
  commit to the store on pointerup.
- Respect `prefers-reduced-motion`; work without WebGL; keyboard and screen-reader friendly
  (menus follow the WAI-ARIA menu pattern, dialogs trap focus and return it).
- Text on `--accent` uses `--on-accent`; check 4.5:1 contrast when changing ink tokens.
