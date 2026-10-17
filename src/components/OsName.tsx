import { splitOsName } from '../lib/osName'

/** The wordmark: `Name<span>OS</span>` (style the span from the parent's CSS) */
export function OsWordmark() {
  const { head, tail } = splitOsName()
  return (
    <>
      {head}
      {tail ? <span>{tail}</span> : null}
    </>
  )
}
