import { TriangleAlert } from 'lucide-react'
import { onDemandFirst, useArrivalTransfers } from '@/api/transfers'
import type { ArrivalTransfers } from '@/api/transfers'
import { messages } from '@/constants/messages'
import { cn } from '@/lib/utils'
import { useTransferSettings } from '@/stores/transferSettings'
import { ImmigrationSelector } from './ImmigrationSelector'
import { LocalTime } from './LocalTime'
import { Timeline } from './Timeline'
import { TransferCard } from './TransferCard'
import { TransfersError, TransfersSkeleton } from './TransfersState'

const m = messages.transfer

function orderedOptions(data: ArrivalTransfers) {
  return data.noTransitWarning ? onDemandFirst(data.options) : data.options
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
      <TransfersError
        retrying={transfers.isFetching}
        onRetry={() => transfers.refetch()}
      />
    )
  } else if (transfers.isPending) {
    body = <TransfersSkeleton />
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
