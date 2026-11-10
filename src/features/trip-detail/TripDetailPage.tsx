import {
  ArrowLeft,
  CircleAlert,
  PlaneLanding,
  PlaneTakeoff,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '@/api/client'
import { isCanceledStatus } from '@/api/flights'
import { isRateLimited, rateLimitedMessage } from '@/api/queryClient'
import type { FlightSource } from '@/api/trips'
import { useDeleteTrip, useTrip } from '@/api/trips'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { messages } from '@/constants/messages'
import { ArrivalTab } from '@/features/transfer/ArrivalTab'
import { DepartureTab } from '@/features/transfer/DepartureTab'
import { ItineraryTab } from '@/features/itinerary/ItineraryTab'
import { formatLocal, isoOffsetZone } from '@/lib/time'
import { useOwnerTokens } from '@/stores/ownerTokens'

const m = messages.tripDetail

function Shell({ children }: { children: ReactNode }) {
  return (
    // 화면에 고정된 실패 안내가 떠 있는 동안 맨 아래 버튼까지 그 위로 스크롤할 수 있게 한다
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4 has-data-floating-banner:pb-48">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link to="/" aria-label={m.home}>
            <ArrowLeft aria-hidden />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">{m.title}</h1>
      </div>
      {children}
    </main>
  )
}

function FlightRow({
  icon,
  label,
  flightNo,
  airport,
  at,
  source,
  status,
}: {
  icon: ReactNode
  label: string
  flightNo: string
  airport: string
  at: string
  source: FlightSource
  status: string | null
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
        <span className="font-medium text-foreground">{flightNo}</span>
      </div>
      <div className="text-lg font-semibold">
        {airport} {formatLocal(at, isoOffsetZone(at), 'yyyy-MM-dd HH:mm')}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-muted px-1.5 py-0.5">
          {m.source[source] ?? source}
        </span>
        {/* 수동 입력 구간은 status 'Manual'이 source 배지와 같은 문구라 한 번만 보인다 */}
        {status && !(status === 'Manual' && source === 'MANUAL') && (
          <span
            className={
              isCanceledStatus(status)
                ? 'rounded bg-red-100 px-1.5 py-0.5 text-red-700'
                : status === 'Delayed'
                  ? 'rounded bg-amber-100 px-1.5 py-0.5 text-amber-800'
                  : 'rounded bg-muted px-1.5 py-0.5'
            }
          >
            {m.status[status] ?? status}
          </span>
        )}
      </div>
    </div>
  )
}

export function TripDetailPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const token = useOwnerTokens((s) => (tripId ? s.tokens[tripId] : undefined))
  const trip = useTrip(tripId)
  const deleteTrip = useDeleteTrip(() =>
    navigate('/', { replace: true, flushSync: true }),
  )
  const [confirming, setConfirming] = useState(false)

  // 404면 토큰이 지워지므로 오류 상태를 토큰 확인보다 먼저 본다
  if (trip.isError) {
    const error = trip.error
    const fatal =
      error instanceof ApiError && error.status === 403
        ? m.forbidden
        : error instanceof ApiError && error.status === 404
          ? m.notFound
          : null
    const text = isRateLimited(error)
      ? rateLimitedMessage(error)
      : (fatal ?? messages.common.error)
    return (
      <Shell>
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 text-sm text-red-600"
        >
          <CircleAlert className="size-4" aria-hidden />
          <span>{text}</span>
          {!fatal && (
            <Button
              size="sm"
              variant="outline"
              disabled={trip.isFetching}
              onClick={() => trip.refetch()}
            >
              {messages.common.retry}
            </Button>
          )}
        </div>
      </Shell>
    )
  }

  if (!tripId || !token) {
    return (
      <Shell>
        <p role="alert" className="text-sm text-muted-foreground">
          {m.noToken}
        </p>
      </Shell>
    )
  }

  if (trip.isPending) {
    return (
      <Shell>
        <div
          className="flex flex-col gap-3"
          aria-label={messages.common.loading}
        >
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Shell>
    )
  }

  const t = trip.data
  const onDelete = () => deleteTrip.mutate({ tripId, ownerToken: token })

  return (
    <Shell>
      <section className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">
          {t.city.nameKo} · {t.area.nameKo}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t.startDate} ~ {t.endDate}
        </p>
      </section>

      <FlightRow
        icon={<PlaneLanding className="size-4" aria-hidden />}
        label={m.outbound}
        flightNo={t.outbound.flightNo}
        airport={t.outbound.arrivalAirport}
        at={t.outbound.arrivalAt}
        source={t.outbound.source}
        status={t.outbound.status}
      />
      <FlightRow
        icon={<PlaneTakeoff className="size-4" aria-hidden />}
        label={m.return}
        flightNo={t.return.flightNo}
        airport={t.return.departureAirport}
        at={t.return.departureAt}
        source={t.return.source}
        status={t.return.status}
      />

      <Tabs defaultValue="arrival">
        <TabsList aria-label={m.tabs.label} className="w-full">
          <TabsTrigger value="arrival">{m.tabs.arrival}</TabsTrigger>
          <TabsTrigger value="itinerary">{m.tabs.itinerary}</TabsTrigger>
          <TabsTrigger value="departure">{m.tabs.departure}</TabsTrigger>
        </TabsList>
        <TabsContent value="arrival" className="pt-2">
          <ArrivalTab tripId={tripId} areaName={t.area.nameKo} />
        </TabsContent>
        <TabsContent value="itinerary" className="pt-2">
          <ItineraryTab
            tripId={tripId}
            cityCode={t.city.code}
            outboundStatus={t.outbound.status}
            returnStatus={t.return.status}
          />
        </TabsContent>
        <TabsContent value="departure" className="pt-2">
          <DepartureTab tripId={tripId} returnStatus={t.return.status} />
        </TabsContent>
      </Tabs>

      {confirming ? (
        <div className="flex flex-col gap-2 rounded-lg border border-red-200 p-3">
          <p className="text-sm">{m.deleteConfirm}</p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              disabled={deleteTrip.isPending}
              onClick={onDelete}
            >
              {deleteTrip.isPending ? m.deleting : m.deleteYes}
            </Button>
            <Button
              variant="outline"
              disabled={deleteTrip.isPending}
              onClick={() => setConfirming(false)}
            >
              {m.deleteNo}
            </Button>
          </div>
          {deleteTrip.isError && (
            <p role="alert" className="text-sm text-red-600">
              {m.deleteError}
            </p>
          )}
        </div>
      ) : (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => setConfirming(true)}
        >
          {m.delete}
        </Button>
      )}
    </Shell>
  )
}
