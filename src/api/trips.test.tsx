import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { server } from '@/mocks/server'
import { useOwnerTokens } from '@/stores/ownerTokens'
import type { TripSummary } from './trips'
import { useTrips } from './trips'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const summary = (n: number): TripSummary => ({
  tripId: `trip-${n}`,
  city: { code: 'OSA', nameKo: '오사카' },
  area: { id: 11, nameKo: '난바' },
  // n이 클수록 이른 날짜 → 서버 배치 순서와 다르게 정렬돼야 한다
  startDate: `2026-${String(12 - (n % 12)).padStart(2, '0')}-${String((n % 28) + 1).padStart(2, '0')}`,
  endDate: '2026-12-31',
  outboundFlightNo: 'KE723',
  returnFlightNo: 'KE724',
})

/** tok-N 토큰마다 trip-N을 돌려주는 목록 API. 헤더의 토큰 개수를 기록한다 */
function serveTrips(alive: (n: number) => boolean = () => true) {
  const batchSizes: number[] = []
  server.use(
    http.get('*/api/v1/trips', ({ request }) => {
      const tokens = (request.headers.get('X-Owner-Token') ?? '').split(',')
      batchSizes.push(tokens.length)
      if (tokens.length > 50)
        return HttpResponse.json({ status: 400 }, { status: 400 })
      const trips = tokens
        .map((t) => Number(t.replace('tok-', '')))
        .filter(alive)
        .map(summary)
      return HttpResponse.json(
        trips.sort((a, b) => a.startDate.localeCompare(b.startDate)),
      )
    }),
  )
  return batchSizes
}

const storeTokens = (count: number) => {
  for (let n = 0; n < count; n++)
    useOwnerTokens.getState().setToken(`trip-${n}`, `tok-${n}`)
}

describe('useTrips', () => {
  it('splits 51 tokens into batches of 50 and merges sorted by startDate', async () => {
    const batchSizes = serveTrips()
    storeTokens(51)
    const { result } = renderHook(() => useTrips(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(batchSizes.sort((a, b) => a - b)).toEqual([1, 50])
    const trips = result.current.data ?? []
    expect(trips).toHaveLength(51)
    const dates = trips.map((t) => t.startDate)
    expect(dates).toEqual([...dates].sort())
    expect(Object.keys(useOwnerTokens.getState().tokens)).toHaveLength(51)
  })

  it('prunes tokens whose trip is gone after a successful response', async () => {
    serveTrips((n) => n !== 1)
    storeTokens(3)
    const { result } = renderHook(() => useTrips(), { wrapper })
    await waitFor(() =>
      expect(useOwnerTokens.getState().tokens).not.toHaveProperty('trip-1'),
    )
    expect(Object.keys(useOwnerTokens.getState().tokens).sort()).toEqual([
      'trip-0',
      'trip-2',
    ])
    await waitFor(() => expect(result.current.data).toHaveLength(2))
  })

  it('never prunes on an error', async () => {
    server.use(
      http.get('*/api/v1/trips', () =>
        HttpResponse.json({ status: 500 }, { status: 500 }),
      ),
    )
    storeTokens(3)
    const { result } = renderHook(() => useTrips(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(Object.keys(useOwnerTokens.getState().tokens)).toHaveLength(3)
  })
})
