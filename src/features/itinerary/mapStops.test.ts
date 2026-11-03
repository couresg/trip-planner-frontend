import { describe, expect, it } from 'vitest'
import type { ItineraryItem } from '@/api/itinerary'
import { boundsOf, stopsOf } from './mapStops'

const item = (
  itemId: number,
  nameKo: string,
  lat: number,
  lng: number,
  position: number,
): ItineraryItem => ({
  itemId,
  position,
  plannedTime: null,
  memo: '',
  place: { id: itemId, nameKo, category: 'SIGHT', lat, lng, durationMin: 60 },
  warnings: [],
})

describe('stopsOf', () => {
  it('numbers the stops from 1 in day order, not by id', () => {
    const stops = stopsOf([
      item(9, '두번째 id', 34.7, 135.5, 0),
      item(3, '첫번째 id', 34.6, 135.4, 1),
    ])
    expect(stops).toEqual([
      {
        number: 1,
        itemId: 9,
        nameKo: '두번째 id',
        position: { lat: 34.7, lng: 135.5 },
      },
      {
        number: 2,
        itemId: 3,
        nameKo: '첫번째 id',
        position: { lat: 34.6, lng: 135.4 },
      },
    ])
  })

  it('returns no stops for an empty day', () => {
    expect(stopsOf([])).toEqual([])
  })
})

describe('boundsOf', () => {
  it('surrounds all stops', () => {
    expect(
      boundsOf(
        stopsOf([item(1, 'a', 34.5, 135.5, 0), item(2, 'b', 34.8, 135.1, 1)]),
      ),
    ).toEqual({ south: 34.5, north: 34.8, west: 135.1, east: 135.5 })
  })

  it('widens a single stop so the map does not zoom to the maximum', () => {
    const b = boundsOf(stopsOf([item(1, 'a', 34.5, 135.5, 0)]))
    expect(b.south).toBeCloseTo(34.495)
    expect(b.north).toBeCloseTo(34.505)
    expect(b.west).toBeCloseTo(135.495)
    expect(b.east).toBeCloseTo(135.505)
  })
})
