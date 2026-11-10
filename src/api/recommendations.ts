import { useQuery } from '@tanstack/react-query'
import { useOwnerTokens } from '@/stores/ownerTokens'
import { PLACE_CATEGORIES } from './catalog'
import type { Place, PlaceCategory } from './catalog'
import { apiFetch } from './client'
import { queryKeys } from './queryKeys'

export const PACES = ['RELAXED', 'NORMAL', 'PACKED'] as const
export type Pace = (typeof PACES)[number]

export interface PlaceRecommendation {
  /** 1부터 빈틈없이 */
  rank: number
  reason: string
  place: Place
}

export interface PlaceRecommendations {
  pace: Pace
  placesPerDay: number
  dayCount: number
  /** 일정에 없는 도시 장소 수 */
  candidateCount: number
  recommendations: PlaceRecommendation[]
}

export interface RecommendationRequest {
  categories: PlaceCategory[]
  pace: Pace
}

/** 캐시 키가 고른 순서에 따라 달라지지 않도록 카테고리를 정해진 순서로 맞춘다 */
export const normalizeCategories = (categories: PlaceCategory[]) =>
  PLACE_CATEGORIES.filter((c) => categories.includes(c))

export const getPlaceRecommendations = (
  tripId: string,
  { categories, pace }: RecommendationRequest,
  ownerToken: string,
) => {
  const params = new URLSearchParams({
    categories: normalizeCategories(categories).join(','),
    pace,
  })
  return apiFetch<PlaceRecommendations>(
    `/trips/${encodeURIComponent(tripId)}/recommendations/places?${params.toString()}`,
    { ownerToken },
  )
}

/** request가 null이면 부르지 않는다 ("추천 받기"를 누르기 전) */
export function usePlaceRecommendations(
  tripId: string,
  request: RecommendationRequest | null,
) {
  const token = useOwnerTokens((s) => s.tokens[tripId])
  return useQuery({
    queryKey: queryKeys.placeRecommendations(
      tripId,
      normalizeCategories(request?.categories ?? []),
      request?.pace ?? null,
    ),
    queryFn: () =>
      getPlaceRecommendations(tripId, request as RecommendationRequest, token),
    enabled: !!token && !!request,
    // 일정에 넣을 때마다 목록이 바뀌면 고르기 어렵다. 다시 받기는 버튼으로만 한다
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })
}
