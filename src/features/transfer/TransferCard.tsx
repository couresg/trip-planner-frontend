import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  BusFront,
  Car,
  CarTaxiFront,
  MapPin,
  TrainFront,
  TramFront,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useId } from 'react'
import type {
  ArrivalOption,
  TransferMode,
  TransferRoute,
} from '@/api/transfers'
import { messages } from '@/constants/messages'
import { DepartureChips } from './DepartureChips'
import { LocalTime } from './LocalTime'

const m = messages.transfer

const modeIcon: Record<TransferMode, LucideIcon> = {
  RAIL: TrainFront,
  SUBWAY: TramFront,
  BUS: BusFront,
  TAXI: CarTaxiFront,
  RIDE_HAILING: Car,
}

/** 도착일·귀국일 공통 카드. 소요 문구와 시각 영역은 탭마다 다르다 */
export function TransferCardFrame({
  option,
  durationText,
  children,
}: {
  option: TransferRoute
  durationText: string
  children: ReactNode
}) {
  const titleId = useId()
  const Icon = modeIcon[option.mode]
  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-2 rounded-lg border p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs">
          <Icon className="size-3.5" aria-hidden />
          {m.mode[option.mode]}
        </span>
        {option.is24h && (
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
            {m.allDay}
          </span>
        )}
      </div>
      <h3 id={titleId} className="text-base font-semibold">
        {option.name}
      </h3>
      {(option.from || option.to) && (
        <p className="flex flex-wrap items-center gap-1 text-sm">
          {option.from && <span>{option.from}</span>}
          {option.from && option.to && (
            <ArrowRight className="size-3.5" aria-hidden />
          )}
          {option.to && <span>{option.to}</span>}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {durationText}
        {option.fare && (
          <>
            {' · '}
            <span className="font-medium text-foreground">
              {option.fare.display}
            </span>
          </>
        )}
      </p>
      {option.boardingTip && (
        <p className="flex items-start gap-1 text-sm">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            <span className="sr-only">{m.boardingTip}: </span>
            {option.boardingTip}
          </span>
        </p>
      )}
      {children}
      {option.note && (
        <p className="text-xs text-muted-foreground">{option.note}</p>
      )}
      <p className="text-xs text-muted-foreground">
        {m.dataAsOf(option.dataAsOf)}
      </p>
    </article>
  )
}

export function TransferCard({
  option,
  base,
  tz,
}: {
  option: ArrivalOption
  base: string
  tz: string
}) {
  const walk =
    option.walkAfterMin > 0 ? ` + ${m.walk(option.walkAfterMin)}` : ''
  return (
    <TransferCardFrame
      option={option}
      durationText={`${m.duration(option.durationMin)}${walk}`}
    >
      {option.departures.length > 0 && (
        <DepartureChips departures={option.departures} base={base} tz={tz} />
      )}
      {/* 탑승 어려움 편만 남은 노선은 칩과 첫차 안내를 함께 보여 준다 */}
      {option.nextFirstDeparture ? (
        <p className="text-sm font-medium text-amber-800">
          {m.serviceEnded} · {m.firstDeparture}{' '}
          <LocalTime iso={option.nextFirstDeparture} base={base} tz={tz} />
        </p>
      ) : (
        option.departures.length === 0 &&
        !option.is24h && (
          <p className="text-sm text-muted-foreground">{m.noDepartures}</p>
        )
      )}
    </TransferCardFrame>
  )
}
