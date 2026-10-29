import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOwnerTokens } from '@/stores/ownerTokens'
import { ApiError, apiFetch } from './client'
import { queryKeys } from './queryKeys'

/** 각 방향 쌍은 독립적으로 생략 가능. 시각은 공항/도시 timezone 오프셋을 가진 ISO */
export interface ManualOverride {
  outboundArrivalAt?: string
  outboundArrivalAirport?: string
  returnDepartureAt?: string
  returnDepartureAirport?: string
}

export interface CreateTripRequest {
  outboundFlightNo: string
  returnFlightNo: string
  cityCode: string
  areaId: number
  startDate: string
  endDate: string
  manualOverride: ManualOverride | null
}

export interface CreateTripResponse {
  tripId: string
  ownerToken: string
}

export interface TripSummary {
  tripId: string
  city: { code: string; nameKo: string }
  area: { id: number; nameKo: string }
  startDate: string
  endDate: string
  outboundFlightNo: string
  returnFlightNo: string
}

export type FlightSource = 'AERODATABOX' | 'MANUAL'

export interface TripDetail {
  tripId: string
  city: { code: string; nameKo: string; timezone: string }
  area: { id: number; nameKo: string; lat: number; lng: number }
  startDate: string
  endDate: string
  outbound: {
    flightNo: string
    arrivalAirport: string
    arrivalAt: string
    source: FlightSource
    status: string | null
  }
  return: {
    flightNo: string
    departureAirport: string
    departureAt: string
    source: FlightSource
    status: string | null
  }
}

export const createTrip = (body: CreateTripRequest) =>
  apiFetch<CreateTripResponse>('/trips', { method: 'POST', body })

export const listTrips = (ownerTokens: string[]) =>
  apiFetch<TripSummary[]>('/trips', { ownerToken: ownerTokens })

export const getTrip = (tripId: string, ownerToken: string) =>
  apiFetch<TripDetail>(`/trips/${encodeURIComponent(tripId)}`, { ownerToken })

export const deleteTrip = (tripId: string, ownerToken: string) =>
  apiFetch<void>(`/trips/${encodeURIComponent(tripId)}`, {
    method: 'DELETE',
    ownerToken,
  })

export function useCreateTrip() {
  const queryClient = useQueryClient()
  const setToken = useOwnerTokens((s) => s.setToken)
  return useMutation({
    mutationFn: createTrip,
    onSuccess: ({ tripId, ownerToken }) => {
      setToken(tripId, ownerToken)
      return queryClient.invalidateQueries({ queryKey: queryKeys.trips })
    },
  })
}

/** 백엔드가 한 요청에서 받는 X-Owner-Token 최대 개수 */
export const MAX_TOKENS_PER_REQUEST = 50

/** 토큰을 50개씩 나눠 조회해 합친다. 모두 성공하면 결과에 없는 tripId의 토큰은 지운다(삭제·만료된 여행). */
async function listOwnedTrips(tokens: Record<string, string>) {
  const tripIds = Object.keys(tokens)
  if (tripIds.length === 0) return []
  const batches: string[][] = []
  for (let i = 0; i < tripIds.length; i += MAX_TOKENS_PER_REQUEST)
    batches.push(
      tripIds.slice(i, i + MAX_TOKENS_PER_REQUEST).map((id) => tokens[id]),
    )
  const trips = (await Promise.all(batches.map(listTrips)))
    .flat()
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  const alive = new Set(trips.map((t) => t.tripId))
  const dead = tripIds.filter((id) => !alive.has(id))
  if (dead.length > 0) useOwnerTokens.getState().removeTokens(dead)
  return trips
}

export function useTrips() {
  const tokens = useOwnerTokens((s) => s.tokens)
  return useQuery({
    queryKey: queryKeys.tripList(Object.keys(tokens).sort()),
    queryFn: () => listOwnedTrips(tokens),
    retry: false,
  })
}

export function useTrip(tripId: string | undefined) {
  const token = useOwnerTokens((s) => (tripId ? s.tokens[tripId] : undefined))
  return useQuery({
    queryKey: queryKeys.trip(tripId ?? ''),
    queryFn: async () => {
      try {
        return await getTrip(tripId as string, token as string)
      } catch (error) {
        // 삭제된 여행의 토큰은 더 쓸 데가 없다
        if (error instanceof ApiError && error.code === 'TRIP_NOT_FOUND')
          useOwnerTokens.getState().removeToken(tripId as string)
        throw error
      }
    },
    enabled: !!tripId && !!token,
    retry: false,
  })
}

/** beforeCleanup(예: 홈으로 이동)이 끝난 뒤에 토큰과 캐시를 지워 상세 화면에 '토큰 없음'이 잠깐 보이지 않게 한다 */
export function useDeleteTrip(beforeCleanup?: () => unknown) {
  const queryClient = useQueryClient()
  const removeToken = useOwnerTokens((s) => s.removeToken)
  return useMutation({
    mutationFn: ({
      tripId,
      ownerToken,
    }: {
      tripId: string
      ownerToken: string
    }) => deleteTrip(tripId, ownerToken),
    onSuccess: async (_data, { tripId }) => {
      await beforeCleanup?.()
      removeToken(tripId)
      queryClient.removeQueries({ queryKey: queryKeys.trip(tripId) })
    },
  })
}
