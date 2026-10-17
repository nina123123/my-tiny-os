import { osName } from '../content/profile'

/**
 * The OS's name split for its wordmark: a trailing "OS" is its own part, so it
 * can keep its own styling ("MiaOS" → ["Mia", "OS"]). A name that doesn't end
 * in "OS" comes back whole, with an empty tail.
 */
export function splitOsName(name = osName): { head: string; tail: string } {
  const m = /^(.+?)(OS)$/.exec(name)
  return m ? { head: m[1], tail: m[2] } : { head: name, tail: '' }
}
