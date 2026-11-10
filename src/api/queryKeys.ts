import type { PlaceCategory, PlaceFilters } from './catalog'
import type { Pace } from './recommendations'
import type { AirportBufferMin, ImmigrationMin } from './transfers'

export const queryKeys = {
  health: ['health'] as const,
  cities: ['cities'] as const,
  areas: (cityCode: string) => ['cities', cityCode, 'areas'] as const,
  flightLookup: (flightNo: string, date: string) =>
    ['flights', 'lookup', flightNo, date] as const,
  trips: ['trips'] as const,
  tripList: (tripIds: string[]) => ['trips', 'list', tripIds] as const,
  trip: (tripId: string) => ['trips', 'detail', tripId] as const,
  // trip(tripId) 하위 키라 여행 삭제 시 함께 지워진다
  arrivalTransfers: (tripId: string, immigrationMin: ImmigrationMin) =>
    [
      'trips',
      'detail',
      tripId,
      'transfers',
      'arrival',
      immigrationMin,
    ] as const,
  departureTransfers: (tripId: string, airportBufferMin: AirportBufferMin) =>
    [
      'trips',
      'detail',
      tripId,
      'transfers',
      'departure',
      airportBufferMin,
    ] as const,
  itineraryMutations: (tripId: string) => ['itinerary', tripId] as const,
  itineraryAll: (tripId: string) =>
    ['trips', 'detail', tripId, 'itinerary'] as const,
  itinerary: (
    tripId: string,
    immigrationMin: ImmigrationMin,
    airportBufferMin: AirportBufferMin,
  ) =>
    [
      'trips',
      'detail',
      tripId,
      'itinerary',
      immigrationMin,
      airportBufferMin,
    ] as const,
  // trip(tripId) 하위 키라 여행 삭제 시 함께 지워진다
  placeRecommendations: (
    tripId: string,
    categories: PlaceCategory[],
    pace: Pace | null,
  ) =>
    ['trips', 'detail', tripId, 'recommendations', categories, pace] as const,
  places: (cityCode: string, filters: PlaceFilters) =>
    [
      'cities',
      cityCode,
      'places',
      filters.category ?? null,
      filters.q ?? '',
    ] as const,
}
