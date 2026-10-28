import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { server } from '@/mocks/server'
import { ApiError } from './client'
import {
  getPlaces,
  useAreasQuery,
  useCitiesQuery,
  usePlacesQuery,
} from './catalog'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useCitiesQuery', () => {
  it('returns cities with airports', async () => {
    const { result } = renderHook(() => useCitiesQuery(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0]).toMatchObject({
      code: 'OSA',
      timezone: 'Asia/Tokyo',
      airports: [{ iata: 'KIX' }],
    })
  })
})

describe('useAreasQuery', () => {
  it('loads areas for a city', async () => {
    const { result } = renderHook(() => useAreasQuery('OSA'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.map((a) => a.nameKo)).toEqual([
      '난바',
      '우메다',
      '신오사카',
      '텐노지',
    ])
  })

  it('stays idle without a cityCode', () => {
    const { result } = renderHook(() => useAreasQuery(undefined), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.isPending).toBe(true)
  })

  it('maps unknown city to ApiError', async () => {
    const { result } = renderHook(() => useAreasQuery('XXX'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(ApiError)
    expect(result.current.error).toMatchObject({
      status: 404,
      code: 'CITY_NOT_FOUND',
    })
  })
})

describe('usePlacesQuery', () => {
  it('stays idle without a cityCode', () => {
    const { result } = renderHook(() => usePlacesQuery(undefined), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('passes category and q as query params', async () => {
    const seen: string[] = []
    server.use(
      http.get('*/api/v1/cities/OSA/places', ({ request }) => {
        seen.push(new URL(request.url).search)
        return HttpResponse.json([])
      }),
    )
    const { result } = renderHook(
      () => usePlacesQuery('OSA', { category: 'FOOD', q: '도톤' }),
      {
        wrapper,
      },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const params = new URLSearchParams(seen[0])
    expect(params.get('category')).toBe('FOOD')
    expect(params.get('q')).toBe('도톤')
  })

  it('omits empty filters', async () => {
    const seen: string[] = []
    server.use(
      http.get('*/api/v1/cities/OSA/places', ({ request }) => {
        seen.push(new URL(request.url).search)
        return HttpResponse.json([])
      }),
    )
    await getPlaces('OSA', { q: '' })
    expect(seen).toEqual([''])
  })

  it('filters by category via the mock', async () => {
    const { result } = renderHook(
      () => usePlacesQuery('OSA', { category: 'SIGHT' }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.map((p) => p.nameKo)).toEqual(['오사카성'])
  })

  it('maps unknown city to ApiError', async () => {
    const { result } = renderHook(() => usePlacesQuery('XXX'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({
      status: 404,
      code: 'CITY_NOT_FOUND',
    })
  })
})

describe('place shape', () => {
  it('exposes alwaysOpen with empty openingHours for 24h places', async () => {
    const { result } = renderHook(
      () => usePlacesQuery('OSA', { category: 'FOOD' }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0]).toMatchObject({
      openingHours: [],
      alwaysOpen: true,
    })
  })
})
