import type { ArrivalDeparture } from '@/api/transfers'
import { messages } from '@/constants/messages'
import { cn } from '@/lib/utils'
import { LocalTime } from './LocalTime'

const m = messages.transfer

export function DepartureChips({
  departures,
  base,
  tz,
}: {
  departures: ArrivalDeparture[]
  base: string
  tz: string
}) {
  return (
    <ul aria-label={m.departures} className="flex flex-wrap gap-2">
      {departures.map((d) => {
        const hard = d.status === 'HARD_TO_CATCH'
        return (
          <li
            key={d.departAt}
            className={cn(
              'flex min-w-24 flex-col rounded-md border px-2 py-1 text-sm',
              hard && 'border-dashed text-muted-foreground opacity-60',
              d.recommended && 'border-2 border-green-600 bg-green-50',
            )}
          >
            <span className="font-semibold">
              <LocalTime iso={d.departAt} base={base} tz={tz} /> {m.departAt}
            </span>
            <span className="text-xs">
              {m.arriveAt}{' '}
              <LocalTime iso={d.arriveAreaAt} base={base} tz={tz} />
            </span>
            {d.recommended && (
              <span className="text-xs font-semibold text-green-700">
                <span aria-hidden>✅</span> {m.recommended}
              </span>
            )}
            {hard && <span className="text-xs">{m.hardToCatch}</span>}
          </li>
        )
      })}
    </ul>
  )
}
