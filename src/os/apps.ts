import { profile } from '../content/profile'
import type { AppDef, AppId } from './types'

const name = profile.firstName

/*
 * ✏️ Apps you've switched off, e.g. ['guestbook'] or ['guestbook', 'contact'].
 * A switched-off app gets no desktop, dock or home-screen icon, and every menu
 * item and button that opens it disappears too (they all check isAppOn). Its
 * code stays in the repo, so switching it back on is just removing it here.
 * 'welcome', 'projects', 'project' and 'about' are the core and always stay on.
 */
export const HIDDEN_APPS: AppId[] = []

/** false for apps listed in HIDDEN_APPS */
export const isAppOn = (id: AppId) => !HIDDEN_APPS.includes(id)

/*
 * App registry. Every app is code-split and loaded on first open.
 * Order here = order on the desktop, dock and home screen.
 */
const REGISTRY: AppDef[] = [
  {
    id: 'welcome',
    name: 'Hello',
    title: 'hello!',
    description: `A little hello from ${name}`,
    load: () => import('../apps/welcome'),
    defaultSize: { width: 560, height: 470 },
    minSize: { width: 360, height: 360 },
    desktop: false,
    dock: false,
    home: false,
    homeDock: false,
    singleton: true,
    chromeless: true,
  },
  {
    id: 'projects',
    name: 'Projects',
    title: 'Projects',
    description: `Everything ${name} has built and done`,
    load: () => import('../apps/projects'),
    defaultSize: { width: 920, height: 620 },
    minSize: { width: 420, height: 380 },
    desktop: true,
    dock: true,
    home: true,
    homeDock: true,
    singleton: true,
  },
  {
    id: 'project',
    name: 'Project',
    title: 'Project',
    description: 'The story of one project',
    load: () => import('../apps/project'),
    defaultSize: { width: 780, height: 660 },
    minSize: { width: 380, height: 360 },
    desktop: false,
    dock: false,
    home: false,
    homeDock: false,
    singleton: false,
  },
  {
    id: 'about',
    name: 'About Me',
    title: `about ${name.toLowerCase()}`,
    description: `Who ${name} is`,
    load: () => import('../apps/about'),
    defaultSize: { width: 680, height: 640 },
    minSize: { width: 380, height: 380 },
    desktop: true,
    dock: true,
    home: true,
    homeDock: false,
    singleton: true,
  },
  {
    id: 'guestbook',
    name: 'Guestbook',
    title: 'guestbook',
    description: `Leave ${name} a note`,
    load: () => import('../apps/guestbook'),
    defaultSize: { width: 620, height: 640 },
    minSize: { width: 360, height: 420 },
    desktop: true,
    dock: true,
    home: true,
    homeDock: true,
    singleton: true,
  },
  {
    id: 'contact',
    name: 'Contact',
    title: 'say hi',
    description: `Where to find ${name}`,
    load: () => import('../apps/contact'),
    defaultSize: { width: 460, height: 600 },
    minSize: { width: 320, height: 380 },
    desktop: true,
    dock: true,
    home: true,
    homeDock: false,
    singleton: true,
  },
]

/** The registry with switched-off apps' icons removed (getApp still finds them, so nothing crashes). */
export const APPS: AppDef[] = REGISTRY.map((a) =>
  isAppOn(a.id) ? a : { ...a, desktop: false, dock: false, home: false, homeDock: false },
)

const byId = new Map(APPS.map((a) => [a.id, a]))

export function getApp(id: AppId): AppDef {
  const app = byId.get(id)
  if (!app) throw new Error(`Unknown app: ${id}`)
  return app
}
