import { describe, expect, it } from 'vitest'
import type { ItineraryDay, ItineraryItem } from '@/api/itinerary'
import {
  appendItem,
  applyDayOrder,
  dayDroppableId,
  keyboardTarget,
  orderForDrop,
  orderForMoveToDate,
  orderForShift,
  removeItem,
  removeUnsavedItems,
  replaceItem,
} from './itineraryOrder'

const item = (itemId: number, position = 0): ItineraryItem => ({
  itemId,
  position,
  plannedTime: null,
  memo: '',
  place: {
    id: itemId * 10,
    nameKo: `장소${itemId}`,
    category: 'SIGHT',
    lat: 34,
    lng: 135,
    durationMin: 60,
  },
  warnings: [],
})

const day = (date: string, ...ids: number[]): ItineraryDay => ({
  date,
  dayIndex: Number(date.slice(-1)),
  earliestStart: null,
  latestEnd: null,
  items: ids.map(item),
})

const D1 = '2026-11-01'
const D2 = '2026-11-02'
const D3 = '2026-11-03'
const days = [day(D1, 1, 2, 3), day(D2, 4, 5), day(D3)]

const shape = (result: ItineraryDay[]) =>
  result.map((d) => d.items.map((i) => [i.itemId, i.position]))

describe('applyDayOrder', () => {
  it('reorders within a day and renumbers positions', () => {
    expect(
      shape(applyDayOrder(days, { date: D1, itemIds: [3, 1, 2] }))[0],
    ).toEqual([
      [3, 0],
      [1, 1],
      [2, 2],
    ])
  })

  it('moves a listed item from another day and compacts the source', () => {
    expect(
      shape(applyDayOrder(days, { date: D2, itemIds: [4, 1, 5] })),
    ).toEqual([
      [
        [2, 0],
        [3, 1],
      ],
      [
        [4, 0],
        [1, 1],
        [5, 2],
      ],
      [],
    ])
  })

  it('keeps items not listed after the listed ones, as the server does', () => {
    expect(
      shape(applyDayOrder(days, { date: D1, itemIds: [3] }))[0].map(
        ([id]) => id,
      ),
    ).toEqual([3, 1, 2])
  })

  it('moves onto an empty day', () => {
    expect(shape(applyDayOrder(days, { date: D3, itemIds: [5] }))[2]).toEqual([
      [5, 0],
    ])
  })

  it('does not mutate its input', () => {
    applyDayOrder(days, { date: D1, itemIds: [3, 2, 1] })
    expect(days[0].items.map((i) => i.itemId)).toEqual([1, 2, 3])
  })
})

describe('appendItem / removeItem / replaceItem', () => {
  it('appends at the end of the date only', () => {
    expect(shape(appendItem(days, D2, item(9)))[1]).toEqual([
      [4, 0],
      [5, 1],
      [9, 2],
    ])
  })

  it('removes and compacts', () => {
    expect(shape(removeItem(days, 1))[0]).toEqual([
      [2, 0],
      [3, 1],
    ])
  })

  it('removes unsaved items from every day and compacts', () => {
    expect(
      shape(
        removeUnsavedItems([day(D1, -1, 1, -2, 2), day(D2, -3), day(D3, 4)]),
      ),
    ).toEqual([
      [
        [1, 0],
        [2, 1],
      ],
      [],
      [[4, 0]],
    ])
  })

  it('replaces in place', () => {
    expect(shape(replaceItem(days, 2, item(9)))[0]).toEqual([
      [1, 0],
      [9, 1],
      [3, 2],
    ])
  })
})

describe('orderForShift', () => {
  it('moves up and down by one', () => {
    expect(orderForShift(days[0], 2, -1)?.itemIds).toEqual([2, 1, 3])
    expect(orderForShift(days[0], 2, 1)?.itemIds).toEqual([1, 3, 2])
  })

  it('returns null at the edges and for an unknown item', () => {
    expect(orderForShift(days[0], 1, -1)).toBeNull()
    expect(orderForShift(days[0], 3, 1)).toBeNull()
    expect(orderForShift(days[0], 99, 1)).toBeNull()
  })
})

describe('orderForMoveToDate', () => {
  it('appends to the target date', () => {
    expect(orderForMoveToDate(days, 1, D2)).toEqual({
      date: D2,
      itemIds: [4, 5, 1],
    })
    expect(orderForMoveToDate(days, 1, D3)).toEqual({ date: D3, itemIds: [1] })
  })

  it('returns null for the same date or an unknown date', () => {
    expect(orderForMoveToDate(days, 1, D1)).toBeNull()
    expect(orderForMoveToDate(days, 1, '2026-12-01')).toBeNull()
  })
})

