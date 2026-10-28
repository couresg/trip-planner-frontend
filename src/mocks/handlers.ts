import { http, HttpResponse } from 'msw'
import type { Area, City, Place } from '@/api/catalog'

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

export const handlers = [
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
