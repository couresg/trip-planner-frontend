import type { DepartureOption, ReturnDeparture } from '@/api/transfers'
import { messages } from '@/constants/messages'
import { cn } from '@/lib/utils'
import { LocalTime } from './LocalTime'
import { TransferCardFrame } from './TransferCard'

const m = messages.departure
const t = messages.transfer

function LeaveChips({
  departures,
  base,
  tz,
}: {
  departures: ReturnDeparture[]
  base: string
  tz: string
}) {
  return (
    <ul aria-label={t.departures} className="flex flex-wrap gap-2">
      {departures.map((d) => {
        const latest = d.label === 'LATEST' && !d.outsideWindow
        return (
          <li
            key={d.departAt}
            className={cn(
              'flex min-w-32 flex-col rounded-md border px-2 py-1 text-sm',
              latest && 'border-2 border-green-600 bg-green-50',
              d.outsideWindow && 'border-2 border-amber-500 bg-amber-50',
            )}
          >
            <span className="font-semibold">
              <LocalTime iso={d.leaveAreaAt} base={base} tz={tz} /> {m.leaveAt}
            </span>
            <span className="text-xs">
              {m.boardAt} <LocalTime iso={d.departAt} base={base} tz={tz} />
            </span>
            <span className="text-xs">
              {m.arriveAirportAt}{' '}
              <LocalTime iso={d.arriveAirportAt} base={base} tz={tz} />
            </span>
            {latest && (
              <span className="text-xs font-semibold text-green-700">
                <span aria-hidden>✅</span> {m.latest}
              </span>
            )}
            {d.label === 'SAFER' && (
              <span className="text-xs font-semibold text-blue-800">
                {m.safer}
              </span>
            )}
            {d.outsideWindow && (
              <span className="text-xs font-semibold text-amber-800">
                {m.lastTrain}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function DepartureTransferCard({
  option,
  base,
  tz,
}: {
  option: DepartureOption
  base: string
  tz: string
}) {
  const walk =
    option.walkBeforeMin > 0 ? `${t.walk(option.walkBeforeMin)} + ` : ''
  return (
    <TransferCardFrame
      option={option}
      durationText={`${walk}${t.duration(option.durationMin)}`}
    >
      {option.departures.length > 0 && (
        <LeaveChips departures={option.departures} base={base} tz={tz} />
      )}
      {option.departures.some((d) => d.outsideWindow) && (
        <p className="text-sm font-medium text-amber-800">{m.outsideWindow}</p>
      )}
      {option.leaveByAt && (
        <>
          <p className="text-sm font-semibold">
            {m.leaveByPrefix}{' '}
            <LocalTime iso={option.leaveByAt} base={base} tz={tz} />{' '}
            {m.leaveBySuffix}
          </p>
          <p className="text-xs text-muted-foreground">{m.leaveByEstimate}</p>
        </>
      )}
      {option.departures.length === 0 && !option.is24h && (
        <p className="text-sm text-muted-foreground">{t.noDepartures}</p>
      )}
    </TransferCardFrame>
  )
}
