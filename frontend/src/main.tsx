// Application entry point. Responsible only for mounting the React tree to
// the DOM and wrapping it in the top-level error boundary. Must not contain
// routing, data fetching, or feature logic — see App.tsx for the app shell
// and ErrorBoundary.tsx for what happens when a render throws.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.tsx'
import { ErrorBoundary } from './ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
