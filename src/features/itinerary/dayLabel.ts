import type { ItineraryDay } from '@/api/itinerary'
import { messages } from '@/constants/messages'

const m = messages.itinerary

/** 날짜 문자열만 쓰므로 브라우저 시간대의 영향을 받지 않는다. 예: 1일차 · 11월 30일 (월) */
export function dayLabel({
  date,
  dayIndex,
}: Pick<ItineraryDay, 'date' | 'dayIndex'>) {
  const [year, month, day] = date.split('-').map(Number)
  const weekday =
    m.weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${m.dayNumber(dayIndex)} · ${month}월 ${day}일 (${weekday})`
}
