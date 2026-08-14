import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route UI error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <main className="route-error"><p className="eyebrow">Workspace interrupted</p><h1>This page could not be displayed.</h1><p>Reload this page or return to Chat. Your saved conversations are unchanged.</p><div className="action-row"><button onClick={() => window.location.reload()} type="button">Reload page</button><a href="/chat">Return to Chat</a></div></main>
  }
}
