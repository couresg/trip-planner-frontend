import { http, HttpResponse } from 'msw'
import type { Area, City, DayOfWeek, Place } from '@/api/catalog'
import {
  effectiveTime,
  isValidFlightNo,
  normalizeFlightNo,
} from '@/api/flights'
import type { FlightLeg, FlightPoint } from '@/api/flights'
import type {
  Itinerary,
  ItineraryPlace,
  ItineraryWarning,
} from '@/api/itinerary'
import { isOnDemandMode } from '@/api/transfers'
import type {
  ArrivalDeparture,
  ArrivalOption,
  ArrivalTransfers,
  DepartureOption,
  DepartureTransfers,
  FlightCheck,
  ReturnDeparture,
} from '@/api/transfers'
import type {
  CreateTripRequest,
  FlightSource,
  TripDetail,
  TripSummary,
} from '@/api/trips'

const osaka: City = {
  code: 'OSA',
  nameKo: '오사카',
  country: 'JP',
  timezone: 'Asia/Tokyo',
  airports: [{ iata: 'KIX', nameKo: '간사이 국제공항' }],
}

const osakaAreas: Area[] = [
  {
    id: 11,
    nameKo: '난바',
    lat: 34.6664,
    lng: 135.5011,
    description: '도톤보리·신사이바시 인접',
  },
  {
    id: 12,
    nameKo: '우메다',
    lat: 34.7055,
    lng: 135.4983,
    description: '오사카역·대형 쇼핑 지구',
  },
  {
    id: 13,
    nameKo: '신오사카',
    lat: 34.7335,
    lng: 135.5003,
    description: '신칸센 환승 거점',
  },
  {
    id: 14,
    nameKo: '텐노지',
    lat: 34.6466,
    lng: 135.5135,
    description: '텐노지 공원·아베노 하루카스',
  },
]

const osakaPlaces: Place[] = [
  {
    id: 501,
    nameKo: '오사카성',
    category: 'SIGHT',
    lat: 34.6873,
    lng: 135.5262,
    openingHours: [{ dayOfWeek: 'MON', open: '09:00', close: '17:00' }],
    alwaysOpen: false,
    durationMin: 90,
    summary: '천수각 전망대와 넓은 공원',
  },
  {
    id: 520,
    nameKo: '도톤보리',
    category: 'FOOD',
    lat: 34.6687,
    lng: 135.5013,
    openingHours: [],
    alwaysOpen: true,
    durationMin: 120,
    summary: '타코야키와 먹거리 거리',
  },
  {
    id: 530,
    nameKo: '우메다 스카이빌딩',
    category: 'NIGHT',
    lat: 34.7053,
    lng: 135.4906,
    openingHours: [{ dayOfWeek: 'TUE', open: '09:30', close: '22:30' }],
    alwaysOpen: false,
    durationMin: 60,
    summary: '공중정원 전망대 야경',
  },
]

