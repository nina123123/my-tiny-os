import { Component, type ReactNode } from 'react'

/** For the desktop's wallpaper widgets, which are nice-to-haves: if their code can't load (offline), the desktop just goes on without them */
export class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}
