import { useQuery } from '@tanstack/react-query'
import { useOwnerTokens } from '@/stores/ownerTokens'
import { apiFetch } from './client'
import { queryKeys } from './queryKeys'

export const IMMIGRATION_OPTIONS = [30, 60, 90] as const
export type ImmigrationMin = (typeof IMMIGRATION_OPTIONS)[number]

export type TransferMode = 'RAIL' | 'SUBWAY' | 'BUS' | 'TAXI' | 'RIDE_HAILING'

/** 시간표 없이 바로 타는 수단 (24시간, 요금 범위) */
export const isOnDemandMode = (mode: TransferMode) =>
  mode === 'TAXI' || mode === 'RIDE_HAILING'

/** 고정 요금은 amount, 택시처럼 범위 요금은 min/max. 없는 키는 응답에서 빠진다 */
export interface Fare {
  amount?: number
  min?: number
  max?: number
  currency: string
  display: string
}

export interface ArrivalDeparture {
  departAt: string
  arriveAreaAt: string
  status: 'AVAILABLE' | 'HARD_TO_CATCH'
  recommended: boolean
}

export interface ArrivalOption {
  routeId: number
  mode: TransferMode
  name: string
  from: string | null
  to: string | null
  durationMin: number
  walkAfterMin: number
  fare: Fare | null
  boardingTip: string | null
  is24h: boolean
  departures: ArrivalDeparture[]
  nextFirstDeparture: string | null
  dataAsOf: string
  source: 'SEED'
  note: string | null
}

/** 시각은 모두 도착 공항 timezone 오프셋을 가진 ISO */
export interface ArrivalTransfers {
  baseTime: string
  windowStart: string
  windowEnd: string
  readyAt: string
  timezone: string
  noTransitWarning: boolean
  options: ArrivalOption[]
}

export const getArrivalTransfers = (
  tripId: string,
  immigrationMin: ImmigrationMin,
  ownerToken: string,
) => {
  const params = new URLSearchParams({ immigrationMin: String(immigrationMin) })
  return apiFetch<ArrivalTransfers>(
    `/trips/${encodeURIComponent(tripId)}/transfers/arrival?${params.toString()}`,
    { ownerToken },
  )
}

export function useArrivalTransfers(
  tripId: string | undefined,
  immigrationMin: ImmigrationMin,
) {
  const token = useOwnerTokens((s) => (tripId ? s.tokens[tripId] : undefined))
  return useQuery({
    queryKey: queryKeys.arrivalTransfers(tripId ?? '', immigrationMin),
    queryFn: () =>
      getArrivalTransfers(tripId as string, immigrationMin, token as string),
    enabled: !!tripId && !!token,
    // 입국 소요 시간을 바꿔도 이전 결과를 보여 스켈레톤이 깜빡이지 않게 한다. 다른 여행의 결과는 쓰지 않는다
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === tripId ? previous : undefined,
    retry: false,
  })
}
