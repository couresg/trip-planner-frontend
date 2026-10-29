import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { server } from '@/mocks/server'
import { ApiError } from './client'
import {
  effectiveTime,
  isValidFlightNo,
  lookupFlight,
  normalizeFlightNo,
  useFlightLookup,
} from './flights'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('normalizeFlightNo', () => {
  it('trims, strips spaces/hyphens and uppercases', () => {
    expect(normalizeFlightNo('ke 723')).toBe('KE723')
    expect(normalizeFlightNo('  7c-1302 ')).toBe('7C1302')
  })

  it('strips leading zeros in the numeric part', () => {
    expect(normalizeFlightNo('KE0723')).toBe('KE723')
    expect(normalizeFlightNo('ke 0007')).toBe('KE7')
    expect(normalizeFlightNo('7C0302')).toBe('7C302')
  })

  it('keeps a single zero when the number is all zeros', () => {
    expect(normalizeFlightNo('KE0')).toBe('KE0')
    expect(normalizeFlightNo('KE0000')).toBe('KE0')
  })

  it('leaves non-matching input untouched apart from cleanup', () => {
    expect(normalizeFlightNo('ke00723')).toBe('KE00723')
  })
})

describe('isValidFlightNo', () => {
  it('accepts IATA flight numbers', () => {
    expect(isValidFlightNo('KE723')).toBe(true)
    expect(isValidFlightNo('7C1302')).toBe(true)
  })

  it('rejects malformed input', () => {
    expect(isValidFlightNo('')).toBe(false)
    expect(isValidFlightNo('K7')).toBe(false)
    expect(isValidFlightNo('KE')).toBe(false)
    expect(isValidFlightNo('KE12345')).toBe(false)
    expect(isValidFlightNo('ke723')).toBe(false)
  })
})

describe('effectiveTime', () => {
  it('prefers revised over scheduled', () => {
    expect(
      effectiveTime({
        iata: 'KIX',
        scheduled: 'a',
        revised: 'b',
        terminal: null,
      }),
    ).toBe('b')
    expect(
      effectiveTime({
        iata: 'KIX',
        scheduled: 'a',
        revised: null,
        terminal: null,
      }),
    ).toBe('a')
  })
})

describe('useFlightLookup', () => {
  it('returns legs for a known flight', async () => {
    const { result } = renderHook(
      () => useFlightLookup('ke 723', '2026-11-05'),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.flightNo).toBe('KE723')
    expect(result.current.data?.legs[0]).toMatchObject({
      departure: { iata: 'ICN', scheduled: '2026-11-05T12:00:00+09:00' },
      arrival: { iata: 'KIX', revised: '2026-11-05T13:52:00+09:00' },
    })
  })

  it('crosses midnight into the next day', async () => {
    const data = await lookupFlight('7C1302', '2026-11-30')
    expect(data.legs[0].arrival.scheduled).toBe('2026-12-01T00:20:00+09:00')
  })

  it('returns two legs for a connecting flight', async () => {
    const data = await lookupFlight('TW9901', '2026-11-05')
    expect(data.legs.map((l) => l.arrival.iata)).toEqual(['FUK', 'KIX'])
    expect(data.legs[0].departure.scheduled).toBe('2026-11-05T08:00:00+09:00')
    expect(data.legs[0].arrival.scheduled).toBe('2026-11-05T09:20:00+09:00')
    expect(data.legs[1].departure.scheduled).toBe('2026-11-05T10:30:00+09:00')
    expect(data.legs[1].arrival.scheduled).toBe('2026-11-05T11:40:00+09:00')
  })

  it('resolves a flight number with leading zeros', async () => {
    const { result } = renderHook(
      () => useFlightLookup('KE0723', '2026-11-05'),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.flightNo).toBe('KE723')
  })

  it('does not retry on 503 provider outage', async () => {
    let calls = 0
    server.use(
      http.get('*/api/v1/flights/lookup', () => {
        calls += 1
        return HttpResponse.json(
          {
            title: 'Service Unavailable',
            status: 503,
            code: 'FLIGHT_PROVIDER_UNAVAILABLE',
          },
          { status: 503 },
        )
      }),
    )
    const { result } = renderHook(
      () => useFlightLookup('KE723', '2026-11-05'),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({
      code: 'FLIGHT_PROVIDER_UNAVAILABLE',
    })
    expect(calls).toBe(1)
  })

  it('retries other 5xx at most once', async () => {
    let calls = 0
    server.use(
      http.get('*/api/v1/flights/lookup', () => {
        calls += 1
        return HttpResponse.json(
          { title: 'Internal Server Error', status: 500 },
          { status: 500 },
        )
      }),
    )
    const { result } = renderHook(
      () => useFlightLookup('KE723', '2026-11-05'),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 4000,
    })
    expect(calls).toBe(2)
  })

  it('exposes canceled status', async () => {
    const data = await lookupFlight('LJ231', '2026-11-05')
    expect(data.legs[0].status).toBe('Canceled')
    expect(data.legs[0].departure.scheduled).toBe('2026-11-05T07:00:00+09:00')
    expect(data.legs[0].arrival.scheduled).toBe('2026-11-05T08:45:00+09:00')
  })

  it('matches the backend fixture for a delayed flight', async () => {
    const data = await lookupFlight('OZ112', '2026-11-05')
    expect(data.legs[0].status).toBe('Delayed')
    expect(data.legs[0].departure).toMatchObject({
      scheduled: '2026-11-05T09:00:00+09:00',
      revised: '2026-11-05T10:30:00+09:00',
    })
    expect(data.legs[0].arrival).toMatchObject({
      scheduled: '2026-11-05T10:50:00+09:00',
      revised: '2026-11-05T12:20:00+09:00',
    })
  })

  it('maps unknown flight to ApiError FLIGHT_NOT_FOUND', async () => {
    const { result } = renderHook(
      () => useFlightLookup('ZZ9999', '2026-11-05'),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(ApiError)
    expect(result.current.error).toMatchObject({
      status: 404,
      code: 'FLIGHT_NOT_FOUND',
    })
  })

  it('maps malformed flight number from the API to INVALID_FLIGHT_NO', async () => {
    await expect(lookupFlight('K', '2026-11-05')).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_FLIGHT_NO',
    })
  })

  it('maps a malformed date from the API to VALIDATION_FAILED', async () => {
    await expect(lookupFlight('KE723', '2026/11/05')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
    })
  })

  it('stays idle with an invalid flight number', () => {
    const { result } = renderHook(() => useFlightLookup('K', '2026-11-05'), {
      wrapper,
    })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('stays idle without a date', () => {
    const { result } = renderHook(() => useFlightLookup('KE723', undefined), {
      wrapper,
    })
    expect(result.current.fetchStatus).toBe('idle')
  })
})
