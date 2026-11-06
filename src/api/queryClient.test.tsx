import {
  QueryClientProvider,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { renderHook, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { server } from '@/mocks/server'
import { renderRoute } from '@/test/renderRoute'
import { createTrip } from './trips'
import { apiFetch } from './client'
import { createQueryClient, shouldRetry } from './queryClient'
import { useOwnerTokens } from '@/stores/ownerTokens'

const rateLimited = () =>
  HttpResponse.json(
    {
      title: 'Too Many Requests',
      status: 429,
      detail: 'rate limited',
      code: 'RATE_LIMITED',
    },
    { status: 429, headers: { 'Retry-After': '30' } },
  )

function wrapperOf(client = createQueryClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('shouldRetry', () => {
  it('never retries a 429', async () => {
    server.use(http.get('*/api/v1/ping', rateLimited))
    const error = await apiFetch('/ping').catch((e: unknown) => e)
    expect(shouldRetry(0, error)).toBe(false)
  })

  it('keeps the default of up to 3 retries for other errors', () => {
    expect(shouldRetry(0, new Error('boom'))).toBe(true)
    expect(shouldRetry(2, new Error('boom'))).toBe(true)
    expect(shouldRetry(3, new Error('boom'))).toBe(false)
  })
})

describe('429 handling with the app QueryClient', () => {
  it('sends a query exactly once', async () => {
    let calls = 0
    server.use(
      http.get('*/api/v1/ping', () => {
        calls++
        return rateLimited()
      }),
    )
    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['ping'],
          queryFn: () => apiFetch('/ping'),
          retryDelay: 0,
        }),
      { wrapper: wrapperOf() },
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(calls).toBe(1)
  })

  it.each([
    ['429', rateLimited],
    ['500', () => HttpResponse.json({ status: 500 }, { status: 500 })],
  ])('sends a mutation answered with %s exactly once', async (_s, respond) => {
    let calls = 0
    server.use(
      http.post('*/api/v1/ping', () => {
        calls++
        return respond()
      }),
    )
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: () => apiFetch('/ping', { method: 'POST', body: {} }),
          retryDelay: 0,
        }),
      { wrapper: wrapperOf() },
    )
    result.current.mutate()
    await waitFor(() => expect(result.current.isError).toBe(true))
    await new Promise((r) => setTimeout(r, 50))
    expect(calls).toBe(1)
  })
})

describe('429 message on screens', () => {
  it('shows the rate-limit message in the trip list', async () => {
    const { tripId, ownerToken } = await createTrip({
      outboundFlightNo: 'KE723',
      returnFlightNo: 'KE724',
      cityCode: 'OSA',
      areaId: 11,
      startDate: '2026-11-05',
      endDate: '2026-11-08',
      manualOverride: null,
    })
    useOwnerTokens.getState().setToken(tripId, ownerToken)
    server.use(http.get('*/api/v1/trips', rateLimited))
    renderRoute('/')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    )
  })

  it('shows the rate-limit message on the trip detail page', async () => {
    useOwnerTokens.getState().setToken('trip-x', 'tok-x')
    server.use(http.get('*/api/v1/trips/trip-x', rateLimited))
    renderRoute('/trips/trip-x')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    )
  })
})
