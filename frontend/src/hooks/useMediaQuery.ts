// Generic media-query hook used by the app shell (App.tsx) for responsive
// layout decisions (mobile nav, wide inspector). Distinct from
// hooks/use-mobile.ts, which is a shadcn-generated hook for components/ui.
import { useEffect, useState } from 'react'

export function useMediaQuery(query: string) {
  // Guard for SSR/non-browser environments where matchMedia doesn't exist;
  // this app is client-only today, but the check is cheap to keep.
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.(query).matches))

  useEffect(() => {
    const media = window.matchMedia?.(query)
    if (!media) return
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}
