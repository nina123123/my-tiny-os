import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

export type Mood = 'sunrise' | 'sunset' | 'night'
export const MOODS: Mood[] = ['sunrise', 'sunset', 'night']

/** localStorage that never throws (private mode, blocked storage, previews). */
const safeStorage: StateStorage = {
  getItem(name) {
    try {
      return window.localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem(name, value) {
    try {
      window.localStorage.setItem(name, value)
    } catch {
      /* ignore */
    }
  },
  removeItem(name) {
    try {
      window.localStorage.removeItem(name)
    } catch {
      /* ignore */
    }
  },
}

type SettingsStore = {
  mood: Mood
  /** Boot screen finished for this page load */
  booted: boolean
  /** Has seen the boot screen before (persisted → shorter boot next time) */
  seenBoot: boolean
  setMood: (m: Mood) => void
  cycleMood: () => void
  setBooted: () => void
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set, get) => ({
      mood: 'sunrise',
      booted: false,
      seenBoot: false,
      setMood: (mood) => set({ mood }),
      cycleMood: () => {
        const i = MOODS.indexOf(get().mood)
        set({ mood: MOODS[(i + 1) % MOODS.length] })
      },
      setBooted: () => set({ booted: true, seenBoot: true }),
    }),
    {
      name: 'tinyos-settings',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        mood: s.mood,
        seenBoot: s.seenBoot,
      }),
    },
  ),
)
