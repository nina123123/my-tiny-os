---
name: make-my-site
description: Turn the my-tiny-os template into the user's own personal website, a tiny made-up operating system named after them (like "AlexOS"). Interview them, write their design brief, restyle the template so it looks like them and not like the demo, fill in their projects, photos and links, check it on desktop and phone, and publish it to GitHub Pages. Use this whenever someone working in a my-tiny-os repo, or anyone who wants a personal website, portfolio or homepage built from this template, asks to make, set up, personalize, restyle, update or publish their site, even if they only say "help me make my website", "make it mine", "put my stuff on the site" or "帮我做网站".
---

# Make my site

This repo is a template: a personal website that looks like a tiny operating system. On a computer, visitors see a desktop with icons, windows and a dock. On a phone, they see a home screen with apps. Out of the box it belongs to a fictional demo person, **Alex Park (AlexOS)**. Your job is to turn it into **this person's** site.

The one thing that matters most: **every finished site should look and sound like its owner, not like the template.** Two people who both use this template should end up with sites a friend could tell apart at a glance: different name, colors, fonts, logo, wallpaper, wording and content. The template gives the structure; the person gives the personality. So never ship the demo palette, fonts or logo just because they're already there. Keep them only if the brief really calls for them.

Talk to the person in their language, in short friendly messages. Many of them are not programmers and some are teenagers. Don't show code unless they ask. Show screenshots instead of describing changes.

## The flow

1. **Get set up**: make sure you're in their own copy of the template.
2. **Interview**: about 10 minutes of questions, one topic at a time.
3. **Write the brief**: `docs/DESIGN.md`, then they confirm it.
4. **Make it theirs**: identity, look, wording.
5. **Fill in the content**: projects, about, links, photos.
6. **Check it**: screenshots on desktop and phone, then fix what's off.
7. **Review pass**: hunt for problems on purpose.
8. **Publish**: GitHub Pages, plus the guestbook if they want it.
9. **Hand-off**: their link and how to change things later.

Steps 2 and 3 do the most to decide whether the site feels like *them*. Don't rush them to get to code.

## 1. Get set up

Check that you're in a copy of the template: `package.json` has `"name": "my-tiny-os"` (or the name they gave it) and `src/content/profile.ts` exists.

- **Already in their repo** (they clicked "Use this template" on GitHub and opened it in Claude Code): carry on.
- **Not in a repo yet:** if `gh` is installed and logged in, offer to create their copy with `gh repo create <site-name> --template nina123123/my-tiny-os --public --clone`, then work inside it. Otherwise, tell them to open the template on GitHub, click **Use this template → Create a new repository**, and then open that new repo in Claude Code.

When working locally, run `npm install` once. You need Node 22 or newer.

## 2. Interview

Read `references/interview.md` for the question list and good follow-ups. In short, you're collecting:

- **Who they are:** name, the name for their OS, 3–5 words friends use about them, one thing they're known for (their "motif").
- **Who visits and on what:** friends from a group chat (mostly phones), admissions officers, clients…
- **The vibe:** 3 adjectives, colors they love, sites/apps/album covers whose feel they like, and what they *don't* want.
- **Content:** 3–5 projects or experiences (what they did, a number, photos), a short about-me, contact links.
- **Apps:** Projects and About are always in. Guestbook and Contact are optional.

Ask one topic per message and give 2–3 example answers so it's easy to reply. If they say "I don't know", offer three concrete options and let them pick. Accept messy answers; it's your job to tidy them.

## 3. Write the brief

Fill `references/design-template.md` into `docs/DESIGN.md`, in their words. Then propose **one clear look direction** that comes from their answers:

- a palette of 5–7 colors, including one bold accent
- a display font and a body font
- a logo idea
- a wallpaper style (`blobs`, `soft` or `flat` plus a texture)
- shape and texture: corner radii, glass or paper, shadows
- how playful it should be
- one signature detail

Give a single sentence on why it fits them. If they're unsure, offer two directions. Show the brief, get a yes, then build. The brief is what keeps later changes consistent, so update it whenever they change their mind about the look.

