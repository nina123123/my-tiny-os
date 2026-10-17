-- ─────────────────────────────────────────────────────────────────────────────
-- my-tiny-os guestbook: a MODERATED guestbook table
--
-- This site has a table of its own, public.guestbook. Run it in a
-- Supabase project that belongs to this site alone: the site's publishable key
-- is public, and it works for every table in its project that lets visitors in.
-- This script doesn't touch any other table.
--
-- Set it up (once, a few minutes):
--   1. Supabase dashboard → New project (a fresh one for this site).
--   2. SQL Editor → New query → paste this whole file → Run. You should see
--      "Success. No rows returned".
--   3. Put the project's URL and publishable key into .env.production
--      (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) or into the repo's Actions
--      Variables, and push. The table name (VITE_GUESTBOOK_TABLE=guestbook)
--      is already there.
--   Until then, the site's guestbook quietly says "opens soon" and keeps
--   visitors' notes on their own device.
--
-- How moderation works:
--   • Every new note is saved with hidden = true. The database forces this, no
--     matter what a visitor sends, and visitors can only read notes where
--     hidden = false. So a new note is invisible to everyone until you approve it.
--   • APPROVE a note: Table Editor → guestbook → (tip: Filter → hidden
--     equals true shows the waiting notes) → double-click the note's `hidden`
--     cell → set it to false → Save. It shows on the wall the next time
--     someone opens the guestbook.
--   • Approve from the SQL Editor instead (copy the id from the Table Editor):
--       update public.guestbook set hidden = false where id = '<the id>';
--   • See what's waiting:
--       select created_at, name, message from public.guestbook
--       where hidden order by created_at;
--   • Take an approved note down again: set hidden back to true.
--   • Delete a note for good: tick the row → Delete. You're the project owner,
--     so row level security doesn't apply to you in the dashboard.
--   • Notes you add yourself in the Table Editor start hidden too; approve them
--     the same way.
--   • Visitors can never edit, approve, hide or delete notes.
--
-- Optional housekeeping (run in the SQL Editor whenever you like):
--   -- clear out notes you never approved that are older than 30 days
--   delete from public.guestbook where hidden and created_at < now() - interval '30 days';
--   -- keep the wall to the last 12 months
--   delete from public.guestbook where created_at < now() - interval '12 months';
--
-- The publishable (anon) key in .env.production is public by design. Row level
-- security below is what keeps this table safe. Never put the service_role /
-- secret key (sb_secret_…) in the website.
--
-- This script is safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto; -- gen_random_uuid() (already on in Supabase)

create table if not exists public.guestbook (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text        not null,
  message     text        not null,
  sticker     text        not null default '',
  color       text        not null default 'lavender',
  -- true = waiting for approval (or taken down). New notes always start hidden.
  hidden      boolean     not null default true,

  constraint guestbook_name_length    check (char_length(btrim(name)) between 1 and 40 and char_length(name) <= 40),
  constraint guestbook_message_length check (char_length(btrim(message)) between 1 and 280 and char_length(message) <= 280),
  -- exactly the stickers the site offers (src/lib/guestbook.ts → STICKERS), or none
  constraint guestbook_sticker        check (sticker in ('', '🌷', '✨', '🍓', '🦋', '🌈', '🍑', '💌', '🧸')),
  constraint guestbook_color_palette  check (color in ('lavender', 'peach', 'butter', 'mint', 'sky', 'pink'))
);

comment on table public.guestbook is
  'The site''s guestbook. New notes arrive hidden; approve one by setting hidden = false in the Table Editor.';
comment on column public.guestbook.hidden is
  'true = waiting for approval (or taken down). Set to false to approve: the note then shows on the wall. Visitors cannot change it.';

-- The wall reads the newest 100 approved notes; the flood guard counts recent ones.
create index if not exists guestbook_created_at_idx on public.guestbook (created_at desc);

-- ── Row level security ──────────────────────────────────────────────────────
alter table public.guestbook enable row level security;

-- Visitors (the publishable/anon key) see approved notes only.
drop policy if exists "guestbook: read approved notes" on public.guestbook;
create policy "guestbook: read approved notes"
  on public.guestbook
  for select
  to anon
  using (hidden = false);

-- Visitors can send a note, but only as a hidden one waiting for approval.
-- (The trigger below sets hidden = true before this check runs.)
drop policy if exists "guestbook: send a note for approval" on public.guestbook;
create policy "guestbook: send a note for approval"
  on public.guestbook
  for insert
  to anon
  with check (hidden = true);

-- No UPDATE or DELETE policies on purpose: with RLS on, those are denied.
-- Belt and braces: start from no privileges at all, then give visitors only
-- what the site needs. They can write the four columns the form sends (id,
-- created_at and hidden are always the database's own values) and read rows the
-- policy above lets through. Signed-in users ("authenticated") get nothing: this
-- site never signs anyone in.
revoke all on public.guestbook from anon, authenticated;
grant insert (name, message, sticker, color) on public.guestbook to anon;
grant select on public.guestbook to anon;

-- ── Flood guard + moderation flag ───────────────────────────────────────────
-- Runs before every insert:
--   • forces hidden = true (pre-moderation) and the server's own timestamp,
--   • a global brake: more than 30 notes in the last minute → "try again in a
--     minute". The site also limits each visitor to one note a minute, but that
--     check lives in the browser and can be skipped.
--   • a queue cap: more than 300 unapproved notes from the last day (a spam run
--     nobody has looked at yet) → stop taking new ones until you've had a look.
-- SECURITY DEFINER so it can count hidden rows too (RLS would hide them).
create or replace function public.guestbook_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent  integer;
  waiting integer;
begin
  -- Never trust client timestamps or moderation flags.
  new.created_at := now();
  new.hidden := true;
  new.name := btrim(new.name);
  new.message := btrim(new.message);

  select count(*) into recent
  from public.guestbook
  where created_at > now() - interval '1 minute';

  if recent >= 30 then
    -- PostgREST turns SQLSTATE 'PT429' into HTTP 429; the site shows a friendly "try again in a minute".
    raise sqlstate 'PT429' using message = 'guestbook flood guard: too many notes right now, try again in a minute';
  end if;

  select count(*) into waiting
  from public.guestbook
  where hidden and created_at > now() - interval '1 day';

  if waiting >= 300 then
    raise sqlstate 'PT429' using message = 'guestbook flood guard: too many notes waiting for approval, try again later';
  end if;

  return new;
end;
$$;

revoke all on function public.guestbook_before_insert() from public, anon, authenticated;

drop trigger if exists guestbook_before_insert on public.guestbook;
create trigger guestbook_before_insert
  before insert on public.guestbook
  for each row
  execute function public.guestbook_before_insert();
