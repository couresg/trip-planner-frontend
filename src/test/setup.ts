import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetTrips } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { useOwnerTokens } from '@/stores/ownerTokens'

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetTrips()
  localStorage.clear()
  useOwnerTokens.setState({ tokens: {} })
})
afterAll(() => server.close())
