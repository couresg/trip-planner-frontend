import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  AIRPORT_BUFFER_OPTIONS,
  isOnDemandMode,
  onDemandFirst,
  useDepartureTransfers,
} from '@/api/transfers'
import type { DepartureTransfers } from '@/api/transfers'
import { isCanceledStatus } from '@/api/flights'
import { messages } from '@/constants/messages'
import { dayDiff, formatLocal } from '@/lib/time'
import { useTransferSettings } from '@/stores/transferSettings'
import { CanceledBanner } from './CanceledBanner'
import { DepartureTransferCard } from './DepartureTransferCard'
import { LocalTime } from './LocalTime'
import { MinuteSelector } from './MinuteSelector'
import { TimelineSteps } from './Timeline'
import { TransfersError, TransfersSkeleton } from './TransfersState'

const m = messages.departure

/** latestLeaveAt을 만든 편들. 시각이 같으면 여러 노선일 수 있다 */
function latestDepartures(data: DepartureTransfers) {
  if (!data.latestLeaveAt) return []
  const latest = Date.parse(data.latestLeaveAt)
  return data.options.flatMap((o) =>
    o.departures
      .filter(
        (d) => d.label === 'LATEST' && Date.parse(d.leaveAreaAt) === latest,
      )
      .map((d) => ({ name: o.name, departure: d })),
  )
}

function WarningBanner({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}

function Headline({ iso, data }: { iso: string; data: DepartureTransfers }) {
  const base = data.flightDepartureAt
  const tz = data.timezone
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-green-50 p-3 text-green-900">
      <p className="text-lg font-bold">
        {m.headlinePrefix} <LocalTime iso={iso} base={base} tz={tz} />
        {m.headlineSuffix}
      </p>
      <p className="text-sm">{m.boardingMargin(data.boardingMarginMin)}</p>
      {dayDiff(base, iso, tz) !== 0 && (
        <p className="text-sm font-medium">
          {m.otherDay(formatLocal(iso, tz, 'M월 d일'))}
        </p>
      )}
    </div>
  )
}

function DepartureContent({ data }: { data: DepartureTransfers }) {
  const transit = data.options.filter((o) => !isOnDemandMode(o.mode))
  const hasOnDemand = transit.length < data.options.length
  const hasDepartures = transit.some((o) => o.departures.length > 0)
  const noTime = data.noTimeAfterLanding
  const latest = noTime ? [] : latestDepartures(data)
  const [first] = latest
  // 일부 노선만 범위 밖이면 카드에서 안내한다. 강조 문구가 막차를 가리킬 때만 위에서 알린다
  const headlineIsLastTrain =
    latest.length > 0 && latest.every((l) => l.departure.outsideWindow)
  const options =
    data.firstTrainTooLate && !noTime
      ? onDemandFirst(data.options)
      : data.options
  const steps = [
    ...(first
      ? [{ label: m.leaveArea(first.name), at: first.departure.leaveAreaAt }]
      : []),
    { label: m.deadline, at: data.airportDeadline },
    {
      label: data.revisedDepartureAt
        ? m.flightDepartureOriginal
        : m.flightDeparture,
      at: data.flightDepartureAt,
    },
  ]

  return (
    <>
      {data.revisedDepartureAt && (
        <WarningBanner>
          <p className="font-semibold">
            {m.delayedAt}{' '}
            <LocalTime
              iso={data.revisedDepartureAt}
              base={data.flightDepartureAt}
              tz={data.timezone}
            />
          </p>
          <p>{m.delayedDetail}</p>
        </WarningBanner>
      )}
      {noTime && (
        <WarningBanner>
          <p className="font-semibold">{m.noTimeAfterLanding}</p>
          <p>{m.noTimeAfterLandingDetail}</p>
        </WarningBanner>
      )}
      {data.latestLeaveAt && !noTime && (
        <Headline iso={data.latestLeaveAt} data={data} />
      )}
      {/* 노선이 아예 없으면 첫차를 말할 근거가 없다 */}
      {data.firstTrainTooLate && !noTime && transit.length > 0 && (
        <WarningBanner>
          <p className="font-semibold">{m.firstTrainTooLate}</p>
          {hasOnDemand && <p>{m.takeOnDemand}</p>}
        </WarningBanner>
      )}
      {headlineIsLastTrain && (
        <WarningBanner>
          <p className="font-semibold">{m.outsideWindow}</p>
          {hasOnDemand && <p>{m.considerOnDemand}</p>}
        </WarningBanner>
      )}
      {!noTime && !hasOnDemand && !hasDepartures && (
        <WarningBanner>
          <p>{m.noOptions}</p>
        </WarningBanner>
      )}
      <TimelineSteps
        label={m.summary}
        steps={steps}
        base={data.flightDepartureAt}
        tz={data.timezone}
      />
      {options.map((option) => (
        <DepartureTransferCard
          key={option.routeId}
          option={option}
          base={data.flightDepartureAt}
          tz={data.timezone}
        />
      ))}
    </>
  )
}

export function DepartureTab({
  tripId,
  returnStatus,
}: {
  tripId: string
  returnStatus: string | null
}) {
  const airportBufferMin = useTransferSettings((s) => s.airportBufferMin)
  const setAirportBufferMin = useTransferSettings((s) => s.setAirportBufferMin)
  const transfers = useDepartureTransfers(tripId, airportBufferMin)

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
    body = (
      <div className="flex flex-col gap-3">
        <DepartureContent data={transfers.data} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {isCanceledStatus(returnStatus) && <CanceledBanner />}
      <MinuteSelector
        name="airportBufferMin"
        legend={m.airportBuffer}
        hint={m.airportBufferHint}
        options={AIRPORT_BUFFER_OPTIONS}
        optionLabel={m.airportBufferOption}
        value={airportBufferMin}
        onChange={setAirportBufferMin}
      />
      <p className="text-xs text-muted-foreground">{m.notice}</p>
      {body}
    </div>
  )
}
