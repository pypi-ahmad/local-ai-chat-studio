// Vitest global setup (wired via `test.setupFiles` in vite.config.ts and
// vitest.config.ts): adds
// jest-dom matchers to every test and unmounts rendered components after
// each test so DOM state doesn't leak between tests in the same file.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)
