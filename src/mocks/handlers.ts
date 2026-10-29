import { http, HttpResponse } from 'msw'
import type { Area, City, Place } from '@/api/catalog'
import {
  effectiveTime,
  isValidFlightNo,
  normalizeFlightNo,
} from '@/api/flights'
import type { FlightLeg, FlightPoint } from '@/api/flights'
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
