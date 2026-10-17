# 💌 The guestbook

Visitors can leave you a note: a name or nickname, a message (up to 280 characters), a
sticker and a pastel paper color. The guestbook is **moderated**: every new note is saved
hidden and only goes up on the wall after you approve it. Under the form, visitors read:

> Notes are public and appear after approval. Please don’t include personal info.

After sending, they see *"thank you! 💌 your note will appear on the wall once it’s
approved."* A sent note is never shown as if it were already live.

The notes live in a free **[Supabase](https://supabase.com)** database (hosted Postgres with
a friendly dashboard), in one table: **`public.guestbook`**.

> **Out of the box the guestbook isn't connected.** `.env.production` has no project URL or
> key yet, so the site runs the guestbook in [demo mode](#demo-mode-before-its-connected).
> Steps 1 and 2 below switch it on. It takes about ten minutes.

```
 visitor ──▶ the site (static, GitHub Pages)
               │  reads APPROVED notes · sends new notes (they arrive hidden)
               ▼
            Supabase ── table public.guestbook
                         🔒 Row Level Security decides what visitors may do
               ▲
 you ──────────┘  Table Editor: approve a note by setting hidden = false
```

**Contents:** [1. Create the project and table](#1-create-the-project-and-the-table-once) ·
[2. Connect the site](#2-connect-the-site) · [3. Approve notes](#3-approve-notes) ·
[4. Test it](#4-test-it) · [Demo mode](#demo-mode-before-its-connected) ·
[Settings](#settings-reference) · [Keys: what's public, what's secret](#keys-whats-public-whats-secret) ·
[Privacy](#privacy) · [Troubleshooting](#troubleshooting)

---

## 1. Create the project and the table (once)

1. In the **[Supabase dashboard](https://supabase.com/dashboard)**, click **New project** and
   make a fresh one for this site. Use a project that belongs to this site alone, not one
   another website already uses: the site's publishable key is public, and it works for
   every table in its project that lets visitors in.
2. Write down the **database password** Supabase asks you to choose somewhere safe (a
   password manager). The site never needs it. Don't put it in any file in this repo.
3. In the new project: **SQL Editor** (left sidebar) → **New query**.
4. In this repo, open **[`supabase/guestbook.sql`](../supabase/guestbook.sql)**, copy
   **everything** and paste it into the editor.
5. Click **Run**. You should see *"Success. No rows returned"*. 🎉

The script is safe to run again, and it doesn't touch any other table in the project.

Two good habits while you're in the dashboard: **Authentication → Sign In / Providers →
turn off "Allow new users to sign up"** (this site never signs anyone in), and turn on
**two-factor authentication** for your Supabase account.

**What it creates:** the table **`public.guestbook`**:

| Column | What it holds |
| --- | --- |
| `id` | a unique id, filled in automatically |
| `created_at` | when the note was sent, set by the database |
| `name` | the visitor's name or nickname, 1–40 characters |
| `message` | the note, 1–280 characters |
| `sticker` | one of the 8 stickers the form offers (🌷 ✨ 🍓 🦋 🌈 🍑 💌 🧸), or none |
| `color` | one of `lavender`, `peach`, `butter`, `mint`, `sky`, `pink` |
| `hidden` | **`true` = waiting for approval** (or taken down). Set it to `false` to approve. |

…plus the rules that keep it safe:

- **Row Level Security (RLS) is on.** Visitors can **read approved notes** (`hidden = false`)
  and **send new notes**. That's all. A new note is always saved with `hidden = true`,
  whatever the visitor sends, so nobody can skip the approval. Visitors can't edit, approve,
  hide or delete anything, and they can't fake a date.
- **A flood guard** (a database trigger) pauses new notes for a minute if 30 arrive within a
  minute, and stops taking new ones while 300 or more from the last day are waiting for
  approval (a spam run you haven't looked at yet). The site also asks each visitor to wait a
  minute between notes.
- Stickers, paper colors and lengths are limited to exactly what the site offers. The same
  lists live in `src/lib/guestbook.ts` (`STICKERS`, `NOTE_COLORS`, `LIMITS`): if you ever
  change one there, change the matching check in `supabase/guestbook.sql` and run it again.

## 2. Connect the site

Copy two values from the new project:

- the **Project URL**: Project Settings → **Data API** → Project URL
  (`https://<something>.supabase.co`);
- the **publishable key**: Project Settings → **API Keys** → `sb_publishable_…` (older
  projects: the legacy `anon` `public` key, which starts with `eyJ…`).

Then put them in **one** of these places:

- **Option A, `.env.production`** (committed, simplest): fill in the two empty lines and push.

  ```bash
  VITE_SUPABASE_URL=https://<your-project>.supabase.co
  VITE_SUPABASE_ANON_KEY=sb_publishable_…
  VITE_GUESTBOOK_TABLE=guestbook
  ```

- **Option B, repo Variables:** on GitHub, **Settings → Secrets and variables → Actions →
  Variables** → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Variables, not
  Secrets). When both are set, the deploy workflow (`.github/workflows/deploy.yml`) uses them
  instead of `.env.production`. Then push any change, or start a fresh deploy by hand:
  **Actions → Deploy my-tiny-os → Run workflow** (branch `main`).

The next deploy connects the guestbook.

**For local dev** (`npm run dev`): `cp .env.example .env.local`, fill in the same two values
and restart `npm run dev` (Vite only reads env files when it starts). `.env.local` is
git-ignored, so it never gets committed.

## 3. Approve notes

New notes wait in the table, hidden. Supabase doesn't notify you, so check in now and then
(the dashboard works in a phone browser too).

1. Supabase → **Table Editor** → **guestbook**.
2. To see only the waiting notes: **Filter** → `hidden` · `equals` · `true`.
3. Read the note. To approve it, double-click its **`hidden`** cell, set it to **`false`** and
   save. It appears on the wall the next time someone opens the guestbook.

Other things you can do:

- **Take a note down again:** set `hidden` back to `true`. Nothing is deleted.
- **Delete a note for good** (spam, or someone asks you to remove theirs): tick the row's
  checkbox → **Delete**. As the project owner you can do this in the dashboard; visitors never
  can.
- **Notes you add yourself** in the Table Editor also start hidden. Approve them the same way.

**From the SQL Editor** (handy for a batch):

```sql
-- what's waiting?
select id, created_at, name, message from public.guestbook where hidden order by created_at;

-- approve one (copy its id from the query above)
update public.guestbook set hidden = false where id = '<the id>';

-- take one down again
update public.guestbook set hidden = true where id = '<the id>';

-- clear out spam you never approved
delete from public.guestbook where hidden and message ilike '%spammy word%';

-- housekeeping: unapproved notes older than 30 days
delete from public.guestbook where hidden and created_at < now() - interval '30 days';

-- keep the wall to the last 12 months
delete from public.guestbook where created_at < now() - interval '12 months';
```

## 4. Test it

1. Open the live site → **Guestbook** → write a test note → **send my note**. You should see
   *"…your note will appear on the wall once it’s approved."*, and the note is *not* on the
   wall yet.
2. Supabase → **Table Editor** → **guestbook**: there's your note, with `hidden` = `true`.
3. Set `hidden` to `false` and reopen the guestbook: the note is on the wall. 🎉
4. Delete the test note when you're done.

---

## Demo mode (before it's connected)

The guestbook never breaks. When the URL or key is missing (the template as it ships, or
local dev without `.env.local`), or the table doesn't exist yet in that project (Supabase
answers 404), it switches to an **on-device** demo mode:

- the header says *opening soon*, and a small banner says *"the guestbook opens soon ✨ for
  now, notes you write here stay on your device 💌"*;
- the wall shows three sample hellos from you (your `firstName` from
  `src/content/profile.ts`), each with a *sample* chip;
- notes a visitor writes are kept in **their own browser only** (`localStorage`, key
  `tinyos-guestbook-local`). Nothing is sent anywhere and nobody else sees them.

Without a URL and key, no request is ever made. After one 404 the site stops asking Supabase
for the rest of that visit, so there's no stream of errors. As soon as the table exists, the
next visit connects for real.

The sample hellos are in `src/apps/guestbook/local.ts` (`SAMPLES`) if you want to reword them.

---

## Settings reference

| Variable | What it is | Default |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | the project's URL | empty → demo mode |
| `VITE_SUPABASE_ANON_KEY` | the publishable (or legacy anon) key | empty → demo mode |
| `VITE_GUESTBOOK_TABLE` | the table name | `guestbook` |

- They are read in `src/lib/supabase.ts` and `src/lib/guestbook.ts`, and described in
  `.env.example`.
- `VITE_GUESTBOOK_TABLE` is optional. It only matters if you renamed the table in the SQL; it
  must be a plain lowercase name (letters, digits, `_`), otherwise the site falls back to
  `guestbook`.
- **Moving to another Supabase project** later: create the project, run
  `supabase/guestbook.sql` there, swap in its URL and key, and push. Old notes stay in the old
  project (copy them over in the Table Editor if you want them).

---

## Keys: what's public, what's secret

| Thing | Public? | Where it may go |
| --- | --- | --- |
| Project URL | ✅ public | `.env.production`, repo Variables, `.env.local` |
| Publishable key `sb_publishable_…` (or legacy `anon` key) | ✅ public **by design** | same as above |
| `service_role` key / secret key `sb_secret_…` | ⛔ **secret** | nowhere in this repo, the website or GitHub |
| Database password | ⛔ **secret** | your password manager only |

**Why it's fine that the publishable key is public:** it ends up inside the website's code,
where anyone can read it, and that's how Supabase means it to be used. It's like the front
door of a shop: anyone can walk in, but every shelf is locked except the ones you chose to
open. What it may do is decided entirely by the **Row Level Security policies** from step 1:
read approved notes, and send new ones that wait for approval. Nothing else.

**Never share the `service_role` / secret key or the database password.** They skip every
safety rule. This site never needs them. If one ever leaks (pasted into a file, a chat or a
screenshot), rotate it in the Supabase dashboard right away.

---

## Privacy

- Notes are public once approved, and the form says so. Approve only notes without personal
  details (full names, phone numbers, addresses, school names…); when in doubt, delete.
- If someone asks for their note to be removed, delete the row.
- Supabase receives each visitor's IP address and browser info in its API logs when the
  guestbook opens or a note is sent.
- The privacy note in **About {your OS name} → privacy**
  (`src/shell/desktop/AboutDialog.tsx`) already says notes are stored with Supabase and appear
  only after approval. Keep it true if you change how the guestbook works.

---

## Troubleshooting

| What you see | Likely cause | Fix |
| --- | --- | --- |
| "the guestbook opens soon" on the live site | no URL/key in the build yet, or the table doesn't exist in that project | Do [steps 1–2](#1-create-the-project-and-the-table-once): run `supabase/guestbook.sql` in the same project as `VITE_SUPABASE_URL`. |
| A note was sent but isn't on the wall | that's moderation: it's waiting for you | Approve it ([step 3](#3-approve-notes)). |
| "the guestbook said no. its keys might be misconfigured." | wrong key (a typo, a cut-off paste, or a key from a different project), or the policies weren't created | Copy the publishable key again from the same project as the URL; run the SQL again. |
| "couldn't reach the guestbook. check your connection?" | offline, or the free project was **paused** (Supabase pauses free projects after about a week without activity) | Open the Supabase dashboard and click **Restore project**. |
| "the guestbook is extra busy right now. try again in a minute?" | the flood guard, or 300+ notes waiting for approval | Wait a minute; if spam is piling up, delete it ([step 3](#3-approve-notes)). |
| "you just signed! give it …s before the next note ⏳" | the one-note-a-minute limit on that device | Wait the seconds it says. |
| Works online, "opens soon" locally | no `.env.local`, or the dev server wasn't restarted | See [step 2](#2-connect-the-site) → local dev. |
| Repo Variables set, but still "opens soon" | only one of the two Variables is set, they were added as *Secrets*, or no deploy has run since | Add **both** as **Variables**, then run the deploy again (Actions → Deploy my-tiny-os → Run workflow). |
