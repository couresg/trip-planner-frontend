import type { ItineraryItem } from '@/api/itinerary'

export interface MapStop {
  number: number
  itemId: number
  nameKo: string
  position: { lat: number; lng: number }
}

/** 하루 일정 순서대로 번호를 매긴 정류장. 이 순서가 곧 지도의 선 경로다 */
export const stopsOf = (items: ItineraryItem[]): MapStop[] =>
  items.map((item, index) => ({
    number: index + 1,
    itemId: item.itemId,
    nameKo: item.place.nameKo,
    position: { lat: item.place.lat, lng: item.place.lng },
  }))

// 장소가 한 곳이면 범위 넓이가 0이라 지도가 최대로 확대된다
const MIN_SPAN_DEG = 0.01

const widen = (min: number, max: number) => {
  const pad = Math.max(MIN_SPAN_DEG - (max - min), 0) / 2
  return [min - pad, max + pad]
}

export function boundsOf(stops: MapStop[]) {
  const lats = stops.map((s) => s.position.lat)
  const lngs = stops.map((s) => s.position.lng)
  const [south, north] = widen(Math.min(...lats), Math.max(...lats))
  const [west, east] = widen(Math.min(...lngs), Math.max(...lngs))
  return { south, north, west, east }
}
