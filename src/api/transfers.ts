import { useQuery } from '@tanstack/react-query'
import { useOwnerTokens } from '@/stores/ownerTokens'
import { apiFetch } from './client'
import { queryKeys } from './queryKeys'

export const IMMIGRATION_OPTIONS = [30, 60, 90] as const
export type ImmigrationMin = (typeof IMMIGRATION_OPTIONS)[number]

export const AIRPORT_BUFFER_OPTIONS = [120, 150, 180] as const
export type AirportBufferMin = (typeof AIRPORT_BUFFER_OPTIONS)[number]

export type TransferMode = 'RAIL' | 'SUBWAY' | 'BUS' | 'TAXI' | 'RIDE_HAILING'

/** 시간표 없이 바로 타는 수단 (24시간, 요금 범위) */
export const isOnDemandMode = (mode: TransferMode) =>
  mode === 'TAXI' || mode === 'RIDE_HAILING'

/** 대중교통을 탈 수 없을 때 택시·차량 호출을 먼저 보여준다 (서버는 맨 뒤에 둔다) */
export const onDemandFirst = <T extends { mode: TransferMode }>(
  options: T[],
) => [
  ...options.filter((o) => isOnDemandMode(o.mode)),
  ...options.filter((o) => !isOnDemandMode(o.mode)),
]

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

/** 도착일·귀국일 카드에 공통으로 보이는 노선 정보 */
export interface TransferRoute {
  routeId: number
  mode: TransferMode
  name: string
  from: string | null
  to: string | null
  durationMin: number
  fare: Fare | null
  boardingTip: string | null
  is24h: boolean
  dataAsOf: string
  source: 'SEED'
  note: string | null
}

export interface ArrivalOption extends TransferRoute {
  walkAfterMin: number
  departures: ArrivalDeparture[]
  nextFirstDeparture: string | null
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

/** outsideWindow는 조회 범위에 편이 없어 더 일찍 도착하는 마지막 편을 돌려줬다는 뜻이다 (label은 항상 LATEST) */
export interface ReturnDeparture {
  leaveAreaAt: string
  departAt: string
  arriveAirportAt: string
  label: 'LATEST' | 'SAFER' | null
  outsideWindow: boolean
}

export interface DepartureOption extends TransferRoute {
  walkBeforeMin: number
  departures: ReturnDeparture[]
  /** 시간표 없이 바로 타는 수단만 값이 있다. 착륙 전이라 탈 수 없으면 null */
  leaveByAt: string | null
}

/** 시각은 모두 출발 공항 timezone 오프셋을 가진 ISO */
export interface DepartureTransfers {
  /** 지연이 있으면 더 이른 원래 시각. 지연은 줄어들 수 있어 이 시각으로 계산한다 */
  flightDepartureAt: string
  /** 지연이 기록된 경우에만 값이 있다 */
  revisedDepartureAt: string | null
  /** leaveAreaAt = departAt - 도보 - 이 값 */
  boardingMarginMin: number
  airportDeadline: string
  windowStart: string
  timezone: string
  firstTrainTooLate: boolean
  /** 착륙 후에 숙소에서 출발해 마감을 지킬 수단이 하나도 없다 */
  noTimeAfterLanding: boolean
  latestLeaveAt: string | null
  options: DepartureOption[]
}

export const getDepartureTransfers = (
  tripId: string,
  airportBufferMin: AirportBufferMin,
  ownerToken: string,
) => {
  const params = new URLSearchParams({
    airportBufferMin: String(airportBufferMin),
  })
  return apiFetch<DepartureTransfers>(
    `/trips/${encodeURIComponent(tripId)}/transfers/departure?${params.toString()}`,
    { ownerToken },
  )
}

export function useDepartureTransfers(
  tripId: string | undefined,
  airportBufferMin: AirportBufferMin,
) {
  const token = useOwnerTokens((s) => (tripId ? s.tokens[tripId] : undefined))
  return useQuery({
    queryKey: queryKeys.departureTransfers(tripId ?? '', airportBufferMin),
    queryFn: () =>
      getDepartureTransfers(
        tripId as string,
        airportBufferMin,
        token as string,
      ),
    enabled: !!tripId && !!token,
    // 이전 여유 시간의 "늦어도" 시각이 읽히면 안 되므로 placeholderData를 쓰지 않는다
    retry: false,
  })
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
