import type { Profile } from './types'

/*
 * ✏️ You: your name, the OS's name and your About-me content.
 * Everything on the site that names its owner reads it from here.
 * (Alex Park is a made-up demo person. Replace every field with your own.)
 */
export const profile: Profile = {
  firstName: 'Alex',
  fullName: 'Alex Park',
  // osName: 'AlexOS', // optional: leave it out and it's your first name + "OS"
  tagline: 'maker · tinkerer · zine person 🔧',
  motif: { emoji: '🔧', word: 'build' },
  origin: 'a small town by the sea 🌊',
  superpower: 'to 🔧 build things that are a little bit useful and a little bit fun',
  intro: [
    'Hi! I\'m Alex 👋',
    'I like to 🔧 build things: robots, websites and paper zines.',
    'Welcome to my little corner of the internet, where all of it lives.',
  ],
  describedAs: ['curious', 'patient', 'funny', 'hands-on'],
  bio: [
    'I\'m a high-school student who can\'t leave things alone. If it has a screw, I want to know what\'s behind it; if it has a bug, I want to be the one who fixes it. Most afternoons you\'ll find me in the robotics room or at the art table, usually with glue on my sleeve.',
    'This site is where I keep the things I\'ve made, the stories behind them and what I learned along the way. Have a look around, open a project, and leave a note in the guestbook if something made you smile.',
  ],
  currently: [
    { label: 'building', value: 'a line-following robot' },
    { label: 'learning', value: 'bass guitar, slowly' },
    { label: 'reading', value: 'a book about bridges' },
  ],
  // front: the short teaser on the card; back: the whole fact
  funFacts: [
    { front: '3 soldering burns, 0 regrets 🔥', back: 'I learned to solder from online videos and a very patient club advisor. My fingertips have the souvenirs to prove it.' },
    { front: 'I fix the school printer 🖨️', back: 'At some point the front office started calling me before the repair service. It\'s usually a paper jam. It\'s always a paper jam.' },
    { front: 'my first website was about cats 🐈', back: 'I was eleven, it had one page, six fonts and a background that blinked. I still think about that background.' },
  ],
  // avatar: 'media/about/avatar.webp', // optional: without it, a drawn avatar shows your initial
  languages: ['English', 'a little Spanish'],
}

/** The OS's name: profile.osName, or your first name + "OS" */
export const osName = profile.osName ?? `${profile.firstName}OS`
