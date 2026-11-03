import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetTrips } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { useOwnerTokens } from '@/stores/ownerTokens'
import {
  DEFAULT_AIRPORT_BUFFER_MIN,
  DEFAULT_IMMIGRATION_MIN,
  useTransferSettings,
} from '@/stores/transferSettings'

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetTrips()
  localStorage.clear()
  useOwnerTokens.setState({ tokens: {} })
  useTransferSettings.setState({
    immigrationMin: DEFAULT_IMMIGRATION_MIN,
    airportBufferMin: DEFAULT_AIRPORT_BUFFER_MIN,
  })
})
afterAll(() => server.close())
