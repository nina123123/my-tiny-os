import type { Mood } from '../os/settings'

/*
 * ✏️ What the three moods are called, and their emoji. These show in the menu
 * bar, the desktop's right-click menu and the phone status bar. Rename them to
 * fit your world ("day / golden hour / night", "studio / stage / after-hours").
 * The keys (sunrise, sunset, night) stay the same; each mood's colors live in
 * src/styles/tokens.css under [data-mood=…], and night must stay a dark mode.
 */
export const MOOD_TEXT: Record<Mood, { emoji: string; label: string }> = {
  sunrise: { emoji: '☀️', label: 'sunrise' },
  sunset: { emoji: '🌅', label: 'sunset' },
  night: { emoji: '🌙', label: 'night' },
}

/** The menu bar's name for the mood menu */
export const MOOD_MENU = 'Vibes'