describe('keyboardTarget', () => {
  const area = dayDroppableId
  const week = [
    day(D1),
    day(D2, 1, 2),
    day(D3, 3),
    day('2026-11-04'),
    day('2026-11-05', 4),
  ]

  it('walks within its own day by item', () => {
    expect(keyboardTarget(days, 1, 1, 1)).toBe(2)
    expect(keyboardTarget(days, 1, 2, 1)).toBe(3)
    expect(keyboardTarget(days, 3, 3, -1)).toBe(2)
  })

  it('goes from the first item up to the end of the previous day, whatever its size', () => {
    expect(keyboardTarget(week, 3, 3, -1)).toBe(area(D2))
    expect(keyboardTarget(days, 4, 4, -1)).toBe(area(D1))
    // 두 항목이든 세 항목이든 같은 규칙이다
    expect(keyboardTarget([day(D1, 9), day(D2, 1, 2, 3)], 1, 1, -1)).toBe(
      area(D1),
    )
  })

  it('moves up into an empty day above', () => {
    expect(keyboardTarget(week, 1, 1, -1)).toBe(area(D1))
  })

  it('goes from the last item down to the start of the next day', () => {
    expect(keyboardTarget(days, 3, 3, 1)).toBe(4)
    expect(keyboardTarget(week, 2, 2, 1)).toBe(3)
  })

  it('moves down into an empty day below', () => {
    expect(keyboardTarget(days, 5, 5, 1)).toBe(area(D3))
    expect(keyboardTarget(week, 3, 3, 1)).toBe(area('2026-11-04'))
  })

  it('keeps walking through another day, one stop at a time', () => {
    // 2일차 3을 위로: 2일차 맨 뒤 → 2 앞 → 1 앞 → 1일차(빈 날) → 끝
    expect(keyboardTarget(week, 3, area(D2), -1)).toBe(2)
    expect(keyboardTarget(week, 3, 2, -1)).toBe(1)
    expect(keyboardTarget(week, 3, 1, -1)).toBe(area(D1))
    expect(keyboardTarget(week, 3, area(D1), -1)).toBeNull()
    // 내려갈 때는 항목 앞을 지나 맨 뒤로 간다
    expect(keyboardTarget(week, 3, 1, 1)).toBe(2)
    expect(keyboardTarget(week, 3, 2, 1)).toBe(area(D2))
    expect(keyboardTarget(week, 3, area(D2), 1)).toBe(3)
  })

  it('stops at the ends of the trip and for an unknown position', () => {
    expect(keyboardTarget(days.slice(0, 2), 1, 1, -1)).toBeNull()
    expect(keyboardTarget(days.slice(0, 2), 4, 1, -1)).toBeNull()
    expect(keyboardTarget(days.slice(0, 2), 5, 5, 1)).toBeNull()
    expect(keyboardTarget(days, 1, 99, 1)).toBeNull()
  })

  it('skips unsaved items, which cannot be drop targets', () => {
    const withUnsaved = [day(D1, 1), day(D2, -7, 4)]
    expect(keyboardTarget(withUnsaved, 1, 1, 1)).toBe(4)
  })

  it('produces orders that land where the keys promise', () => {
    const up = keyboardTarget(week, 3, 3, -1) as string
    expect(orderForDrop(week, 3, up)).toEqual({ date: D2, itemIds: [1, 2, 3] })
    const down = keyboardTarget(week, 2, 2, 1) as number
    expect(orderForDrop(week, 2, down)).toEqual({ date: D3, itemIds: [2, 3] })
    const empty = keyboardTarget(week, 1, 1, -1) as string
    expect(orderForDrop(week, 1, empty)).toEqual({ date: D1, itemIds: [1] })
  })
})

describe('orderForDrop', () => {
  it('uses the over index within the same day', () => {
    expect(orderForDrop(days, 1, 3)?.itemIds).toEqual([2, 3, 1])
    expect(orderForDrop(days, 3, 1)?.itemIds).toEqual([3, 1, 2])
  })

  it('returns null when dropped on itself or at the end it already holds', () => {
    expect(orderForDrop(days, 2, 2)).toBeNull()
    expect(orderForDrop(days, 3, dayDroppableId(D1))).toBeNull()
  })

  it('does not move when dropped on its own day header or map area', () => {
    expect(orderForDrop(days, 1, dayDroppableId(D1))).toBeNull()
    expect(orderForDrop(days, 2, dayDroppableId(D1))).toBeNull()
  })

  it('inserts before the item it is dropped on in another day', () => {
    expect(orderForDrop(days, 1, 5)).toEqual({ date: D2, itemIds: [4, 1, 5] })
  })

  it('appends when dropped on another day area, including an empty one', () => {
    expect(orderForDrop(days, 1, dayDroppableId(D2))).toEqual({
      date: D2,
      itemIds: [4, 5, 1],
    })
    expect(orderForDrop(days, 1, dayDroppableId(D3))).toEqual({
      date: D3,
      itemIds: [1],
    })
  })

  it('returns null for an unknown target', () => {
    expect(orderForDrop(days, 1, dayDroppableId('2026-12-01'))).toBeNull()
    expect(orderForDrop(days, 1, 99)).toBeNull()
    expect(orderForDrop(days, 99, 1)).toBeNull()
  })
})
