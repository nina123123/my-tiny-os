# ✏️ Editing your tiny OS

👋 This guide shows how to change anything on the site: your name, words, projects, photos,
links and colors. Almost everything lives in **`src/content/`**, so you never need to touch
the app code. Edit a file, save it, and the site updates. The template ships with a made-up
person, **Alex Park** (whose OS is called **AlexOS**): replace Alex's things with yours.

**Contents:** [1. Editing loop](#1-the-editing-loop) ·
[2. TypeScript survival kit](#2-a-tiny-typescript-survival-kit) ·
[3. Which file controls what](#3-which-file-controls-what) · [4. `profile.ts`](#4--profilets-you) ·
[5. `projects.ts`](#5--projectsts-folders-and-projects) · [6. `links.ts`](#6--linksts-contact-cards) ·
[7. Photos](#7--photos-in-publicmedia) · [8. Colors, moods, fonts](#8--colors-moods-and-fonts) ·
[9. Publishing](#9--publishing-your-changes) · [10. When something breaks](#10--when-something-breaks)

## 1. The editing loop

**One time:** install [Node.js](https://nodejs.org/) (version 22 or newer), open a terminal in
the project folder and run `npm install`.

**Every time you edit:**

1. Start the dev server: `npm run dev`
2. Open **http://localhost:5173/?skipboot** (`?skipboot` skips the boot animation).
3. Edit a file in `src/content/` and save. The page updates by itself in a second.
4. When you're happy, run `npm run lint` and `npm run build`. If both finish without errors,
   GitHub will build it fine too. Then [publish](#9--publishing-your-changes).

**Looking at one app on its own** (only while `npm run dev` runs, never on the live site):

| URL (after `http://localhost:5173`) | Shows |
| --- | --- |
| `/?app=projects` | the Projects app in a desktop-sized window |
| `/?app=projects&mobile=1` | the same app in the phone layout |
| `/?app=about&mood=night` | About Me in the night mood (`sunrise`, `sunset` or `night`) |
| `/?app=project&params=%7B%22projectId%22%3A%22club-robot%22%7D` | one project (swap `club-robot` for any project id) |

The app ids are `welcome` (the Hello card), `projects`, `project`, `about`, `guestbook` and
`contact`. Most visitors arrive on their phones, so check with `&mobile=1` too, or use your
browser's device toolbar (F12 → the phone icon).

## 2. A tiny TypeScript survival kit

The content files are TypeScript, but you only need a few rules:

- **Text goes inside quotes:** `'like this'`.
- **Apostrophes inside text need a backslash:** `'I\'m building a robot'` (without it, the `'`
  in `I'm` ends the text early). Or use double quotes: `"I'm building a robot"`.
- **Every item in a list ends with a comma,** including the last one.
- **`[ ]` is a list** and **`{ }` is one thing with named fields** (`title: 'Sprocket'`).
- **Numbers have no quotes:** `value: 4`, not `value: '4'`.
- **A `?` in `types.ts` means the field is optional.** Leave it out if you don't need it.
- **Emoji work everywhere.** 🔧
- Lines starting with `//`, or wrapped in `/* … */`, are comments. The site ignores them.

Your editor underlines mistakes in red; hover over the red line to see what's wrong. Every
field is described in **`src/content/types.ts`**.

## 3. Which file controls what

| File | What's in it | Where it shows up |
| --- | --- | --- |
| `src/content/profile.ts` | your name, the OS's name, greeting, bio, photos, fun facts | everywhere the site names you; Hello card, About Me, Contact, widgets |
| `src/content/projects.ts` | the project folders (categories) and all the projects | Projects, project windows, desktop photo stack, phone "latest project" widget |
| `src/content/links.ts` | the contact cards | Contact |
| `src/content/moods.ts` | what the three moods are called, their emoji, the mood menu's name | menu bar, right-click menu, phone status bar |
| `src/content/look.ts` | the wallpaper style: `'blobs'`, `'soft'` or `'flat'` | behind everything |
| `src/os/apps.ts` | app names and window titles; `HIDDEN_APPS` switches apps off, e.g. `['guestbook']` | icons, menus, buttons |
| `public/media/` | your photos | everywhere |
| `index.html` | the browser tab title, the description and the link-preview text | browser tabs, search results, shared links |
| `public/og.jpg` | the link-preview picture | when someone shares your link |
| `public/favicon.svg`, `public/apple-touch-icon.png` | the tab icon and the phone home-screen icon | browser tabs, phones |
| `src/styles/tokens.css` | colors, moods, fonts, sizes | everywhere |
| `.env.production` | the guestbook's connection (see [GUESTBOOK.md](GUESTBOOK.md)) | Guestbook |

⚠️ `index.html` can't read `profile.ts`, so change its `<title>`, `description` and the
`og:` / `twitter:` lines by hand. `og:url`, `og:image` and `twitter:image` must be your site's
full address (see [Publishing](#9--publishing-your-changes)).

## 4. 👋 `profile.ts`: you

This file holds one `profile` object. Here is every field:

| Field | What it is | Example (Alex) |
| --- | --- | --- |
| `firstName` | your first name, used in greetings and everywhere the site names you ("hi, i'm alex", "about alex", "Say hi to Alex") | `'Alex'` |
| `fullName` | the full name, shown on About Me and Contact. A nickname in brackets is set in italics | `'Alex Park'` or `'Alex (Al) Park'` |
| `osName` | the OS's name in the menu bar, boot screen and phone status bar (optional: leave it out and it's `firstName` + `OS`) | `'AlexOS'` |
| `tagline` | the one-liner under the greeting | `'maker · tinkerer · zine person 🔧'` |
| `motif` | your signature word and emoji (optional). Wherever `🔧 build` appears in `intro` or `superpower` it gets a highlighter mark, and the emoji becomes a sticker | `{ emoji: '🔧', word: 'build' }` |
| `origin` | where you're from (optional) | `'a small town by the sea 🌊'` |
| `location` | where you are now (optional) | `'Seattle'` |
| `superpower` | your signature line, shown big on the Hello card and About Me (optional) | `'to 🔧 build things that are a little bit useful…'` |
| `intro` | short first-person lines for About Me, one string per bubble (optional) | `['Hi! I\'m Alex 👋', …]` |
| `describedAs` | words people use to describe you (they flip by on the greeting) | `['curious', 'patient', 'funny']` |
| `bio` | the About Me paragraphs, **one string per paragraph** | `['I\'m a high-school student who…', …]` |
| `currently` | little "currently" facts, each `{ label, value }`: the desktop "now" card (wide screens) and the phone's "currently" widget (first 3) | `{ label: 'building', value: 'a line-following robot' }` |
| `funFacts` | flip cards: `{ front, back }`, a short teaser and the whole fact (a plain string works but shows the same text on both sides) | `{ front: 'I fix the school printer 🖨️', back: 'At some point…' }` |
| `avatar` / `avatarAlt` | your round photo and its description (optional: without it, a drawn avatar shows your initial) | `'media/about/avatar.webp'` |
| `photos` | polaroids for About Me, each `{ src, alt, caption?, focus? }` (optional) | see below |
| `languages` | languages you speak (optional) | `['English', 'a little Spanish']` |
| `placeholder` | `true` while it's still draft copy; `currently` values like `'add something here'` then show as "coming soon" (optional) | `true` |

**Adding an About Me photo:** put the file in `public/media/about/`, then add one item to
`photos` (`focus` is optional and moves the square crop: across, then down):

```ts
  photos: [
    { src: 'media/about/workbench.webp', alt: 'Alex at a workbench, soldering a circuit board', caption: 'my happy place 🔧', focus: '50% 20%' },
  ],
```

🔒 Keep it about you and your work. Ages, school grades, health and family details don't
belong here, and neither does anyone else's name.

## 5. 📁 `projects.ts`: folders and projects

This file has two lists: `categories` (the folders in the Projects sidebar) and `projects`.

### 5.1 Categories

```ts
  {
    id: 'builds',                 // projects point at this with categoryId
    label: 'Builds',              // the name people see
    emoji: '🛠️',
    color: 'var(--coral-400)',    // tint for chips and folders
    blurb: 'Things with wires, motors and a lot of trial and error.', // optional, your words
  },
```

Alex's ids are **`builds`**, **`web`** and **`print`**. Make as many as you like.

- To **rename** a category, change its `label` but keep its `id` (every project points at the `id`).
- To **add** one, add another `{ … }` with a new `id`. For `color`, use a palette color from
  `src/styles/tokens.css`: `var(--coral-400)`, `var(--lavender-500)`, `var(--mint-400)`,
  `var(--butter-400)`, `var(--peach-400)`, `var(--sky-300)` or `var(--pink-300)`.
- To **remove** one, first move its projects to another `categoryId`.

### 5.2 Anatomy of a project

A complete project with every field. Copy it as a starting point; delete the `//` notes and
the fields you don't need.

```ts
  {
    id: 'my-new-project',          // lowercase-with-dashes, unique. Also the photo folder name.
    title: 'My New Project',
    subtitle: 'what it is · my role', // optional small line under the title
    year: '2026',                  // what people see: '2026', '2025 – 2026', '2024 – now', or ''
    sortDate: 202603,              // YYYYMM as a number, only used for ordering. 0 = undated.
    categoryId: 'builds',          // must match a category id
    emoji: '🌱',
    colors: ['#FFD9C7', '#D6C8FF'], // two colors for the dreamy cover drawn when there's no photo
    cover: 'media/my-new-project/cover.webp', // optional
    coverAlt: 'Describe the cover photo for someone who cannot see it',
    coverFocus: '50% 0%',          // optional: which part of the cover stays when it's cropped
    summary: 'One sentence that makes people want to click.',
    role: 'Lead builder',          // optional
    stats: [                       // optional: big numbers that count up
      { label: 'people at the first workshop', value: 40 },
    ],
    story: [                       // the sections of the story, top to bottom
      {
        heading: 'How it started',
        body: 'First paragraph.\n\nSecond paragraph.',
        image: 'media/my-new-project/g1.webp', // optional
        imageAlt: 'What the photo shows',
      },
    ],
    gallery: [                     // optional: photos that open in a lightbox
      { src: 'media/my-new-project/g2.webp', alt: 'What the photo shows', caption: 'optional caption' },
    ],
    videos: [                      // optional: YouTube only
      { youtubeId: 'abcDEF12345', title: 'Recap video' },
    ],
    links: [                       // optional: buttons to anything else
      { label: 'Read the write-up', href: 'https://example.com/write-up' },
    ],
    tags: ['workshop', 'community'], // used by search
    featured: true,                // optional: big tile, shown first
    placeholder: true,             // optional: marks it as a draft. Delete when it's real.
  },
```

**Required fields:** `id`, `title`, `year`, `sortDate`, `categoryId`, `emoji`, `colors`,
`summary`, `story` (it can be `[]`) and `tags` (also allowed to be `[]`). Everything else is optional.

### 5.3 Adding a project, step by step

1. **Pick an id:** lowercase words joined by dashes, like `science-fair-2026`, different from
   every other project id.
2. **Add photos** (optional): make a folder `public/media/<your-id>/` with, say, `cover.webp`,
   `g1.webp`, `g2.webp`. See [Photos](#7--photos-in-publicmedia). No photos? The site draws a
   cover from `emoji` and `colors`.
3. **Copy the template** above into the `projects` list, after one project's closing `},`.
4. **Fill it in**, then delete the fields you don't need.
5. **Check it:** open `/?skipboot`, find it in Projects and open it, or go straight to
   `/?app=project&params=%7B%22projectId%22%3A%22<your-id>%22%7D`. Check `&mobile=1` too.

### 5.4 Dates: `year` vs `sortDate`

- **`year`** is the text people see. Leave it `''` if you'd rather not show a date.
- **`sortDate`** is a number like `202409` (September 2024). It only puts projects in order
  (bigger = more recent): the Timeline view, and the phone's "latest project" widget. Use `0`
  for "undated": those land in an **"along the way"** group instead of getting a fake date.

You can keep a rough `sortDate` for ordering while `year` stays empty.

### 5.5 Featured, order, removing

- `featured: true` puts a project in the **Featured** folder and gives it a big tile at the
  front of the grid. Each featured project is followed by two regular ones (it only gets the big
  tile when two follow it), so 2–4 featured projects look best.
- After the featured ones, the grid follows **the order in the file**. "next project →" at the
  bottom of each project walks the same order, and so does the photo stack on wide desktops.
- **Reorder:** cut a whole project, from its `{` to its `},`, and paste it elsewhere in the list.
- **Remove:** delete the whole block. **Hide for now:** wrap it in a comment (`/* … */`).

### 5.6 Stats (the numbers that count up)

```ts
    stats: [
      { label: 'seats reserved through it', value: 140 },
      { label: 'raised for the club', value: 1200, prefix: '$' },
      { label: 'lines of code', value: 1200, suffix: '+' },
    ],
```

`value` is a plain number (no commas or quotes): `1200` shows up as **1,200**. `prefix` goes
before it (`'$'`, `'#'`), `suffix` after it (`'+'`, `'%'`, `' days'` with its space). The `label`
is read right after the number ("140 seats reserved through it"). Two to four stats look best.

### 5.7 Story sections

Each section is `{ heading, body, image?, imageAlt? }`, shown top to bottom.

- Separate paragraphs inside `body` with **`\n\n`**: `body: 'How it started.\n\nWhat happened next…'`
- A paragraph that **starts with a quotation** becomes a big pull quote, and a short tail right
  after the closing quote becomes its credit: `'“Always bring a spare wheel.” – our club advisor'`.
  A paragraph starting with an em dash (`— `) is styled as a citation.
- A section's `image` is optional. When you add one, always add `imageAlt` too.

### 5.8 Gallery

A list of `{ src, alt, caption? }` that opens in a lightbox. Up to about 8 per project keeps
things fast. A photo that's already a story `image` isn't shown twice: list it in `gallery`
too if you want it to have a caption in the lightbox.

### 5.9 Videos (YouTube)

The `youtubeId` is the 11-character code in the video link:

| Link | id |
| --- | --- |
| `https://www.youtube.com/watch?v=abcDEF12345` | `abcDEF12345` |
| `https://youtu.be/abcDEF12345?si=xyz` | `abcDEF12345` (stop before the `?`) |
| `https://www.youtube.com/shorts/abcDEF12345` | `abcDEF12345` |

YouTube's player only loads when someone presses play, but the thumbnail comes from YouTube. To
show your own photo instead (then nothing is fetched from YouTube until play), add `poster`, and
`posterFocus` to pick the part of the photo shown in the 16:9 card:

```ts
      { youtubeId: 'abcDEF12345', title: 'Recap video', poster: 'media/my-new-project/g1.webp', posterFocus: '50% 20%' },
```

🔒 **Only add videos that are yours to share.** If other people are recognisable (especially
children), ask them (or their parents) first, or leave it out. Videos on Google Drive aren't
YouTube: put them in `links`, shared as **"Anyone with the link → Viewer"**.

### 5.10 Links

`links: [{ label: 'Visit the site', href: 'https://example.com/' }],` Always use the full
address, starting with `https://`. 🔒 A link makes a file public for anyone who finds it: link
only finished work that's meant to be seen.

### 5.11 The `placeholder` flag

`placeholder: true` means "draft, not the real thing yet". The project gets a small **draft**
label in the grid and timeline and a "still a draft" banner in its window, and it's left out of
the desktop photo stack and the phone's "latest project" widget. Delete the line when the real
words and photos are in. Contact links have the same flag.

## 6. 📬 `links.ts`: contact cards

One card per link in the Contact app:

```ts
  {
    id: 'email',                       // unique
    label: 'Email',
    handle: 'hello@example.com',       // shown under the label
    href: 'mailto:hello@example.com',  // a mailto: link also gets a copy button
    emoji: '✉️',
  },
```

- **Add a link:** copy one block and change it, e.g. `href: 'https://instagram.com/alex.example'`
  with `handle: '@alex.example'`. **Remove one:** delete its block.
- **Not ready yet?** `placeholder: true` (or an empty `href`) shows a soft "coming soon" card.
  While there's no real link at all, the privacy note in About says "Contact details are coming soon."
- 🔒 **Use details meant for the public**: a dedicated email address, not your private one, and
  no phone number or home address. Anything on the site is public, and bots collect email addresses.

## 7. 📸 Photos in `public/media/`

### Where they go (create `public/media/` if it isn't there yet)

```
public/media/
  about/                  ← About Me photos + avatar
  club-robot/             ← one folder per project, named exactly like the project id
    cover.webp
    g1.webp
```

### How to point at them

Write the path **starting at `media/`**: no `public/` and **no slash at the start**.

```ts
cover: 'media/club-robot/cover.webp',         // ✅
cover: '/media/club-robot/cover.webp',        // ❌ the leading slash breaks on GitHub Pages
cover: 'public/media/club-robot/cover.webp',  // ❌
```

Why: the live site lives in a sub-folder (`https://<you>.github.io/<repo-name>/`), so paths are
relative to that. A leading `/` would look at `https://<you>.github.io/media/…`, which doesn't exist.

### File names, size and format

- **lowercase, no spaces**: `cover.webp`, `g1.webp`, `team-photo.webp`. ⚠️ Capitals count
  online: `Cover.WEBP` and `cover.webp` are the same file on your laptop but *different* files
  on GitHub Pages. If a photo works locally but is missing live, check the capitals first.
- **WebP** is best (small and sharp); JPG and PNG work too. Long side about **1600px** for
  covers, **1200–1400px** for gallery photos, under **~250 KB** each.
- Easiest converter: **[squoosh.app](https://squoosh.app)** (free, in your browser): pick
  **WebP**, quality about **75–80**, resize to 1600px, download.

### Before you commit: the photo script

After adding or replacing photos, run **`python3 scripts/resize-photos.py`** (it needs Pillow:
`pip install pillow`) and commit what it changes. It does two things:

1. 🔒 **Removes hidden metadata** from every image in `public/`. Phone photos carry the GPS spot
   where they were taken, the date and the phone model. The script takes all of that out without
   touching the picture (colors and rotation stay). `python3 scripts/resize-photos.py --check`
   only lists photos that still carry metadata.
2. **Makes small copies for thumbnails:** a 640px copy next to each WebP photo
   (`cover.webp` → `cover-640.webp`) and an updated `src/components/photoWidths.ts`, so tiles and
   thumbnails load the small copy. Don't edit or rename the `-640` files yourself.

Skipped it? Nothing breaks: new photos load at full size, and the deploy strips metadata from the
live site anyway. But the repo's copy keeps it (and the repo may be public), so run it before you
commit. Optional polish: a photo's size in `src/apps/project/media.ts`
(`'club-robot/g1.webp': [1600, 1067]`) lets story and gallery photos reserve their space.

### Alt text (always!)

Every photo needs an `alt` (or `coverAlt` / `imageAlt` / `avatarAlt`) that describes what's in it
for people using screen readers, e.g. *"Alex holding a small robot over a competition field"*.
Say what's in the picture; don't start with "image of". Describe other people by role ("a
teammate"), not by name.

### Privacy check before you upload

Look for phone numbers, emails, addresses, licence plates, name badges, and screens or slides
with personal details. Pick photos where you're the one who's recognisable: other people's faces
(children's above all) need their OK, or a crowd shot where nobody stands out. When in doubt,
leave it out. 💛

### The link preview image

When someone shares your link, the preview picture is **`public/og.jpg`** (set by `og:image` and
`twitter:image` in `index.html`). Make it **1200 × 630 px**, a JPEG at quality 80–85, **under
~150 KB** (never over 300 KB: some chat apps drop big previews), and keep the name `og.jpg`. A
screenshot of your OS works well; leave other people out of it. Chat apps cache previews, so a new
one can take a day to show up.

## 8. 🎨 Colors, moods and fonts

Everything visual lives in **`src/styles/tokens.css`**. **Only change values; never rename the
`--names`**, because the app code uses them.

- **The raw palette** (top of the file: `--lavender-200`, `--peach-200`, `--coral-500`,
  `--plum-800` …) are your crayons. Change one and everything using it updates.
- **The moods:** `:root { … }` is ☀️ **sunrise** (the default, every token defined),
  `:root[data-mood='sunset']` is 🌇 **sunset** and `:root[data-mood='night']` is 🌙 **night**
  (dark mode). The other two only override some tokens.
- **The semantic tokens** inside each mood decide what a color is *for*: `--ink` / `--ink-2` /
  `--ink-3` (text), `--accent` (the coral pop on buttons), `--accent-ink` (coral *text*),
  `--on-accent` (text on accent buttons), `--surface` / `--surface-strong` (window glass and
  cards), `--bg` / `--bg-grad` (page background), `--wp-a` … `--wp-e` (the wallpaper's blob
  colors, **hex only** like `#ffd9c7`), `--logo-1` … `--logo-3` (the logo's sun).
- **Fonts:** `--font-display`, `--font-body`, `--font-hand` and `--font-mono`; the font files
  themselves are imported at the top of `src/styles/global.css`.

✅ Whenever you change `--ink`, `--accent-ink` or `--on-accent`, check contrast (at least
**4.5 : 1**) with [WebAIM's contrast checker](https://webaim.org/resources/contrastchecker/).
New visitors start in `sunrise` (set in `src/os/settings.ts`); after that each visitor's choice
is remembered on their device. For a bigger restyle (a new palette, other fonts, a new logo), see
the make-my-site skill's guide, `.claude/skills/make-my-site/references/make-it-yours.md`.

## 9. 🌍 Publishing your changes

The site builds and goes live by itself whenever **`main`** changes on GitHub
(`.github/workflows/deploy.yml`).

**One-time setup:** on GitHub, **Settings → Pages → Build and deployment → Source: GitHub
Actions**. Your site will live at **`https://<your-username>.github.io/<repo-name>/`**; put that
address in `index.html`'s `og:url`, `og:image` and `twitter:image`.

**From your computer:** `git add -A`, then `git commit -m "add my new project"`, then `git push`.
Or with **GitHub Desktop**: write a summary, **Commit**, then **Push origin**.

**From a phone or any browser:** on github.com open the file (e.g. `src/content/profile.ts`) →
✏️ pencil → change it → **Commit changes…** → commit to `main`. Photos: open the folder → **Add
file → Upload files**. (No ✏️ on a phone? Switch the browser to **Desktop site**.) Photos uploaded
this way skip the photo script; run it from a computer later.

**Then:** open the **Actions** tab. Your push shows up as a run of **Deploy my-tiny-os**. A green ✓
after a minute or two means it's live. A yellow ⚠ lists photos that still carry hidden metadata in
the repo. Still seeing the old version? Hard-refresh (Ctrl/Cmd + Shift + R).

🌿 **Branches:** a push to any other branch only runs the checks (lint + build) and is **not**
published. Merge it into `main` to go live. If a build fails, nothing breaks: the live site keeps
the last version that worked.

## 10. 🩹 When something breaks

| What you see | What's probably wrong | Fix |
| --- | --- | --- |
| Red error screen or a blank page in `npm run dev` | a missing comma, quote or bracket | The error names the file and line. Look just *before* that spot, too. |
| `Unterminated string literal` | an apostrophe inside `'…'` | Write `\'` (`'I\'m'`), or use double quotes. |
| `Property 'summary' is missing` | a required field was deleted | Add it back (see [required fields](#52-anatomy-of-a-project)). |
| A photo doesn't show | wrong path, a leading `/`, `public/` in the path, or capital letters | Path should be `media/<folder>/<file>.webp`, all lowercase. |
| A project is missing from its folder | `categoryId` typo | It must exactly match a category `id`. |
| "hmm, this project floated away" | the `projectId` in the URL doesn't match any project `id` | Ids are case-sensitive; check `projects.ts`. |
| Actions run failed at **Lint** or **Build** | same as the above, caught by GitHub | Run `npm run lint` and `npm run build` locally, fix, push again. |
| A YouTube video says "unavailable" | the video is private, or embedding is off | On YouTube, make it Public or Unlisted and allow embedding. |
| A Drive link asks for access | the file isn't shared publicly | Drive: **Share → General access → Anyone with the link**. |
| The guestbook says "opens soon" | it isn't connected yet | See [GUESTBOOK.md](GUESTBOOK.md). |

Stuck? The words in every red error are search-friendly: copy them into a search engine. You've got this. 🔧
