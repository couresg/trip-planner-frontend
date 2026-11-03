import { arrayMove } from '@dnd-kit/sortable'
import type { ItineraryDay, ItineraryItem } from '@/api/itinerary'

export interface DayOrder {
  date: string
  itemIds: number[]
}

/** 저장 전 항목의 임시 id. 서버 id는 양수다 */
export const isUnsavedItem = (itemId: number) => itemId < 0

const DAY_PREFIX = 'day:'

/** 빈 날짜에도 놓을 수 있도록 날짜 영역에 주는 드롭 id. 항목 id(number)와 겹치지 않는다 */
export const dayDroppableId = (date: string) => `${DAY_PREFIX}${date}`

const renumber = (items: ItineraryItem[]) =>
  items.map((item, position) => ({ ...item, position }))

const idsOf = (day: ItineraryDay) => day.items.map((i) => i.itemId)

const dayOfItem = (days: ItineraryDay[], itemId: number) =>
  days.find((d) => d.items.some((i) => i.itemId === itemId))

/** 서버 PUT 규칙과 같다: 나열한 항목을 이 날짜로 모으고, 나열하지 않은 기존 항목은 뒤에 남긴다 */
export function applyDayOrder(
  days: ItineraryDay[],
  { date, itemIds }: DayOrder,
): ItineraryDay[] {
  const byId = new Map(days.flatMap((d) => d.items).map((i) => [i.itemId, i]))
  const listed = new Set(itemIds)
  return days.map((day) => {
    const rest = day.items.filter((i) => !listed.has(i.itemId))
    const items =
      day.date === date
        ? [...itemIds.flatMap((id) => byId.get(id) ?? []), ...rest]
        : rest
    return { ...day, items: renumber(items) }
  })
}

export const appendItem = (
  days: ItineraryDay[],
  date: string,
  item: ItineraryItem,
): ItineraryDay[] =>
  days.map((day) =>
    day.date === date ? { ...day, items: renumber([...day.items, item]) } : day,
  )

export const removeItem = (
  days: ItineraryDay[],
  itemId: number,
): ItineraryDay[] =>
  days.map((day) => ({
    ...day,
    items: renumber(day.items.filter((i) => i.itemId !== itemId)),
  }))

export const removeUnsavedItems = (days: ItineraryDay[]): ItineraryDay[] =>
  days.map((day) => ({
    ...day,
    items: renumber(day.items.filter((i) => !isUnsavedItem(i.itemId))),
  }))

export const replaceItem = (
  days: ItineraryDay[],
  itemId: number,
  next: ItineraryItem,
): ItineraryDay[] =>
  days.map((day) => ({
    ...day,
    items: renumber(day.items.map((i) => (i.itemId === itemId ? next : i))),
  }))

/** 같은 날짜 안에서 한 칸 옮긴 순서. 끝에서 더 못 가면 null */
export function orderForShift(
  day: ItineraryDay,
  itemId: number,
  delta: -1 | 1,
): DayOrder | null {
  const ids = idsOf(day)
  const from = ids.indexOf(itemId)
  const to = from + delta
  if (from < 0 || to < 0 || to >= ids.length) return null
  return { date: day.date, itemIds: arrayMove(ids, from, to) }
}

/** 다른 날짜의 맨 뒤로 옮긴 순서. 이미 그 날짜면 null */
export function orderForMoveToDate(
  days: ItineraryDay[],
  itemId: number,
  date: string,
): DayOrder | null {
  const target = days.find((d) => d.date === date)
  if (!target || idsOf(target).includes(itemId)) return null
  return { date, itemIds: [...idsOf(target), itemId] }
}

/**
 * 드롭 위치로 정한 순서. 다른 날짜의 항목 위면 그 앞에, 다른 날짜 영역이면 맨 뒤에 넣는다.
 * 자기 날짜의 머리글·지도처럼 항목이 아닌 곳에 놓으면 움직이지 않는다.
 * 순서가 그대로이거나 대상이 없으면 null.
 */
export function orderForDrop(
  days: ItineraryDay[],
  activeId: number,
  overId: number | string,
): DayOrder | null {
  const from = dayOfItem(days, activeId)
  const to =
    typeof overId === 'string'
      ? days.find((d) => dayDroppableId(d.date) === overId)
      : dayOfItem(days, overId)
  if (!from || !to) return null

  const ids = idsOf(to)
  if (from.date !== to.date) {
    const at = typeof overId === 'string' ? ids.length : ids.indexOf(overId)
    return {
      date: to.date,
      itemIds: [...ids.slice(0, at), activeId, ...ids.slice(at)],
    }
  }
  if (typeof overId === 'string') return null
  const at = ids.indexOf(overId)
  const fromIndex = ids.indexOf(activeId)
  return fromIndex === at
    ? null
    : { date: to.date, itemIds: arrayMove(ids, fromIndex, at) }
}

/**
 * 키보드로 한 칸 옮길 다음 자리(orderForDrop의 overId). 끝이면 null.
 * 자리는 위에서 아래로 자기 날짜의 각 항목, 다른 날짜의 각 항목 앞과 맨 뒤(날짜 영역)다.
 * 그래서 첫 항목에서 위로 가면 이전 날짜의 맨 뒤, 마지막 항목에서 아래로 가면 다음 날짜의 맨 앞이다.
 */
export function keyboardTarget(
  days: ItineraryDay[],
  activeId: number,
  currentId: number | string,
  delta: -1 | 1,
): number | string | null {
  const slots = days.flatMap((day): (number | string)[] => {
    const ids = idsOf(day).filter((id) => !isUnsavedItem(id))
    return ids.includes(activeId) ? ids : [...ids, dayDroppableId(day.date)]
  })
  const current = slots.indexOf(currentId)
  return current < 0 ? null : (slots[current + delta] ?? null)
}
