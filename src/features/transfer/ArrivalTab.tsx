import { TriangleAlert } from 'lucide-react'
import { isCanceledStatus } from '@/api/flights'
import {
  isOnDemandMode,
  onDemandFirst,
  useArrivalTransfers,
} from '@/api/transfers'
import type { ArrivalTransfers } from '@/api/transfers'
import { messages } from '@/constants/messages'
import { cn } from '@/lib/utils'
import { useTransferSettings } from '@/stores/transferSettings'
import { CanceledBanner } from './CanceledBanner'
import { FlightChangeLine, FlightCheckNotice } from './FlightCheckNotice'
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
  // 시간표 노선이 응답에 아예 없으면 '운행 종료'가 아니라 데이터 부재다
  const noTransitData = data.options.every((o) => isOnDemandMode(o.mode))
  return (
    <div
      role="status"
      className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-1">
        <p>{noTransitData ? m.noTransitData : m.noTransitWarning}</p>
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
        error={transfers.error}
        retrying={transfers.isFetching}
        onRetry={() => transfers.refetch()}
      />
    )
  } else if (transfers.isPending) {
    body = <TransfersSkeleton />
  } else {
    const data = transfers.data
    // 재조회로 지연·변경이 반영되면 계산 기준(baseTime)이 예정 도착과 달라진다
    const changedAt =
      Date.parse(data.baseTime) === Date.parse(data.scheduledArrivalAt)
        ? null
        : data.baseTime
    body = (
      <div
        className={cn(
          'flex flex-col gap-3 transition-opacity',
          transfers.isPlaceholderData && 'opacity-60',
        )}
        aria-busy={transfers.isPlaceholderData}
      >
        {isCanceledStatus(data.flightStatus) && <CanceledBanner />}
        {changedAt && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <FlightChangeLine
              scheduledAt={data.scheduledArrivalAt}
              changedAt={changedAt}
              tz={data.timezone}
            />
          </div>
        )}
        <FlightCheckNotice check={data.flightCheck} tz={data.timezone} />
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
