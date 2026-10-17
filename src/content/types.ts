/*
 * Content types. Everything the owner edits lives in src/content/*.ts and is
 * typed here, so the UI never hard-codes personal content.
 */

export type Profile = {
  /** First name, used in greetings ("hi, i'm {firstName}") and everywhere the site names its owner */
  firstName: string
  /** Full name, shown on About and Contact */
  fullName: string
  /** The OS's name in the menu bar, boot screen, status bar and tab title. Optional: defaults to `${firstName}OS` */
  osName?: string
  /** One-liner under the greeting, e.g. "builder · dreamer" */
  tagline: string
  /**
   * Your signature word, with an emoji (optional). Wherever "{emoji} {word}" appears in your
   * text (intro, superpower) it gets a highlighter mark, and the emoji is used as a sticker.
   */
  motif?: { emoji: string; word: string }
  /** Words other people use to describe you */
  describedAs: string[]
  /** About-me paragraphs (plain text), one string per paragraph */
  bio: string[]
  /** "Currently" widget: short label → value */
  currently: { label: string; value: string }[]
  /** A fact, or { front: short teaser for the card front, back: the full fact } */
  funFacts: (string | { front: string; back: string })[]
  /** Path under /public (e.g. "media/about/avatar.webp"); leave it out for a drawn avatar with your initial */
  avatar?: string
  avatarAlt?: string
  /** Where you are now, e.g. "Seattle" (optional) */
  location?: string
  /** Where you're from, e.g. "Busan & Vancouver" (optional) */
  origin?: string
  /** Your superpower line, in your own words (optional) */
  superpower?: string
  /** Short first-person intro lines for About (optional) */
  intro?: string[]
  /**
   * Photos of you for the About app (optional).
   * `focus` is a CSS object-position for square crops (e.g. "50% 6%" keeps a face near the top)
   */
  photos?: { src: string; alt: string; caption?: string; focus?: string }[]
  languages?: string[]
  /** True while this is still placeholder copy */
  placeholder?: boolean
}

export type ProjectCategory = {
  id: string
  label: string
  emoji: string
  /** CSS color for chips / folder tint */
  color: string
  /** One line about this group, in your words (sidebar / folder header) */
  blurb?: string
}

export type ProjectStat = {
  label: string
  value: number
  prefix?: string
  suffix?: string
}

export type ProjectSection = {
  heading: string
  body: string
  /** Optional image path under /public */
  image?: string
  imageAlt?: string
}

export type ProjectImage = {
  src: string
  alt: string
  caption?: string
}

export type ProjectLink = {
  label: string
  href: string
}

export type ProjectVideo = {
  /** YouTube video id (the part after watch?v=) */
  youtubeId: string
  title: string
  /**
   * Optional: a photo in public/media (e.g. 'media/x/g1.webp') shown on the
   * play card instead of YouTube's own thumbnail, which loads from YouTube as
   * soon as the window opens and can only be changed on YouTube itself.
   */
  poster?: string
  /** CSS object-position for `poster` inside the 16:9 card, e.g. '50% 20%'. */
  posterFocus?: string
}

export type Project = {
  /** URL-safe id, also used as window id suffix */
  id: string
  title: string
  /** Short clarifier under the title, e.g. "club robot · lead programmer" */
  subtitle?: string
  /** Display year or range, e.g. "2023" or "2022 – now"; '' when undated */
  year: string
  /** Sort key YYYYMM: larger = more recent; 0 when undated */
  sortDate: number
  categoryId: string
  emoji: string
  /** Two CSS colors for the generated cover gradient when there's no image */
  colors: [string, string]
  /** Path under /public; when absent a dreamy generated cover is drawn */
  cover?: string
  coverAlt?: string
  /** Focal point of the cover when it's cropped, as a CSS object-position (e.g. "50% 0%" keeps the top) */
  coverFocus?: string
  /** One-sentence summary for cards */
  summary: string
  /** What you did, e.g. "Founder", "Lead builder" */
  role?: string
  stats?: ProjectStat[]
  story: ProjectSection[]
  gallery?: ProjectImage[]
  /** YouTube videos (shown as a video strip; load the player only on click) */
  videos?: ProjectVideo[]
  links?: ProjectLink[]
  tags: string[]
  /** Pinned projects get a big tile and appear first */
  featured?: boolean
  /** True while this is still placeholder copy */
  placeholder?: boolean
}

export type ContactLink = {
  id: string
  label: string
  /** Shown under the label, e.g. "@alex.example" */
  handle: string
  href: string
  emoji: string
  placeholder?: boolean
}
