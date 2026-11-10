import type { FlightCheck } from '@/api/transfers'
import { messages } from '@/constants/messages'
import { formatLocal } from '@/lib/time'
import { cn } from '@/lib/utils'
import { LocalTime } from './LocalTime'

const m = messages.transfer.flightCheck

/** "지연 반영됨: 예정 HH:mm → 변경 HH:mm". 변경 시각이 예정보다 이르면 "시각 변경 반영됨" */
export function FlightChangeLine({
  scheduledAt,
  changedAt,
  tz,
}: {
  scheduledAt: string
  changedAt: string
  tz: string
}) {
  const delayed = Date.parse(changedAt) > Date.parse(scheduledAt)
  return (
    <p className="font-semibold">
      {delayed ? m.delayed : m.changed} {m.scheduled}{' '}
      <LocalTime iso={scheduledAt} base={scheduledAt} tz={tz} /> → {m.revised}{' '}
      <LocalTime iso={changedAt} base={scheduledAt} tz={tz} />
    </p>
  )
}

/** 항공편 재조회 결과와 마지막 확인 시각. 수동 입력 편은 확인 시각을 보이지 않는다 */
export function FlightCheckNotice({
  check,
  tz,
}: {
  check: FlightCheck
  tz: string
}) {
  const failed = check.result === 'FAILED'
  const details: Record<FlightCheck['result'], string | null> = {
    REFRESHED: null,
    FAILED: m.failed,
    BEFORE_WINDOW: m.beforeWindow,
    AFTER_WINDOW: m.afterWindow,
    MANUAL: m.manual,
  }
  const detail = details[check.result]
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 text-xs',
        failed ? 'font-medium text-amber-900' : 'text-muted-foreground',
      )}
    >
      {detail && <p>{detail}</p>}
      {check.result !== 'MANUAL' && (
        <p>
          {m.lastChecked(formatLocal(check.checkedAt, tz, 'M월 d일 HH:mm'))}
        </p>
      )}
    </div>
  )
}
