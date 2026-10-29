import { useQuery } from '@tanstack/react-query'
import { ApiError, apiFetch } from './client'
import { queryKeys } from './queryKeys'

export interface FlightPoint {
  iata: string
  scheduled: string
  revised: string | null
  terminal: string | null
}

export interface FlightLeg {
  departure: FlightPoint
  arrival: FlightPoint
  status: string
}

export interface FlightLookup {
  flightNo: string
  legs: FlightLeg[]
}

const FLIGHT_NO_PATTERN = /^[A-Z0-9]{2}\d{1,4}$/

export const isValidFlightNo = (flightNo: string) =>
  FLIGHT_NO_PATTERN.test(flightNo)

export function normalizeFlightNo(input: string) {
  const cleaned = input.replace(/[\s-]+/g, '').toUpperCase()
  if (!isValidFlightNo(cleaned)) return cleaned
  const digits = cleaned.slice(2).replace(/^0+/, '')
  return cleaned.slice(0, 2) + (digits || '0')
}

export const effectiveTime = (point: FlightPoint) =>
  point.revised ?? point.scheduled

export const lookupFlight = (flightNo: string, date: string) => {
  const params = new URLSearchParams({ flightNo, date })
  return apiFetch<FlightLookup>(`/flights/lookup?${params.toString()}`)
}

export function useFlightLookup(
  flightNo: string,
  date: string | undefined,
  options: { enabled?: boolean } = {},
) {
  const normalized = normalizeFlightNo(flightNo)
  return useQuery({
    queryKey: queryKeys.flightLookup(normalized, date ?? ''),
    queryFn: () => lookupFlight(normalized, date as string),
    enabled: (options.enabled ?? true) && isValidFlightNo(normalized) && !!date,
    retry: (failureCount, error) => {
      if (
        error instanceof ApiError &&
        ((error.status >= 400 && error.status < 500) || error.status === 503)
      )
        return false
      return failureCount < 1
    },
  })
}
