import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOwnerTokens } from '@/stores/ownerTokens'
import type { PlaceCategory } from './catalog'
import { apiFetch } from './client'
import { queryKeys } from './queryKeys'
import type { AirportBufferMin, ImmigrationMin } from './transfers'

export type ItineraryWarning =
  'OUTSIDE_OPENING_HOURS' | 'BEFORE_ARRIVAL' | 'AFTER_DEPARTURE_LEAVE_TIME'

export interface ItineraryPlace {
  id: number
  nameKo: string
  category: PlaceCategory
  lat: number
  lng: number
  durationMin: number
}

export interface ItineraryItem {
  itemId: number
  position: number
  /** HH:mm (현지) */
  plannedTime: string | null
  memo: string
  place: ItineraryPlace
  warnings: ItineraryWarning[]
}

export interface ItineraryDay {
  date: string
  dayIndex: number
  /** 숙소 도착 예상 시각. 그 현지 날짜에만 값이 있다 */
  earliestStart: string | null
  /** 숙소 출발 마감 시각. 그 현지 날짜에만 값이 있다 */
  latestEnd: string | null
  items: ItineraryItem[]
}

export interface Itinerary {
  timezone: string
  /** 숙소 출발 경고에 더하는, 마지막 장소에서 숙소로 돌아갈 여유(추정치) */
  returnMarginMin: number
  days: ItineraryDay[]
}

/** POST·PATCH 응답. 경고는 없으므로 GET을 다시 받는다 */
export type SavedItineraryItem = Omit<ItineraryItem, 'warnings'> & {
  date: string
}

const itineraryPath = (tripId: string) =>
  `/trips/${encodeURIComponent(tripId)}/itinerary`

export const getItinerary = (
  tripId: string,
  immigrationMin: ImmigrationMin,
  airportBufferMin: AirportBufferMin,
  ownerToken: string,
) => {
  const params = new URLSearchParams({
    immigrationMin: String(immigrationMin),
    airportBufferMin: String(airportBufferMin),
  })
  return apiFetch<Itinerary>(`${itineraryPath(tripId)}?${params.toString()}`, {
    ownerToken,
  })
}

export const addItineraryItem = (
  tripId: string,
  body: {
    placeId: number
    date: string
    plannedTime: string | null
    memo?: string
  },
  ownerToken: string,
) =>
  apiFetch<SavedItineraryItem>(`${itineraryPath(tripId)}/items`, {
    method: 'POST',
    body,
    ownerToken,
  })

/** 전체 교체: plannedTime이 null이면 시각을 지운다 */
export const updateItineraryItem = (
  tripId: string,
  itemId: number,
  body: { plannedTime: string | null; memo: string },
  ownerToken: string,
) =>
  apiFetch<SavedItineraryItem>(`${itineraryPath(tripId)}/items/${itemId}`, {
    method: 'PATCH',
    body,
    ownerToken,
  })

export const deleteItineraryItem = (
  tripId: string,
  itemId: number,
  ownerToken: string,
) =>
  apiFetch<void>(`${itineraryPath(tripId)}/items/${itemId}`, {
    method: 'DELETE',
    ownerToken,
  })

/** 다른 날짜의 항목을 넣으면 이 날짜로 옮겨진다 */
export const putDayOrder = (
  tripId: string,
  date: string,
  itemIds: number[],
  ownerToken: string,
) =>
  apiFetch<void>(
    `${itineraryPath(tripId)}/days/${encodeURIComponent(date)}/order`,
    { method: 'PUT', body: { itemIds }, ownerToken },
  )

export function useItinerary(
  tripId: string,
  immigrationMin: ImmigrationMin,
  airportBufferMin: AirportBufferMin,
) {
  const queryClient = useQueryClient()
  const token = useOwnerTokens((s) => s.tokens[tripId])
  // 변경 처리 중에 다시 받으면 낙관적 상태를 중간 결과로 덮어쓴다. 변경이 끝나면 어차피 다시 받는다
  const noMutationInFlight = () =>
    queryClient.isMutating({
      mutationKey: queryKeys.itineraryMutations(tripId),
    }) === 0
  return useQuery({
    queryKey: queryKeys.itinerary(tripId, immigrationMin, airportBufferMin),
    queryFn: () =>
      getItinerary(tripId, immigrationMin, airportBufferMin, token),
    enabled: !!token,
    // 데이터가 없는 첫 로드는 이 옵션과 무관하게 항상 받는다
    refetchOnMount: noMutationInFlight,
    refetchOnWindowFocus: noMutationInFlight,
    refetchOnReconnect: noMutationInFlight,
    // 이전 설정의 "늦어도" 시각이 읽히면 안 되므로 placeholderData를 쓰지 않는다
    retry: false,
  })
}
