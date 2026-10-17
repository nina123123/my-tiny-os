import type { Project, ProjectCategory } from './types'

/*
 * ✏️ Your projects. Each one is a file in the Projects app and opens into its
 * own window with the story, stats, photos and videos. Photos live in
 * /public/media/<id>/; a project without a `cover` gets a generated one from
 * its `emoji` and `colors`. Order here = order in the app.
 * (These are Alex Park's made-up demo projects. Replace them with your own.)
 */

/** The groups your projects fall into */
export const categories: ProjectCategory[] = [
  {
    id: 'builds',
    label: 'Builds',
    emoji: '🛠️',
    color: 'var(--coral-400)',
    blurb: 'Things with wires, motors and a lot of trial and error.',
  },
  {
    id: 'web',
    label: 'Web',
    emoji: '💻',
    color: 'var(--lavender-500)',
    blurb: 'Sites I made for people and clubs I like.',
  },
  {
    id: 'print',
    label: 'Print',
    emoji: '📰',
    color: 'var(--mint-400)',
    blurb: 'Paper things you can hold: zines, posters and stickers.',
  },
]

export const projects: Project[] = [
  {
    id: 'club-robot',
    title: 'Sprocket the Robot',
    subtitle: 'robotics club · lead programmer',
    year: '2025 – 2026',
    sortDate: 202603,
    categoryId: 'builds',
    emoji: '🤖',
    colors: ['#FFD9C7', '#D6C8FF'],
    summary: 'Our robotics club\'s competition robot: it picks up foam rings, stacks them, and only sometimes drives into the wall.',
    role: 'Lead programmer',
    stats: [
      { label: 'lines of code (half of them comments)', value: 1200, suffix: '+' },
      { label: 'matches played at the regional meet', value: 9 },
      { label: 'wheels replaced along the way', value: 4 },
    ],
    story: [
      {
        heading: 'The brief',
        body: 'Every year the competition picks a new challenge. This year: pick up foam rings and stack them on posts, faster than the other team.\n\nWe had eight weeks, a box of parts and a robot we named before it could move.',
      },
      {
        heading: 'My part',
        body: 'I wrote the code that drives Sprocket: the controls for the driver, and a 15-second autonomous routine that runs on its own at the start of each match.\n\nThe routine worked perfectly in our classroom and not at all on the competition floor, which taught me more about sensors than any tutorial.',
      },
      {
        heading: 'What I learned',
        body: 'Test where you\'ll perform. Label your cables. And always bring a spare wheel.',
      },
    ],
    tags: ['robotics', 'code', 'teamwork'],
    featured: true,
  },
  {
    id: 'band-website',
    title: 'Band Night Website',
    subtitle: 'school jazz band · design & code',
    year: '2025',
    sortDate: 202510,
    categoryId: 'web',
    emoji: '🎷',
    colors: ['#FFF4C7', '#FFB3D1'],
    summary: 'A small website for our school jazz band\'s concert night, with the program, the players and a way to reserve seats.',
    role: 'Designer & developer',
    stats: [
      { label: 'pages', value: 5 },
      { label: 'seats reserved through it', value: 140 },
      { label: 'late nights fixing the phone layout', value: 6 },
    ],
    story: [
      {
        heading: 'Why a website',
        body: 'Every year the band printed paper flyers and every year half the school missed the date. A link in the group chat seemed like a better idea.',
      },
      {
        heading: 'How it came together',
        body: 'I sketched it on paper first, then built it one page at a time: the program, the band, the seat form. The band picked the colors (they wanted "brassy").\n\nMost people opened it on their phones, so the phone layout got the most love.',
      },
    ],
    links: [{ label: 'Visit the site', href: 'https://example.com/' }],
    tags: ['web', 'design', 'music'],
    featured: true,
  },
  {
    id: 'photo-zine',
    title: 'Corners: a Photo Zine',
    subtitle: 'self-published zine · photos & layout',
    year: '2024',
    sortDate: 202405,
    categoryId: 'print',
    emoji: '📷',
    colors: ['#C9DDF2', '#B9EBD3'],
    summary: 'A 24-page zine of photos of the forgotten corners of my town: bike racks, stairwells, a very proud pigeon.',
    role: 'Photographer & editor',
    stats: [
      { label: 'pages', value: 24 },
      { label: 'copies printed and folded by hand', value: 50 },
      { label: 'photos taken to pick the final ones', value: 300, suffix: '+' },
    ],
    story: [
      {
        heading: 'The idea',
        body: 'I started noticing the places nobody looks at twice, and taking a picture of one every day on my way to school.',
      },
      {
        heading: 'Making it',
        body: 'Choosing the photos took longer than taking them. I laid out the pages on the library computer, printed them double-sided and folded every copy at the kitchen table.\n\nThe last ten copies went to the people who appear in them by accident (they all said yes).',
      },
    ],
    tags: ['photography', 'zine', 'print'],
  },
]

export const getProject = (id: string) => projects.find((p) => p.id === id)
export const getCategory = (id: string) => categories.find((c) => c.id === id)
