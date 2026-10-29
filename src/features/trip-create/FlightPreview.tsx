import { CircleAlert, TriangleAlert } from 'lucide-react'
import type { City } from '@/api/catalog'
import { ApiError } from '@/api/client'
import type { FlightLeg, FlightPoint } from '@/api/flights'
import { effectiveTime, useFlightLookup } from '@/api/flights'
import { Skeleton } from '@/components/ui/skeleton'
import { messages } from '@/constants/messages'
import { dayDiff, formatDayBadge, formatLocal, isoOffsetZone } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { Direction } from './tripFormSchema'

const m = messages.tripCreate.preview

interface FlightPreviewProps {
  flightNo: string
  date: string
  direction: Direction
  city: City | undefined
}

export function FlightPreview({
  flightNo,
  date,
  direction,
  city,
}: FlightPreviewProps) {
  const { data, error, isError, fetchStatus, isPending } = useFlightLookup(
    flightNo,
    date,
  )

  if (isPending && fetchStatus === 'idle') return null
  if (isPending) {
    return <Skeleton className="h-16 w-full" aria-label={m.loading} />
  }
  if (isError) {
    const text =
      error instanceof ApiError && error.code === 'FLIGHT_PROVIDER_UNAVAILABLE'
        ? m.unavailable
        : error instanceof ApiError && error.status === 404
          ? m.notFound
          : m.error
    return (
      <p
        role="alert"
        className="flex items-center gap-1.5 text-sm text-red-600"
      >
        <CircleAlert className="size-4 shrink-0" aria-hidden />
        {text}
      </p>
    )
  }

  const isCityAirport = (iata: string) =>
    !!city?.airports.some((a) => a.iata === iata)
  const cityPoint = (leg: FlightLeg) =>
    direction === 'outbound' ? leg.arrival : leg.departure
  const matched = city
    ? data.legs.find((leg) => isCityAirport(cityPoint(leg).iata))
    : undefined
  // 도시 timezone을 아는 공항은 도시 timezone, 그 외 공항은 ISO 자체 오프셋(공항 현지)으로 표시
  const tzOf = (p: FlightPoint) =>
    city && isCityAirport(p.iata)
      ? city.timezone
      : isoOffsetZone(effectiveTime(p))

  return (
    <div className="flex flex-col gap-2" data-testid={`${direction}-preview`}>
      {data.legs.map((leg, i) => (
        <LegRow key={i} leg={leg} highlighted={leg === matched} tzOf={tzOf} />
      ))}
      {city && !matched && (
        <p
          role="alert"
          className="flex items-center gap-1.5 text-sm text-red-600"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {direction === 'outbound'
            ? m.outboundMismatch(city.nameKo)
            : m.returnMismatch(city.nameKo)}
        </p>
      )}
    </div>
  )
}

function LegRow({
  leg,
  highlighted,
  tzOf,
}: {
  leg: FlightLeg
  highlighted: boolean
  tzOf: (p: FlightPoint) => string
}) {
  const depAt = effectiveTime(leg.departure)
  const arrAt = effectiveTime(leg.arrival)
  const arrTz = tzOf(leg.arrival)
  const badge = formatDayBadge(dayDiff(depAt, arrAt, arrTz))
  const warning =
    leg.status === 'Canceled'
      ? m.canceled
      : leg.status === 'Delayed'
        ? m.delayed
        : null

  return (
    <div
      className={cn(
        'rounded-md border p-2 text-sm',
        highlighted && 'border-primary bg-primary/5 ring-1 ring-primary',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <PointTime point={leg.departure} tz={tzOf(leg.departure)} />
        <span aria-hidden>→</span>
        <PointTime point={leg.arrival} tz={arrTz} />
        {badge && (
          <span className="rounded bg-amber-100 px-1.5 text-xs font-semibold text-amber-800">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        {warning && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold',
              leg.status === 'Canceled'
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-800',
            )}
          >
            <TriangleAlert className="size-3" aria-hidden />
            {warning}
          </span>
        )}
        {highlighted && (
          <span className="font-medium text-primary">{m.matchedLeg}</span>
        )}
      </div>
    </div>
  )
}

function PointTime({ point, tz }: { point: FlightPoint; tz: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="font-semibold">{point.iata}</span>
      {point.revised && point.revised !== point.scheduled ? (
        <>
          <s className="text-muted-foreground">
            {formatLocal(point.scheduled, tz)}
          </s>
          <span className="font-medium text-amber-700">
            {formatLocal(point.revised, tz)}
          </span>
        </>
      ) : (
        <span>{formatLocal(point.scheduled, tz)}</span>
      )}
    </span>
  )
}
