import { http, HttpResponse } from 'msw'
import type { Area, City, Place } from '@/api/catalog'
import {
  effectiveTime,
  isValidFlightNo,
  normalizeFlightNo,
} from '@/api/flights'
import type { FlightLeg, FlightPoint } from '@/api/flights'
import { isOnDemandMode } from '@/api/transfers'
import type {
  ArrivalDeparture,
  ArrivalOption,
  ArrivalTransfers,
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
  detail: TripDetail
}

const trips = new Map<string, StoredTrip>()

export const resetTrips = () => trips.clear()

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
    // sort는 안정 정렬이라 추천편이 없는 노선은 원래 순서를 유지한다
    options: [...options].sort(
      (a, b) => recommendedArrival(a) - recommendedArrival(b),
    ),
  }
}

const tripHandlers = [
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
        arrivalTransfers(trip.detail.outbound.arrivalAt, immigrationMin),
      )
    },
  ),
  http.delete('*/api/v1/trips/:tripId', ({ request, params }) => {
    const trip = findOwnedTrip(request, String(params.tripId))
    if (trip instanceof Response) return trip
    trips.delete(String(params.tripId))
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