const unknownCity = (cityCode: string) =>
  HttpResponse.json(
    {
      title: 'Not Found',
      status: 404,
      detail: `Unknown city: ${cityCode}`,
      code: 'CITY_NOT_FOUND',
    },
    { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
  )

const problem = (status: number, title: string, detail: string, code: string) =>
  HttpResponse.json(
    { title, status, detail, code },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// 모든 시각은 요청한 날짜 기준 +09:00 (ICN/KIX/FUK 모두 동일 오프셋)
const at = (date: string, time: string, dayOffset = 0) =>
  `${addDays(date, dayOffset)}T${time}:00+09:00`

const point = (
  iata: string,
  scheduled: string,
  revised: string | null = null,
  terminal: string | null = null,
): FlightPoint => ({ iata, scheduled, revised, terminal })

const flightsFor = (flightNo: string, date: string): FlightLeg[] | null => {
  switch (flightNo) {
    case 'KE723':
      return [
        {
          departure: point('ICN', at(date, '12:00'), null, '2'),
          arrival: point('KIX', at(date, '13:45'), at(date, '13:52'), '1'),
          status: 'Expected',
        },
      ]
    case '7C1302':
      return [
        {
          departure: point('ICN', at(date, '22:30'), null, '1'),
          arrival: point('KIX', at(date, '00:20', 1), null, '1'),
          status: 'Expected',
        },
      ]
    case 'OZ112':
      return [
        {
          departure: point('ICN', at(date, '09:00'), at(date, '10:30'), '1'),
          arrival: point('KIX', at(date, '10:50'), at(date, '12:20'), '1'),
          status: 'Delayed',
        },
      ]
    case 'LJ231':
      return [
        {
          departure: point('ICN', at(date, '07:00'), null, '1'),
          arrival: point('KIX', at(date, '08:45'), null, null),
          status: 'Canceled',
        },
      ]
    case 'TW9901':
      return [
        {
          departure: point('ICN', at(date, '08:00'), null, '1'),
          arrival: point('FUK', at(date, '09:20'), null, 'I'),
          status: 'Expected',
        },
        {
          departure: point('FUK', at(date, '10:30'), null, null),
          arrival: point('KIX', at(date, '11:40'), null, '1'),
          status: 'Expected',
        },
      ]
    case 'KE724':
      return [
        {
          departure: point('KIX', at(date, '15:00'), null, '1'),
          arrival: point('ICN', at(date, '16:50'), null, '2'),
          status: 'Expected',
        },
      ]
    case 'LJ232':
      return [
        {
          departure: point('KIX', at(date, '10:00'), null, '1'),
          arrival: point('ICN', at(date, '11:50'), null, '1'),
          status: 'Canceled',
        },
      ]
    case 'LJ233':
      return [
        {
          departure: point('KIX', at(date, '10:00'), null, '1'),
          arrival: point('ICN', at(date, '11:50'), null, '1'),
          status: 'CanceledUncertain',
        },
      ]
    case 'OZ113':
      return [
        {
          departure: point('KIX', at(date, '15:00'), at(date, '16:30'), '1'),
          arrival: point('ICN', at(date, '16:50'), at(date, '18:20'), '1'),
          status: 'Delayed',
        },
      ]
    default:
      return null
  }
}

// 항공 API 장애(503)를 재현하는 편명
const PROVIDER_DOWN_FLIGHT = 'XX503'

const providerDown = () =>
  problem(
    503,
    'Service Unavailable',
    'Flight provider unavailable',
    'FLIGHT_PROVIDER_UNAVAILABLE',
  )

interface StoredTrip {
  ownerToken: string
  /** 여행 상세에는 지연 반영 시각만 있어 귀국일 계산용 원래 시각을 따로 둔다 */
  returnScheduledAt: string
  /** 가는 편 예정 도착 (상세의 arrivalAt은 지연 반영 시각) */
  outboundScheduledAt: string
  /** 목업은 생성 때 항공편을 조회한 것으로 보고 이 시각을 마지막 확인 시각으로 쓴다 */
  createdAt: string
  detail: TripDetail
}

interface MockFlightInfo {
  scheduledAt: string
  flightStatus: string
  flightCheck: FlightCheck
}

/** 목업은 재조회하지 않는다. 조회한 편은 생성 때 확인한 것(REFRESHED)으로, 수동 입력 편은 MANUAL로 준다 */
const flightInfo = (
  trip: StoredTrip,
  direction: 'outbound' | 'return',
): MockFlightInfo => {
  const flight = trip.detail[direction]
  return {
    scheduledAt:
      direction === 'outbound'
        ? trip.outboundScheduledAt
        : trip.returnScheduledAt,
    flightStatus: flight.status ?? 'Unknown',
    flightCheck: {
      result: flight.source === 'MANUAL' ? 'MANUAL' : 'REFRESHED',
      checkedAt: trip.createdAt,
    },
  }
}

const trips = new Map<string, StoredTrip>()

interface StoredItem {
  itemId: number
  date: string
  plannedTime: string | null
  memo: string
  place: Place
}

/** 여행별 일정 항목. 배열 순서가 곧 날짜 안 순서다 */
const itineraryItems = new Map<string, StoredItem[]>()
let nextItemId = 9001

export const resetTrips = () => {
  trips.clear()
  itineraryItems.clear()
}

const tokensOf = (request: Request) =>
  (request.headers.get('X-Owner-Token') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

const findOwnedTrip = (request: Request, tripId: string) => {
  const trip = trips.get(tripId)
  if (!trip)
    return problem(
      404,
      'Not Found',
      `Trip not found: ${tripId}`,
      'TRIP_NOT_FOUND',
    )
  if (!tokensOf(request).includes(trip.ownerToken))
    return problem(403, 'Forbidden', 'Owner token mismatch', 'FORBIDDEN_TRIP')
  return trip
}

const mismatch = (airport: string) =>
  problem(
    400,
    'Bad Request',
    `선택한 여행 도시(${osaka.nameKo})와 공항(${airport})이 다릅니다.`,
    'CITY_AIRPORT_MISMATCH',
  )

const isCityAirport = (iata: string) =>
  osaka.airports.some((a) => a.iata === iata)

type Resolved = {
  airport: string
  at: string
  scheduled: string
  source: FlightSource
  status: string | null
}

const resolveFlight = (
  flightNo: string,
  date: string,
  direction: 'outbound' | 'return',
  manualAt: string | undefined,
  manualAirport: string | undefined,
): Resolved | Response => {
  if (manualAt && manualAirport) {
    if (!isCityAirport(manualAirport)) return mismatch(manualAirport)
    return {
      airport: manualAirport,
      at: manualAt,
      scheduled: manualAt,
      source: 'MANUAL',
      status: 'Manual',
    }
  }
  if (flightNo === PROVIDER_DOWN_FLIGHT) return providerDown()
  const legs = flightsFor(flightNo, date)
  if (!legs)
    return problem(
      404,
      'Not Found',
      `Flight not found: ${flightNo}`,
      'FLIGHT_NOT_FOUND',
    )
  const point = (leg: FlightLeg) =>
    direction === 'outbound' ? leg.arrival : leg.departure
  const leg = legs.find((l) => isCityAirport(point(l).iata))
  if (!leg) return mismatch(point(legs[legs.length - 1]).iata)
  return {
    airport: point(leg).iata,
    at: effectiveTime(point(leg)),
    scheduled: point(leg).scheduled,
    source: 'AERODATABOX',
    status: leg.status,
  }
}

const MIN_MS = 60_000
const DAY_MS = 86_400_000
// 목업 공항(KIX)은 Asia/Tokyo 고정 +09:00 (서머타임 없음)
const JST_OFFSET_MS = 9 * 60 * MIN_MS

const toJstIso = (ms: number) =>
  `${new Date(ms + JST_OFFSET_MS).toISOString().slice(0, 19)}+09:00`

/** first~last(현지 자정 기준 분) 사이 step분 간격 */
const everyMinutes = (first: number, last: number, step: number) => {
  const times: number[] = []
  for (let t = first; t <= last; t += step) times.push(t)
  return times
}

interface SeedRoute extends Omit<
  ArrivalOption,
  'departures' | 'nextFirstDeparture' | 'is24h' | 'dataAsOf' | 'source'
> {
  /** 시간표 수단만. 현지 자정 기준 분 (시드는 평일·토요일·휴일 시각이 같다) */
  timetable?: number[]
}

// V100__seed_catalog_osaka.sql 의 간사이공항 → 난바(area 11) 노선
const arrivalRoutes: SeedRoute[] = [
  {
    routeId: 101,
    mode: 'RAIL',
    name: '난카이 라피트',
    from: '간사이공항역',
    to: '난바역',
    durationMin: 38,
    walkAfterMin: 5,
    fare: { amount: 1490, currency: 'JPY', display: '¥1,490' },
    boardingTip: '제1터미널 2층 연결통로 → 에어로플라자 → 난카이선 개찰구',
    note: '추정: 시각표(매시 05·35분)와 요금은 공식 시간표로 검증 필요',
    // TIMETABLE 06:35 ~ 23:05, 30분 간격
    timetable: everyMinutes(395, 1385, 30),
  },
  {
    routeId: 102,
    mode: 'RAIL',
    name: '난카이 공항급행',
    from: '간사이공항역',
    to: '난바역',
    durationMin: 45,
    walkAfterMin: 5,
    fare: { amount: 970, currency: 'JPY', display: '¥970' },
    boardingTip: '제1터미널 2층 연결통로 → 난카이선 개찰구',
    note: '추정: 첫차·막차·배차간격·요금은 공식 시간표로 검증 필요',
    // HEADWAY 05:45 ~ 23:35, 30분 간격
    timetable: everyMinutes(345, 1415, 30),
  },
  {
    routeId: 108,
    mode: 'TAXI',
    name: '택시',
    from: '제1터미널 1층 택시 승강장',
    to: '난바',
    durationMin: 50,
    walkAfterMin: 0,
    fare: {
      min: 17000,
      max: 20000,
      currency: 'JPY',
      display: '¥17,000~20,000',
    },
    boardingTip: '제1터미널 1층 도착 로비 밖 택시 승강장',
    note: '추정: 요금은 교통 상황·심야 할증에 따라 달라짐',
  },
]

/** 서버 규칙을 흉내 낸다: 도착 ~ +2시간 출발편, 입국 완료 전은 HARD_TO_CATCH, 이후 첫 편 추천 */
const arrivalTransfers = (
  baseTime: string,
  immigrationMin: number,
  flight: MockFlightInfo,
): ArrivalTransfers => {
  const base = Date.parse(baseTime)
  const windowEnd = base + 120 * MIN_MS
  const readyAt = base + immigrationMin * MIN_MS
  const localMidnight =
    Math.floor((base + JST_OFFSET_MS) / DAY_MS) * DAY_MS - JST_OFFSET_MS

  const options: ArrivalOption[] = arrivalRoutes.map(
    ({ timetable, ...route }) => {
      const common = { dataAsOf: '2026-10-01', source: 'SEED' as const }
      if (!timetable)
        return {
          ...route,
          ...common,
          is24h: true,
          departures: [],
          nextFirstDeparture: null,
        }
      const instants = [-1, 0, 1, 2]
        .flatMap((day) =>
          timetable.map((min) => localMidnight + day * DAY_MS + min * MIN_MS),
        )
        .sort((a, b) => a - b)
      let recommendedGiven = false
      const departures: ArrivalDeparture[] = instants
        .filter((t) => t >= base && t <= windowEnd)
        .map((t) => {
          const status = t < readyAt ? 'HARD_TO_CATCH' : 'AVAILABLE'
          const recommended = status === 'AVAILABLE' && !recommendedGiven
          if (recommended) recommendedGiven = true
          return {
            departAt: toJstIso(t),
            arriveAreaAt: toJstIso(
              t + (route.durationMin + route.walkAfterMin) * MIN_MS,
            ),
            status,
            recommended,
          }
        })
      // 조회 범위에 탈 수 있는 편이 없으면 입국 완료 이후 첫 편을 알려 준다
      const next = recommendedGiven
        ? undefined
        : instants.find((t) => t >= readyAt)
      return {
        ...route,
        ...common,
        is24h: false,
        departures,
        nextFirstDeparture: next === undefined ? null : toJstIso(next),
      }
    },
  )

  const recommendedArrival = (o: ArrivalOption) => {
    const rec = o.departures.find((d) => d.recommended)
    if (isOnDemandMode(o.mode)) return Number.MAX_SAFE_INTEGER
    return rec ? Date.parse(rec.arriveAreaAt) : Number.MAX_SAFE_INTEGER - 1
  }
  const transit = options.filter((o) => !isOnDemandMode(o.mode))
  return {
    baseTime: toJstIso(base),
    windowStart: toJstIso(base),
    windowEnd: toJstIso(windowEnd),
    readyAt: toJstIso(readyAt),
    timezone: osaka.timezone,
    // 탑승 어려움 편만 남은 노선도 운행 종료로 본다
    noTransitWarning: transit.every(
      (o) => !o.departures.some((d) => d.status === 'AVAILABLE'),
    ),
    scheduledArrivalAt: flight.scheduledAt,
    flightStatus: flight.flightStatus,
    flightCheck: flight.flightCheck,
    // sort는 안정 정렬이라 추천편이 없는 노선은 원래 순서를 유지한다
    options: [...options].sort(
      (a, b) => recommendedArrival(a) - recommendedArrival(b),
    ),
  }
}

const BOARDING_MARGIN_MIN = 10

interface SeedReturnRoute extends Omit<
  DepartureOption,
  'departures' | 'leaveByAt' | 'is24h' | 'dataAsOf' | 'source'
> {
  /** 시간표 수단만. 현지 자정 기준 분 (목업은 요일 구분 없이 같은 시각을 쓴다) */
  timetable?: number[]
}

// 난바(area 11) → 간사이공항 노선. 소요는 시드와 같고, 시각표는 실제 목록 대신 30분 간격으로 단순화했다
const departureRoutes: SeedReturnRoute[] = [
  {
    routeId: 201,
    mode: 'RAIL',
    name: '난카이 라피트',
    from: '난바역',
    to: '간사이공항역',
    durationMin: 38,
    walkBeforeMin: 5,
    fare: { amount: 1490, currency: 'JPY', display: '¥1,490' },
    boardingTip: '난카이 난바역 3층 개찰구, 라피트 전용 승강장',
    note: null,
    // 06:00 ~ 22:00
    timetable: everyMinutes(360, 1320, 30),
  },
  {
    routeId: 202,
    mode: 'RAIL',
    name: '난카이 공항급행',
    from: '난바역',
    to: '간사이공항역',
    durationMin: 45,
    walkBeforeMin: 5,
    fare: { amount: 970, currency: 'JPY', display: '¥970' },
    boardingTip: '난카이 난바역 3층 개찰구',
    note: null,
    // 05:15 ~ 22:45
    timetable: everyMinutes(315, 1365, 30),
  },
  {
    routeId: 208,
    mode: 'TAXI',
    name: '택시',
    from: '난바',
    to: '간사이공항',
    durationMin: 50,
    walkBeforeMin: 0,
    fare: {
      min: 17000,
      max: 20000,
      currency: 'JPY',
      display: '¥17,000~20,000',
    },
    boardingTip: '숙소 앞 또는 역 택시 승강장, 배차 앱 호출 가능',
    note: '추정: 요금은 교통 상황·심야 할증에 따라 달라짐',
  },
]

/**
 * 서버 규칙을 흉내 낸다. 마감 = 출발 - 여유, 공항 도착이 [마감-90분, 마감]인 편 중 마지막이 LATEST, 그 앞이 SAFER.
 * 숙소 출발 = 탑승 - 도보 - 탑승 여유. 지연이 있으면 줄어들 수 있으므로 더 이른 원래 시각을 기준으로 삼는다.
 * 범위에 편이 없는 노선은 [마감-240분, 범위 시작) 도착 중 마지막 한 편만 outsideWindow로 돌려준다.
 * 결과를 정하는 것은 오는 편 시각뿐이라 15:00(일반), 07:00(첫차 불가), 03:30(모두 범위 밖), 02:30(일부 범위 밖)으로 재현한다.
 */
const departureTransfers = (
  scheduledAt: string,
  effectiveAt: string,
  landingAt: string,
  airportBufferMin: number,
  returnFlight: MockFlightInfo,
): DepartureTransfers => {
  // 착륙 전에 숙소에서 출발해야 하는 편과 택시는 탈 수 없다
  const landing = Date.parse(landingAt)
  const scheduled = Date.parse(scheduledAt)
  const effective = Date.parse(effectiveAt)
  const flight = Math.min(scheduled, effective)
  const deadline = flight - airportBufferMin * MIN_MS
  const windowStart = deadline - 90 * MIN_MS
  const lookbackStart = deadline - 240 * MIN_MS
  const localMidnight =
    Math.floor((deadline + JST_OFFSET_MS) / DAY_MS) * DAY_MS - JST_OFFSET_MS

  const options: DepartureOption[] = departureRoutes.map(
    ({ timetable, ...route }) => {
      const common = { dataAsOf: '2026-11-03', source: 'SEED' as const }
      if (!timetable) {
        const leaveBy = deadline - route.durationMin * MIN_MS
        return {
          ...route,
          ...common,
          is24h: true,
          departures: [],
          leaveByAt: leaveBy >= landing ? toJstIso(leaveBy) : null,
        }
      }
      const arriveAt = (t: number) => t + route.durationMin * MIN_MS
      const toDeparture = (
        t: number,
        label: ReturnDeparture['label'],
        outsideWindow: boolean,
      ): ReturnDeparture => ({
        leaveAreaAt: toJstIso(
          t - (route.walkBeforeMin + BOARDING_MARGIN_MIN) * MIN_MS,
        ),
        departAt: toJstIso(t),
        arriveAirportAt: toJstIso(arriveAt(t)),
        label,
        outsideWindow,
      })
      const instants = [-1, 0]
        .flatMap((day) =>
          timetable.map((min) => localMidnight + day * DAY_MS + min * MIN_MS),
        )
        .sort((a, b) => a - b)
        .filter(
          (t) =>
            t - (route.walkBeforeMin + BOARDING_MARGIN_MIN) * MIN_MS >= landing,
        )
      const inWindow = instants.filter(
        (t) => arriveAt(t) >= windowStart && arriveAt(t) <= deadline,
      )
      const lookback = instants
        .filter(
          (t) => arriveAt(t) >= lookbackStart && arriveAt(t) < windowStart,
        )
        .slice(-1)
      const departures =
        inWindow.length > 0
          ? inWindow.map((t, i) =>
              toDeparture(
                t,
                i === inWindow.length - 1
                  ? 'LATEST'
                  : i === inWindow.length - 2
                    ? 'SAFER'
                    : null,
                false,
              ),
            )
          : lookback.map((t) => toDeparture(t, 'LATEST', true))
      return { ...route, ...common, is24h: false, departures, leaveByAt: null }
    },
  )

  const latestLeave = (o: DepartureOption) => {
    const latest = o.departures.find((d) => d.label === 'LATEST')
    return latest ? Date.parse(latest.leaveAreaAt) : null
  }
  const rank = (o: DepartureOption) =>
    isOnDemandMode(o.mode) ? 2 : latestLeave(o) === null ? 1 : 0
  const leaves = options.flatMap((o) => latestLeave(o) ?? [])
  return {
    flightDepartureAt: toJstIso(flight),
    revisedDepartureAt: effective > scheduled ? toJstIso(effective) : null,
    boardingMarginMin: BOARDING_MARGIN_MIN,
    airportDeadline: toJstIso(deadline),
    windowStart: toJstIso(windowStart),
    timezone: osaka.timezone,
    firstTrainTooLate: leaves.length === 0,
    noTimeAfterLanding:
      leaves.length === 0 && options.every((o) => o.leaveByAt === null),
    latestLeaveAt: leaves.length > 0 ? toJstIso(Math.max(...leaves)) : null,
    scheduledDepartureAt: toJstIso(scheduled),
    flightStatus: returnFlight.flightStatus,
    flightCheck: returnFlight.flightCheck,
    options: [...options].sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (latestLeave(b) ?? 0) - (latestLeave(a) ?? 0) ||
        a.routeId - b.routeId,
    ),
  }
}

/** 서버 규칙을 흉내 낸다: 추천편 중 가장 빠른 숙소 도착, 없으면 입국 완료 + 택시, 택시도 없으면 입국 완료 */
const earliestStartOf = (data: ArrivalTransfers) => {
  const arrivals = data.options.flatMap((o) =>
    o.departures
      .filter((d) => d.recommended)
      .map((d) => Date.parse(d.arriveAreaAt)),
  )
  if (arrivals.length > 0) return toJstIso(Math.min(...arrivals))
  const taxi = data.options.find((o) => isOnDemandMode(o.mode))
  const ready = Date.parse(data.readyAt)
  return toJstIso(
    taxi ? ready + (taxi.durationMin + taxi.walkAfterMin) * MIN_MS : ready,
  )
}

/** 귀국일 강조 시각. 없으면 시간표 없는 수단 중 가장 이른 출발 마감, 착륙 후 시간이 없으면 null */
const latestEndOf = (data: DepartureTransfers) => {
  if (data.noTimeAfterLanding) return null
  if (data.latestLeaveAt) return data.latestLeaveAt
  const leaveBys = data.options.flatMap((o) =>
    o.leaveByAt ? [Date.parse(o.leaveByAt)] : [],
  )
  return leaveBys.length > 0 ? toJstIso(Math.min(...leaveBys)) : null
}

const RETURN_MARGIN_MIN = 30

const WEEKDAYS: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const outsideOpeningHours = ({ date, plannedTime, place }: StoredItem) => {
  if (!plannedTime || place.alwaysOpen || place.openingHours.length === 0)
    return false
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]
  const hours = place.openingHours.find((h) => h.dayOfWeek === weekday)
  const toMinutes = (time: string) =>
    Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  return (
    !hours ||
    plannedTime < hours.open ||
    toMinutes(plannedTime) + place.durationMin > toMinutes(hours.close)
  )
}

/** 목업 시드에는 자정을 넘기는 영업시간이 없어 그 규칙은 생략한다 */
const itemWarnings = (
  item: StoredItem,
  earliest: string,
  latest: string | null,
): ItineraryWarning[] => {
  const { date, plannedTime, place } = item
  const visit = plannedTime ? Date.parse(at(date, plannedTime)) : null
  const warnings: ItineraryWarning[] = []
  if (outsideOpeningHours(item)) warnings.push('OUTSIDE_OPENING_HOURS')
  if (
    visit === null ? date < earliest.slice(0, 10) : visit < Date.parse(earliest)
  )
    warnings.push('BEFORE_ARRIVAL')
  if (
    latest &&
    (visit === null
      ? date > latest.slice(0, 10)
      : visit + (place.durationMin + RETURN_MARGIN_MIN) * MIN_MS >
        Date.parse(latest))
  )
    warnings.push('AFTER_DEPARTURE_LEAVE_TIME')
  return warnings
}

const tripDates = ({ detail }: StoredTrip) => {
  const dates: string[] = []
  for (let d = detail.startDate; d <= detail.endDate; d = addDays(d, 1))
    dates.push(d)
  return dates
}

const savedItem = (items: StoredItem[], item: StoredItem) => ({
  itemId: item.itemId,
  date: item.date,
  position: items
    .filter((i) => i.date === item.date)
    .findIndex((i) => i.itemId === item.itemId),
  plannedTime: item.plannedTime,
  memo: item.memo,
  place: toItineraryPlace(item.place),
})

const toItineraryPlace = ({
  id,
  nameKo,
  category,
  lat,
  lng,
  durationMin,
}: Place): ItineraryPlace => ({ id, nameKo, category, lat, lng, durationMin })

const itemNotFound = (itemId: string) =>
  problem(
    404,
    'Not Found',
    `Itinerary item not found: ${itemId}`,
    'ITINERARY_ITEM_NOT_FOUND',
  )

const dateOutOfTrip = (date: string) =>
  problem(400, 'Bad Request', `Date out of trip: ${date}`, 'DATE_OUT_OF_TRIP')

const itineraryHandlers = [
  http.get('*/api/v1/trips/:tripId/itinerary', ({ request, params }) => {
    const search = new URL(request.url).searchParams
    const immigrationMin = Number(search.get('immigrationMin') ?? '60')
    const airportBufferMin = Number(search.get('airportBufferMin') ?? '120')
    if (
      ![30, 60, 90].includes(immigrationMin) ||
      ![120, 150, 180].includes(airportBufferMin)
    )
      return problem(
        400,
        'Bad Request',
        'Invalid transfer settings',
        'VALIDATION_FAILED',
      )
    const tripId = String(params.tripId)
    const trip = findOwnedTrip(request, tripId)
    if (trip instanceof Response) return trip
    const earliest = earliestStartOf(
      arrivalTransfers(
        trip.detail.outbound.arrivalAt,
        immigrationMin,
        flightInfo(trip, 'outbound'),
      ),
    )
    const latest = latestEndOf(
      departureTransfers(
        trip.returnScheduledAt,
        trip.detail.return.departureAt,
        trip.detail.outbound.arrivalAt,
        airportBufferMin,
        flightInfo(trip, 'return'),
      ),
    )
    const stored = itineraryItems.get(tripId) ?? []
    const itinerary: Itinerary = {
      timezone: trip.detail.city.timezone,
      returnMarginMin: RETURN_MARGIN_MIN,
      days: tripDates(trip).map((date, index) => ({
        date,
        dayIndex: index + 1,
        earliestStart: earliest.slice(0, 10) === date ? earliest : null,
        latestEnd: latest?.slice(0, 10) === date ? latest : null,
        items: stored
          .filter((item) => item.date === date)
          .map((item, position) => ({
            itemId: item.itemId,
            position,
            plannedTime: item.plannedTime,
            memo: item.memo,
            place: toItineraryPlace(item.place),
            warnings: itemWarnings(item, earliest, latest),
          })),
      })),
    }
    return HttpResponse.json(itinerary)
  }),
  http.post(
    '*/api/v1/trips/:tripId/itinerary/items',
    async ({ request, params }) => {
      const tripId = String(params.tripId)
      const trip = findOwnedTrip(request, tripId)
      if (trip instanceof Response) return trip
      const body = (await request.json()) as {
        placeId: number
        date: string
        plannedTime: string | null
        memo?: string
      }
      if (!tripDates(trip).includes(body.date)) return dateOutOfTrip(body.date)
      const place = osakaPlaces.find((p) => p.id === body.placeId)
      if (!place)
        return problem(
          404,
          'Not Found',
          `Place not found: ${body.placeId}`,
          'PLACE_NOT_FOUND',
        )
      const item: StoredItem = {
        itemId: nextItemId++,
        date: body.date,
        plannedTime: body.plannedTime,
        memo: body.memo ?? '',
        place,
      }
      const items = [...(itineraryItems.get(tripId) ?? []), item]
      itineraryItems.set(tripId, items)
      return HttpResponse.json(savedItem(items, item), { status: 201 })
    },
  ),
  http.patch(
    '*/api/v1/trips/:tripId/itinerary/items/:itemId',
    async ({ request, params }) => {
      const tripId = String(params.tripId)
      const trip = findOwnedTrip(request, tripId)
      if (trip instanceof Response) return trip
      const items = itineraryItems.get(tripId) ?? []
      const item = items.find((i) => i.itemId === Number(params.itemId))
      if (!item) return itemNotFound(String(params.itemId))
      const body = (await request.json()) as {
        plannedTime: string | null
        memo: string
      }
      item.plannedTime = body.plannedTime ?? null
      item.memo = body.memo
      return HttpResponse.json(savedItem(items, item))
    },
  ),
  http.put(
    '*/api/v1/trips/:tripId/itinerary/days/:date/order',
    async ({ request, params }) => {
      const tripId = String(params.tripId)
      const trip = findOwnedTrip(request, tripId)
      if (trip instanceof Response) return trip
      const date = String(params.date)
      if (!tripDates(trip).includes(date)) return dateOutOfTrip(date)
      const { itemIds } = (await request.json()) as { itemIds: number[] }
      if (new Set(itemIds).size !== itemIds.length || itemIds.length > 200)
        return problem(
          400,
          'Bad Request',
          'Invalid itemIds',
          'VALIDATION_FAILED',
        )
      const items = itineraryItems.get(tripId) ?? []
      const missing = itemIds.find((id) => !items.some((i) => i.itemId === id))
      if (missing !== undefined) return itemNotFound(String(missing))
      const listed = itemIds.map((id) => ({
        ...(items.find((i) => i.itemId === id) as StoredItem),
        date,
      }))
      itineraryItems.set(tripId, [
        ...listed,
        ...items.filter((i) => !itemIds.includes(i.itemId)),
      ])
      return new HttpResponse(null, { status: 204 })
    },
  ),
  http.delete(
    '*/api/v1/trips/:tripId/itinerary/items/:itemId',
    ({ request, params }) => {
      const tripId = String(params.tripId)
      const trip = findOwnedTrip(request, tripId)
      if (trip instanceof Response) return trip
      const items = itineraryItems.get(tripId) ?? []
      if (!items.some((i) => i.itemId === Number(params.itemId)))
        return itemNotFound(String(params.itemId))
      itineraryItems.set(
        tripId,
        items.filter((i) => i.itemId !== Number(params.itemId)),
      )
      return new HttpResponse(null, { status: 204 })
    },
  ),
]

const tripHandlers = [
  ...itineraryHandlers,
  http.post('*/api/v1/trips', async ({ request }) => {
    const body = (await request.json()) as CreateTripRequest
    const outboundNo = normalizeFlightNo(body.outboundFlightNo ?? '')
    const returnNo = normalizeFlightNo(body.returnFlightNo ?? '')
    if (!isValidFlightNo(outboundNo) || !isValidFlightNo(returnNo))
      return problem(
        400,
        'Bad Request',
        'Invalid flight number',
        'INVALID_FLIGHT_NO',
      )
    if (body.cityCode !== osaka.code) return unknownCity(body.cityCode)
    const area = osakaAreas.find((a) => a.id === body.areaId)
    if (!area)
      return problem(400, 'Bad Request', 'Unknown area', 'VALIDATION_FAILED')
    const days =
      (Date.parse(body.endDate) - Date.parse(body.startDate)) / 86_400_000
    if (!(days >= 0 && days <= 30))
      return problem(
        400,
        'Bad Request',
        'Invalid date range',
        'INVALID_DATE_RANGE',
      )
    const manual = body.manualOverride ?? {}
    const outbound = resolveFlight(
      outboundNo,
      body.startDate,
      'outbound',
      manual.outboundArrivalAt,
      manual.outboundArrivalAirport,
    )
    if (outbound instanceof Response) return outbound
    const ret = resolveFlight(
      returnNo,
      body.endDate,
      'return',
      manual.returnDepartureAt,
      manual.returnDepartureAirport,
    )
    if (ret instanceof Response) return ret

    const tripId = crypto.randomUUID()
    const ownerToken = crypto.randomUUID()
    trips.set(tripId, {
      ownerToken,
      returnScheduledAt: ret.scheduled,
      outboundScheduledAt: outbound.scheduled,
      createdAt: toJstIso(Date.now()),
      detail: {
        tripId,
        city: {
          code: osaka.code,
          nameKo: osaka.nameKo,
          timezone: osaka.timezone,
        },
        area: {
          id: area.id,
          nameKo: area.nameKo,
          lat: area.lat,
          lng: area.lng,
        },
        startDate: body.startDate,
        endDate: body.endDate,
        outbound: {
          flightNo: outboundNo,
          arrivalAirport: outbound.airport,
          arrivalAt: outbound.at,
          source: outbound.source,
          status: outbound.status,
        },
        return: {
          flightNo: returnNo,
          departureAirport: ret.airport,
          departureAt: ret.at,
          source: ret.source,
          status: ret.status,
        },
      },
    })
    return HttpResponse.json({ tripId, ownerToken }, { status: 201 })
  }),
  http.get('*/api/v1/trips', ({ request }) => {
    const tokens = tokensOf(request)
    const summaries: TripSummary[] = [...trips.values()]
      .filter((t) => tokens.includes(t.ownerToken))
      .map(({ detail: d }) => ({
        tripId: d.tripId,
        city: { code: d.city.code, nameKo: d.city.nameKo },
        area: { id: d.area.id, nameKo: d.area.nameKo },
        startDate: d.startDate,
        endDate: d.endDate,
        outboundFlightNo: d.outbound.flightNo,
        returnFlightNo: d.return.flightNo,
      }))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
    return HttpResponse.json(summaries)
  }),
  http.get('*/api/v1/trips/:tripId', ({ request, params }) => {
    const trip = findOwnedTrip(request, String(params.tripId))
    return trip instanceof Response ? trip : HttpResponse.json(trip.detail)
  }),
  http.get(
    '*/api/v1/trips/:tripId/transfers/arrival',
    ({ request, params }) => {
      const immigrationMin = Number(
        new URL(request.url).searchParams.get('immigrationMin') ?? '60',
      )
      if (![30, 60, 90].includes(immigrationMin))
        return problem(
          400,
          'Bad Request',
          'immigrationMin must be 30, 60 or 90',
          'VALIDATION_FAILED',
        )
      const trip = findOwnedTrip(request, String(params.tripId))
      if (trip instanceof Response) return trip
      return HttpResponse.json(
        arrivalTransfers(
          trip.detail.outbound.arrivalAt,
          immigrationMin,
          flightInfo(trip, 'outbound'),
        ),
      )
    },
  ),
  http.get(
    '*/api/v1/trips/:tripId/transfers/departure',
    ({ request, params }) => {
      const airportBufferMin = Number(
        new URL(request.url).searchParams.get('airportBufferMin') ?? '120',
      )
      if (![120, 150, 180].includes(airportBufferMin))
        return problem(
          400,
          'Bad Request',
          'airportBufferMin must be 120, 150 or 180',
          'VALIDATION_FAILED',
        )
      const trip = findOwnedTrip(request, String(params.tripId))
      if (trip instanceof Response) return trip
      return HttpResponse.json(
        departureTransfers(
          trip.returnScheduledAt,
          trip.detail.return.departureAt,
          trip.detail.outbound.arrivalAt,
          airportBufferMin,
          flightInfo(trip, 'return'),
        ),
      )
    },
  ),
  http.delete('*/api/v1/trips/:tripId', ({ request, params }) => {
    const trip = findOwnedTrip(request, String(params.tripId))
    if (trip instanceof Response) return trip
    trips.delete(String(params.tripId))
    itineraryItems.delete(String(params.tripId))
    return new HttpResponse(null, { status: 204 })
  }),
]

export const handlers = [
  ...tripHandlers,
  http.get('*/api/v1/flights/lookup', ({ request }) => {
    const url = new URL(request.url)
    const flightNo = normalizeFlightNo(url.searchParams.get('flightNo') ?? '')
    const date = url.searchParams.get('date') ?? ''
    if (!isValidFlightNo(flightNo))
      return problem(
        400,
        'Bad Request',
        `Invalid flight number: ${flightNo}`,
        'INVALID_FLIGHT_NO',
      )
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      return problem(
        400,
        'Bad Request',
        `Invalid date: ${date}`,
        'VALIDATION_FAILED',
      )
    if (flightNo === PROVIDER_DOWN_FLIGHT) return providerDown()
    const legs = flightsFor(flightNo, date)
    return legs
      ? HttpResponse.json({ flightNo, legs })
      : problem(
          404,
          'Not Found',
          `Flight not found: ${flightNo}`,
          'FLIGHT_NOT_FOUND',
        )
  }),
  http.get('*/api/v1/health', () => HttpResponse.json({ status: 'UP' })),
  http.get('*/api/v1/cities', () => HttpResponse.json([osaka])),
  http.get('*/api/v1/cities/:cityCode/areas', ({ params }) =>
    params.cityCode === osaka.code
      ? HttpResponse.json(osakaAreas)
      : unknownCity(String(params.cityCode)),
  ),
  http.get('*/api/v1/cities/:cityCode/places', ({ params, request }) => {
    if (params.cityCode !== osaka.code)
      return unknownCity(String(params.cityCode))
    const url = new URL(request.url)
    const category = url.searchParams.get('category')
    const q = url.searchParams.get('q')
    return HttpResponse.json(
      osakaPlaces.filter(
        (p) =>
          (!category || p.category === category) &&
          (!q || p.nameKo.includes(q)),
      ),
    )
  }),
]
