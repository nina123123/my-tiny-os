import type { ContactLink } from './types'

/*
 * ✏️ Where people can reach you: one card per link in the Contact app.
 * A mailto: link gets a copy button. A card with `placeholder: true` (or an
 * empty href) shows as a soft "coming soon" card.
 * (These are made-up demo links. Replace them with your own.)
 */
export const links: ContactLink[] = [
  {
    id: 'email',
    label: 'Email',
    handle: 'hello@example.com',
    href: 'mailto:hello@example.com',
    emoji: '✉️',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    handle: '@alex.example',
    href: 'https://instagram.com/alex.example',
    emoji: '📸',
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    handle: 'example.com',
    href: 'https://example.com/',
    emoji: '🌐',
  },
]
