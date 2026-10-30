import { messages } from '@/constants/messages'
import { dayDiff, formatDayBadge, formatLocal } from '@/lib/time'

/** 공항 현지 HH:mm. 기준 시각(착륙)의 현지 날짜와 다르면 +1 같은 배지를 붙인다 */
export function LocalTime({
  iso,
  base,
  tz,
}: {
  iso: string
  base: string
  tz: string
}) {
  const diff = dayDiff(base, iso, tz)
  const badge = formatDayBadge(diff)
  return (
    <time dateTime={iso} className="tabular-nums">
      {formatLocal(iso, tz)}
      {badge && (
        <>
          <span
            aria-hidden
            className="ml-0.5 align-super text-[0.7em] font-semibold"
          >
            {badge}
          </span>
          <span className="sr-only"> {messages.transfer.dayOffset(diff)}</span>
        </>
      )}
    </time>
  )
}
