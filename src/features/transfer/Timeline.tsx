import type { ArrivalTransfers } from '@/api/transfers'
import { messages } from '@/constants/messages'
import { LocalTime } from './LocalTime'

const m = messages.transfer

/** 모든 노선의 추천편 중 숙소에 가장 먼저 도착하는 편 */
function earliestRecommended(data: ArrivalTransfers) {
  return data.options
    .flatMap((o) =>
      o.departures
        .filter((d) => d.recommended)
        .map((d) => ({ name: o.name, departure: d })),
    )
    .sort(
      (a, b) =>
        Date.parse(a.departure.arriveAreaAt) -
        Date.parse(b.departure.arriveAreaAt),
    )[0]
}

export function Timeline({
  data,
  areaName,
}: {
  data: ArrivalTransfers
  areaName: string
}) {
  const best = earliestRecommended(data)
  const steps = [
    { label: m.landing, at: data.baseTime },
    { label: m.ready, at: data.readyAt },
    ...(best
      ? [
          {
            label: m.recommendedDepart(best.name),
            at: best.departure.departAt,
          },
          {
            label: `${m.arriveArea} · ${areaName}`,
            at: best.departure.arriveAreaAt,
          },
        ]
      : []),
  ]
  return (
    <section aria-label={m.timeline} className="flex flex-col gap-2">
      <ol className="flex flex-col border-l-2 border-primary/30 pl-4">
        {steps.map((step) => (
          <li
            key={step.label}
            className="relative flex items-baseline justify-between gap-2 py-1 before:absolute before:top-2.5 before:-left-[1.3rem] before:size-2.5 before:rounded-full before:bg-primary"
          >
            <span className="text-sm">{step.label}</span>
            <span className="font-semibold">
              <LocalTime
                iso={step.at}
                base={data.baseTime}
                tz={data.timezone}
              />
            </span>
          </li>
        ))}
      </ol>
      {!best && (
        <p className="text-sm text-muted-foreground">{m.noRecommendation}</p>
      )}
    </section>
  )
}
