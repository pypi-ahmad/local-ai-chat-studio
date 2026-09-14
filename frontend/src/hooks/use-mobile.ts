// shadcn/ui-provided mobile breakpoint hook, currently only consumed by the
// generated components/ui/sidebar.tsx. Not the app shell's media-query hook
// — App.tsx uses hooks/useMediaQuery.ts for its own responsive checks.
// Keep this in sync with sidebar.tsx if it's ever regenerated.
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    // Read the actual value once on mount too, since matchMedia's listener
    // only fires on subsequent changes, not for the initial state.
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
