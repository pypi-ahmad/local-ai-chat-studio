// Shared page-heading layout used by most top-level route pages (see
// frontend/src/routes/**) for a consistent eyebrow/title/description
// header. Purely presentational — must not fetch data or hold state;
// callers own that and pass it down as `children`.
import type { ReactNode } from 'react'

export function Surface({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <main className="page-workspace"><div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div></div>{children}</main>
}
