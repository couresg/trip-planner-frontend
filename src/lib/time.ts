import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

/** 서버가 준 ISO 오프셋 시각을 지정한 IANA 시간대로 포맷한다. 브라우저 로컬 시간대는 쓰지 않는다. 잘못된 ISO면 RangeError. */
export function formatLocal(
  iso: string,
  tz: string,
  pattern = 'HH:mm',
): string {
  return formatInTimeZone(iso, tz, pattern)
}

/** tz 기준 달력 날짜 차이 (target - base). 도착 23:30 → 00:40 이면 1. 잘못된 ISO면 RangeError. */
export function dayDiff(base: string, target: string, tz: string): number {
  const toUtcDay = (iso: string) => {
    const [y, m, d] = formatLocal(iso, tz, 'yyyy-MM-dd').split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toUtcDay(target) - toUtcDay(base)) / 86_400_000)
}

/** 날짜 차이 배지: 0 → '', 1 → '+1', -1 → '-1' */
export function formatDayBadge(diff: number): string {
  if (diff === 0) return ''
  return diff > 0 ? `+${diff}` : `${diff}`
}

/** datetime-local 값(yyyy-MM-ddTHH:mm)을 tz 벽시계 시각으로 보고 오프셋 포함 ISO로 바꾼다. 브라우저 시간대와 무관. */
export function zonedInputToIso(local: string, tz: string): string {
  return formatInTimeZone(
    fromZonedTime(local, tz),
    tz,
    "yyyy-MM-dd'T'HH:mm:ssXXX",
  )
}

/** ISO 문자열 자체의 오프셋('+09:00', Z → 'UTC'). 도시 timezone을 모르는 공항 시각을 그 공항 현지 시각으로 포맷할 때 tz로 쓴다. */
export function isoOffsetZone(iso: string): string {
  const match = /([+-]\d{2}:\d{2})$/.exec(iso)
  return match ? match[1] : 'UTC'
}
