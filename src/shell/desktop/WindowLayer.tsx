import { AnimatePresence } from 'motion/react'
import { useWindows } from '../../os/store'
import { WindowFrame } from './WindowFrame'

/** Every open window (minimized ones stay mounted so app state survives). */
export function WindowLayer() {
  const windows = useWindows((s) => s.windows)
  const focusedId = useWindows((s) => s.focusedId)
  return (
    <div className="win-layer">
      <AnimatePresence>
        {windows.map((w) => (
          <WindowFrame key={w.id} w={w} focused={focusedId === w.id} />
        ))}
      </AnimatePresence>
    </div>
  )
}
