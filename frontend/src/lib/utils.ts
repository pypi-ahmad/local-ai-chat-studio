// Shared className helper (shadcn/ui convention): merges conditional class
// lists via clsx, then resolves conflicting Tailwind utility classes via
// tailwind-merge. Used throughout components/ui/** and feature components.
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