## 4. Make it theirs

Read `references/make-it-yours.md`. It maps every part of the brief to the file that controls it: identity in `src/content/profile.ts`, colors and moods in `src/styles/tokens.css`, fonts in `src/styles/global.css` + `package.json`, the wallpaper colors, the logo component, the boot screen, menu labels, app names and titles, and `index.html` meta tags.

Work through it in four layers:

1. identity and words
2. color and type
3. shape and texture
4. playfulness

Then check its **"different from the demo" checklist** before moving on. Changing only the name, the text and the colors is not enough: a site with new colors but the demo's rounded glass and stickers still looks like the demo.

Two helpers:

- `node scripts/list-ui-text.mjs` lists every visible line of text that lives in code, for the voice pass.
- `node scripts/make-share-images.mjs` renders the link-preview image and the home-screen icon once the look is done.

**Never rename or delete a CSS token.** Change token values, and add aliases if you want new names; `make-it-yours.md` explains why.

## 5. Fill in the content

`docs/EDITING.md` explains every content file. The main ones:

- `src/content/profile.ts`: name, OS name, tagline, intro, bio, avatar, photos
- `src/content/projects.ts`: categories and projects (story, stats, gallery, videos, links)
- `src/content/links.ts`: contact links

Rules that matter:

- **Use only what they told you.** Never invent achievements, numbers, schools or quotes. If a project needs a stat they didn't give, ask, or leave the stat out.
- **Photos:** put originals in a folder, then run `python3 scripts/resize-photos.py` (it makes WebP files and strips GPS/EXIF). Write real alt text for each one.
- **Privacy check, especially for teens:** no home address, phone number, school schedule or exact daily locations. Ask before publishing photos where friends' faces are clearly visible.
- **Remove all demo content** (Alex, example.com links, `placeholder` flags) once their real content is in. Run `bash .claude/skills/make-my-site/scripts/check-leftovers.sh` to find any left. Add `--publish` right before publishing; it also checks the link-preview addresses, which need their GitHub username.
- **Turn off apps they don't want** with `HIDDEN_APPS` in `src/os/apps.ts`. Don't delete the app's code.

## 6. Check it

Start the dev server (`npm run dev`), then take screenshots with `node scripts/screenshot.mjs`. Read the header of that file for its options; `--mobile` gives the phone layout. Capture:

- the desktop at `/?skipboot`
- the phone home screen
- each app, using the dev harness `/?app=<id>` and `/?app=<id>&mobile=1`
- the night mood once (`&mood=night`)

Look at every screenshot yourself before showing them. Fix overlaps, cut-off text, low contrast and empty spots, then show the person 2–4 of the best ones. After that, keep the loop tight: **one change at a time**, show a screenshot, ask what's next.

On Claude Code on the web, if a browser isn't available for screenshots, run `npm run build` to catch errors. Then tell the person exactly what to look at once the site is live.

## 7. Review pass

When they're mostly happy, review the whole site on purpose, the way a picky friend would. Cover:

- design consistency with the brief
- phone usability (tap targets, nothing hidden off-screen)
- accessibility (contrast, alt text, keyboard focus, reduced motion)
- bugs and console errors
- loading speed (photo sizes)
- the words themselves (typos, tone, anything still from the demo)

List what you found, fix it, re-run `npm run lint && npm run build`, and show screenshots.

## 8. Publish

Read `references/publish.md`. It covers GitHub Pages (a one-time setting, then automatic on every push to `main`), what to do when you're on a branch other than `main` (Claude Code on the web always is, so the person merges a pull request), the optional Supabase guestbook, and fixes for the common errors.

Before the first publish, run `check-leftovers.sh --publish`, fill in the link-preview addresses in `index.html`, and make sure `npm run build` passes.

## 9. Hand-off

Finish with a short message that includes:

- their live link
- how to change things later (open the repo in Claude Code and say what to change)
- where their brief lives (`docs/DESIGN.md`)

## Later changes

When they come back to change something, read `docs/DESIGN.md` first so new work matches their look. Then do the one change, check it with a screenshot, and publish.
