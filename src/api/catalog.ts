import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import { queryKeys } from './queryKeys'

export interface Airport {
  iata: string
  nameKo: string
}

export interface City {
  code: string
  nameKo: string
  country: string
  timezone: string
  airports: Airport[]
}

export interface Area {
  id: number
  nameKo: string
  lat: number
  lng: number
  description: string | null
}

export type PlaceCategory =
  'SIGHT' | 'FOOD' | 'SHOPPING' | 'NATURE' | 'NIGHT' | 'CULTURE'

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'

export interface OpeningHours {
  dayOfWeek: DayOfWeek
  open: string
  close: string
}

export interface Place {
  id: number
  nameKo: string
  category: PlaceCategory
  lat: number
  lng: number
  openingHours: OpeningHours[]
  alwaysOpen: boolean
  durationMin: number
  summary: string | null
}

export interface PlaceFilters {
  category?: PlaceCategory
  q?: string
}

export const getCities = () => apiFetch<City[]>('/cities')

export const getAreas = (cityCode: string) =>
  apiFetch<Area[]>(`/cities/${encodeURIComponent(cityCode)}/areas`)

export function getPlaces(
  cityCode: string,
  { category, q }: PlaceFilters = {},
) {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (q) params.set('q', q)
  const query = params.toString()
  return apiFetch<Place[]>(
    `/cities/${encodeURIComponent(cityCode)}/places${query ? `?${query}` : ''}`,
  )
}

export function useCitiesQuery() {
  return useQuery({
    queryKey: queryKeys.cities,
    queryFn: getCities,
    retry: false,
  })
}

export function useAreasQuery(cityCode: string | undefined) {
  return useQuery({
    queryKey: queryKeys.areas(cityCode ?? ''),
    queryFn: () => getAreas(cityCode as string),
    enabled: !!cityCode,
    retry: false,
  })
}

export function usePlacesQuery(
  cityCode: string | undefined,
  filters: PlaceFilters = {},
) {
  return useQuery({
    queryKey: queryKeys.places(cityCode ?? '', filters),
    queryFn: () => getPlaces(cityCode as string, filters),
    enabled: !!cityCode,
    retry: false,
  })
}
