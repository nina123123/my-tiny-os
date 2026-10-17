import { osName, profile } from '../../content/profile'
import { AboutDialog } from './AboutDialog'
import { Desktop } from './Desktop'
import { Dock } from './Dock'
import { MenuBar } from './MenuBar'
import { WindowLayer } from './WindowLayer'
import './shell.css'

/*
 * The desktop shell (≥ 768px with a mouse): menu bar, desktop surface
 * (icons, widgets, context menu), windows, dock and the "About {osName}"
 * dialog. Rendered inside <main class="os"> by App.
 *
 * Stacking comes from z-index tokens, so the DOM order is chosen for the
 * keyboard: menu bar → desktop icons → windows → dock.
 */
export function DesktopShell() {
  return (
    <div className="dshell">
      {/* the page's heading even on an empty desktop (windows add their own h2s) */}
      <h1 className="sr-only">
        {osName}, {profile.firstName}&rsquo;s desktop
      </h1>
      <MenuBar />
      <Desktop />
      <WindowLayer />
      <Dock />
      <AboutDialog />
    </div>
  )
}
