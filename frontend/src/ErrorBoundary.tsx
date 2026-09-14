// Top-level React error boundary, mounted once around <App /> in main.tsx.
// Responsible only for catching render-time errors and showing a static
// fallback; must not attempt to recover state or re-render the failed tree.
// For route-scoped recovery (remounted per page instead of a full reload),
// see app/RouteErrorBoundary.tsx.
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>Something went wrong.</h1>
          <p>Reload the page to try again.</p>
        </div>
      )
    }
    return this.props.children
  }
}
