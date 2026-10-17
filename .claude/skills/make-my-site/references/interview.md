# Interview guide

Ask one topic per message. Keep each message short, give 2–3 example answers, and say roughly how many questions are left ("3 more and we can start building"). If an answer is thin, ask one follow-up, not five.

## 1. Who you are

- What's your name, and what should your OS be called? Default: first name + "OS" (MiaOS, LeoOS). Some people prefer a nickname or a word they love ("MangoOS", "nightowlOS").
- If you asked three friends to describe you in one word each, what would they say?
- What's one thing you're known for? This becomes the site's **motif**: a small symbol or word that shows up throughout. Examples: 🎸 always making music, 🔗 connecting people, 🌱 growing things, ⚡ fast at everything, 📷 always taking photos.

## 2. Who visits

- Who do you most want to see this? Friends and classmates, college admissions, people who might hire you, your band's fans…
- How will they open it? Mostly a link in a group chat or bio means **phones first**. A link in an application means more desktop visits.
- What should they do after visiting? Remember you, message you, come to a show, leave a note… Then ask for **the one link that makes that happen**: a streaming link, a show calendar, an email, a booking form. It becomes the main button.

## 3. The vibe

- Three adjectives for how the site should *feel* (cozy, loud, dreamy, sharp, retro, sporty, minimal, chaotic-fun…).
- Colors you love, or a thing whose colors you love: an album cover, a sneaker, a city at night, a game.
- Any websites, apps, games or Instagram pages whose look you like? Screenshots are perfect.
- What should it definitely **not** look like? This question is underrated: "not corporate", "not too pink", "not like a template".
- How do you talk? Lowercase and chill, hype with lots of emoji, short and dry, polite and polished. All the copy on the site will be written in this voice.

## 4. Content

For each of 3–5 projects or experiences:

- the name, and one sentence on what it is
- **when**: the year it started, and the year it ended if it did. The timeline and the "latest project" widget sort by it.
- what *you* did
- what came out of it, and one thing you learned or would do differently. Without this, the story just repeats the summary.
- one or two numbers (people, money raised, hours, wins, followers, views)
- 2–3 photos or screenshots, plus a link if there is one
- how they'd group them (2–4 categories, like "make / lead / play" or "code / music / sport")

Also ask for:

- **About:** a few sentences in their own words, and a photo they like of themselves (optional).
- **Currently:** 3 short "right now" lines, like "building…", "learning…", "reading…". They fill the desktop widget and the phone's "currently" card.
- **Fun facts:** 3, each as a short teaser plus the full story. They're flip cards: the teaser on the front, the story on the back.
- **Contact:** which links to show (Instagram, email, GitHub, LinkedIn, YouTube…). Remind them that anything here is public.

If they have an old site, a résumé, a LinkedIn profile or a slide deck, ask for it. It's the fastest source of material, but still confirm before using anything from it.

## 5. Apps

Projects and About are always in. Ask whether they also want:

- **Guestbook**: friends leave notes. It's free with Supabase, and works in demo mode until that's set up. Usually skip it for admissions or job sites.
- **Contact**: the "say hi" window.

Turn off what they don't want with `HIDDEN_APPS` in `src/os/apps.ts`.

Note any extra idea they mention for later. Don't build it during the first pass.

## Turning answers into a look direction

Translate the person's answers into concrete choices, and explain each choice in one sentence.

| They said | Becomes |
| --- | --- |
| 3 adjectives + colors they love | a palette of 5–7 hex colors, with one bold accent used sparingly |
| how they talk | the display font, the body font, and the wording of every label |
| their motif | the logo shape, plus the small symbol used on the welcome card and in empty states |
| the "not this" answer | things to avoid, written into the brief |
| phones first? | layout priorities, and which screenshots to show first |

Also decide two things the table can't answer on its own:

- **shape and texture** (round frosted glass, flat paper, hard print edges, pixel)
- **how playful**: keep the demo's stickers and doodles, tone them down, or replace them with one signature of their own

A calm or serious brief nearly always means less glass and less sticker.

Some ideas to pull from (mix them, don't copy them):

- **sporty and loud:** high-contrast court colors, a condensed bold display font, a scoreboard-style boot screen
- **cozy and bookish:** paper-warm neutrals, a serif display, a rounded sans, a little ink-stamp logo
- **night-owl coder:** deep navy and electric lime, a mono font for labels, a moon logo, night mood as the default
- **dreamy and soft:** pastel gradients, a soft serif, a glowing accent
- **retro game:** a pixel display font for titles only, a saturated palette, a pixel-heart logo
