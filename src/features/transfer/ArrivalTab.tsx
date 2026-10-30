import { CircleAlert, TriangleAlert } from 'lucide-react'
import { isOnDemandMode, useArrivalTransfers } from '@/api/transfers'
import type { ArrivalTransfers } from '@/api/transfers'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { messages } from '@/constants/messages'
import { cn } from '@/lib/utils'
import { useTransferSettings } from '@/stores/transferSettings'
import { ImmigrationSelector } from './ImmigrationSelector'
import { LocalTime } from './LocalTime'
import { Timeline } from './Timeline'
import { TransferCard } from './TransferCard'

const m = messages.transfer

/** 대중교통이 모두 끝났으면 택시·차량 호출을 먼저 보여준다 (서버는 맨 뒤에 둔다) */
function orderedOptions(data: ArrivalTransfers) {
  if (!data.noTransitWarning) return data.options
  return [
    ...data.options.filter((o) => isOnDemandMode(o.mode)),
    ...data.options.filter((o) => !isOnDemandMode(o.mode)),
  ]
}

function earliestFirstDeparture(data: ArrivalTransfers) {
  return data.options
    .flatMap((o) => (o.nextFirstDeparture ? [o.nextFirstDeparture] : []))
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0]
}

function NoTransitBanner({ data }: { data: ArrivalTransfers }) {
  const first = earliestFirstDeparture(data)
  return (
    <div
      role="status"
      className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-1">
        <p>{m.noTransitWarning}</p>
        {first && (
          <p className="font-semibold">
            {m.serviceEnded} · {m.firstDeparture}{' '}
            <LocalTime iso={first} base={data.baseTime} tz={data.timezone} />
          </p>
        )}
      </div>
    </div>
  )
}

export function ArrivalTab({
  tripId,
  areaName,
}: {
  tripId: string
  areaName: string
}) {
  const immigrationMin = useTransferSettings((s) => s.immigrationMin)
  const transfers = useArrivalTransfers(tripId, immigrationMin)

  let body
  if (transfers.isError) {
    body = (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-2 text-sm text-red-600"
      >
        <CircleAlert className="size-4" aria-hidden />
        <span>{messages.common.error}</span>
        <Button
          size="sm"
          variant="outline"
          disabled={transfers.isFetching}
          onClick={() => transfers.refetch()}
        >
          {messages.common.retry}
        </Button>
      </div>
    )
  } else if (transfers.isPending) {
    body = (
      <div className="flex flex-col gap-3" aria-label={messages.common.loading}>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  } else {
    const data = transfers.data
    body = (
      <div
        className={cn(
          'flex flex-col gap-3 transition-opacity',
          transfers.isPlaceholderData && 'opacity-60',
        )}
        aria-busy={transfers.isPlaceholderData}
      >
        {data.noTransitWarning && <NoTransitBanner data={data} />}
        <Timeline data={data} areaName={areaName} />
        {orderedOptions(data).map((option) => (
          <TransferCard
            key={option.routeId}
            option={option}
            base={data.baseTime}
            tz={data.timezone}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ImmigrationSelector />
      {body}
    </div>
  )
}
