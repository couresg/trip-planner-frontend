import { ChevronRight, CircleAlert, Plane } from 'lucide-react'
import { Link } from 'react-router'
import { useTrips } from '@/api/trips'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { messages } from '@/constants/messages'

const m = messages.tripList

export function TripList() {
  const { data, isPending, isError, isFetching, refetch } = useTrips()

  return (
    <section className="flex flex-col gap-2" aria-labelledby="trip-list-title">
      <h2 id="trip-list-title" className="text-lg font-semibold">
        {m.title}
      </h2>
      {isPending ? (
        <div
          className="flex flex-col gap-2"
          aria-label={messages.common.loading}
        >
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 text-sm text-red-600"
        >
          <CircleAlert className="size-4" aria-hidden />
          <span>{m.error}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            {messages.common.retry}
          </Button>
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{m.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((trip) => (
            <li key={trip.tripId}>
              <Link
                to={`/trips/${trip.tripId}`}
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium">
                    {trip.city.nameKo} · {trip.area.nameKo}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {trip.startDate} ~ {trip.endDate}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Plane className="size-3" aria-hidden />
                    {trip.outboundFlightNo} / {trip.returnFlightNo}
                  </span>
                </div>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
