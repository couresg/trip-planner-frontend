import { CircleAlert, Plus } from 'lucide-react'
import { useState } from 'react'
import { PLACE_CATEGORIES, usePlacesQuery } from '@/api/catalog'
import type { Place, PlaceCategory } from '@/api/catalog'
import type { ItineraryDay } from '@/api/itinerary'
import { isRateLimited, rateLimitedMessage } from '@/api/queryClient'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { messages } from '@/constants/messages'
import { fieldClass } from '@/features/trip-create/fieldClass'
import { dayLabel } from './dayLabel'
import { RecommendationPanel } from './RecommendationPanel'

const m = messages.itinerary
const p = m.picker

export function PlacePicker({
  tripId,
  cityCode,
  days,
  onAdd,
}: {
  tripId: string
  cityCode: string
  days: ItineraryDay[]
  onAdd: (place: Place, date: string) => void
}) {
  const [category, setCategory] = useState<PlaceCategory>()
  // 밤 비행기면 시작일에는 아직 도착 전이므로 숙소에 도착하는 날을 먼저 고른다
  const [date, setDate] = useState(
    () => days.find((d) => d.earliestStart)?.date ?? days[0].date,
  )
  const places = usePlacesQuery(cityCode, { category })

  const filters: { value: PlaceCategory | undefined; label: string }[] = [
    { value: undefined, label: p.all },
    ...PLACE_CATEGORIES.map((value) => ({ value, label: m.category[value] })),
  ]

  let list
  if (places.isError) {
    list = (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-2 text-sm text-red-600"
      >
        <CircleAlert className="size-4" aria-hidden />
        <span>
          {isRateLimited(places.error)
            ? rateLimitedMessage(places.error)
            : p.error}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={places.isFetching}
          onClick={() => places.refetch()}
        >
          {messages.common.retry}
        </Button>
      </div>
    )
  } else if (places.isPending) {
    list = (
      <div className="flex flex-col gap-2" aria-label={messages.common.loading}>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  } else if (places.data.length === 0) {
    list = <p className="text-sm text-muted-foreground">{p.empty}</p>
  } else {
    list = (
      <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {places.data.map((place) => {
          const addedTo = days
            .filter((d) => d.items.some((i) => i.place.id === place.id))
            .map((d) => m.dayNumber(d.dayIndex))
          return (
            <li
              key={place.id}
              className="flex items-center gap-2 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium wrap-break-word">{place.nameKo}</p>
                <p className="text-xs text-muted-foreground">
                  {m.category[place.category]} · {m.duration(place.durationMin)}
                </p>
                {place.summary && <p className="text-xs">{place.summary}</p>}
                {addedTo.length > 0 && (
                  <p className="text-xs font-medium text-green-800">
                    {p.addedTo(addedTo.join(', '))}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                aria-label={p.addLabel(place.nameKo)}
                onClick={() => onAdd(place, date)}
              >
                <Plus aria-hidden />
                {p.add}
              </Button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <section aria-label={p.title} className="flex flex-col gap-3">
      <h3 className="font-semibold">{p.title}</h3>
      <label className="flex flex-col gap-1 text-sm">
        {p.date}
        <select
          className={fieldClass}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        >
          {days.map((d) => (
            <option key={d.date} value={d.date}>
              {dayLabel(d)}
            </option>
          ))}
        </select>
      </label>
      <RecommendationPanel
        tripId={tripId}
        days={days}
        date={date}
        onAdd={onAdd}
      />
      <div
        role="group"
        aria-label={p.category}
        className="flex flex-wrap gap-2"
      >
        {filters.map(({ value, label }) => (
          <Button
            key={label}
            size="sm"
            variant={category === value ? 'default' : 'outline'}
            aria-pressed={category === value}
            onClick={() => setCategory(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {list}
    </section>
  )
}
