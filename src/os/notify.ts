import { create } from 'zustand'
import type { AppId } from './types'

/*
 * Notifications (toasts). Rendered by src/fx/Toaster.tsx:
 * top-right under the menu bar on desktop, top banner on mobile.
 */

export type Notice = {
  id: string
  title: string
  body?: string
  /** Emoji shown in the notification's icon bubble */
  icon?: string
  /** Clicking the notification opens this app */
  appId?: AppId
  /** ms before auto-dismiss (default 4500) */
  duration?: number
}

type NotifyStore = {
  notices: Notice[]
  notify: (n: Omit<Notice, 'id'> & { id?: string }) => string
  dismiss: (id: string) => void
}

let n = 0

export const useNotify = create<NotifyStore>()((set) => ({
  notices: [],
  notify(notice) {
    const id = notice.id ?? `notice-${++n}`
    set((s) => ({ notices: [...s.notices.filter((x) => x.id !== id), { ...notice, id }].slice(-4) }))
    return id
  },
  dismiss(id) {
    set((s) => ({ notices: s.notices.filter((x) => x.id !== id) }))
  },
}))

export const notify = (notice: Omit<Notice, 'id'> & { id?: string }) => useNotify.getState().notify(notice)
