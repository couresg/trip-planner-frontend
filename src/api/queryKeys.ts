import type { PlaceFilters } from './catalog'

export const queryKeys = {
  health: ['health'] as const,
  cities: ['cities'] as const,
  areas: (cityCode: string) => ['cities', cityCode, 'areas'] as const,
  places: (cityCode: string, filters: PlaceFilters) =>
    [
      'cities',
      cityCode,
      'places',
      filters.category ?? null,
      filters.q ?? '',
    ] as const,
}
