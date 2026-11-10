import { CircleAlert, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { PLACE_CATEGORIES } from '@/api/catalog'
import type { Place, PlaceCategory } from '@/api/catalog'
import { ApiError } from '@/api/client'
import type { ItineraryDay } from '@/api/itinerary'
import { isRateLimited } from '@/api/queryClient'
import {
  normalizeCategories,
  PACES,
  usePlaceRecommendations,
} from '@/api/recommendations'
import type { Pace, RecommendationRequest } from '@/api/recommendations'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { messages } from '@/constants/messages'

const m = messages.itinerary
const r = m.recommend

const PLACES_PER_DAY: Record<Pace, number> = {
  RELAXED: 2,
  NORMAL: 3,
  PACKED: 5,
}

const sameRequest = (a: RecommendationRequest, b: RecommendationRequest) =>
  a.pace === b.pace &&
  normalizeCategories(a.categories).join() ===
    normalizeCategories(b.categories).join()

function errorMessage(error: unknown) {
  if (isRateLimited(error)) return messages.common.rateLimited
  if (error instanceof ApiError && error.code === 'RECOMMENDATION_UNAVAILABLE')
    return r.unavailable
  return r.error
}

/** 추천 결과는 고른 날짜(date)에 기존 추가 동작(onAdd)으로 넣는다. 자동 배치는 하지 않는다 */
export function RecommendationPanel({
  tripId,
  days,
  date,
  onAdd,
}: {
  tripId: string
  days: ItineraryDay[]
  date: string
  onAdd: (place: Place, date: string) => void
}) {
  const [categories, setCategories] = useState<PlaceCategory[]>([])
  const [pace, setPace] = useState<Pace>('NORMAL')
  const [request, setRequest] = useState<RecommendationRequest | null>(null)
  const result = usePlaceRecommendations(tripId, request)

  const toggle = (category: PlaceCategory) =>
    setCategories((current) =>
      current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category],
    )

  const submit = () => {
    const next = { categories, pace }
    // 같은 조건이면 캐시를 그대로 보여주지 않고 다시 받는다 (그사이 일정이 바뀌었을 수 있다)
    if (request && sameRequest(request, next)) void result.refetch()
    else setRequest(next)
  }

  let body = null
  if (request && result.isError) {
    body = (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-2 text-sm text-red-600"
      >
        <CircleAlert className="size-4" aria-hidden />
        <span>{errorMessage(result.error)}</span>
        <Button
          size="sm"
          variant="outline"
          disabled={result.isFetching}
          onClick={() => result.refetch()}
        >
          {messages.common.retry}
        </Button>
      </div>
    )
  } else if (request && (result.isPending || result.isFetching)) {
    body = (
      <div className="flex flex-col gap-2" aria-label={messages.common.loading}>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  } else if (result.data && result.data.recommendations.length === 0) {
    body = <p className="text-sm text-muted-foreground">{r.empty}</p>
  } else if (result.data) {
    body = (
      <ol aria-label={r.results} className="flex flex-col gap-2">
        {result.data.recommendations.map(({ rank, reason, place }) => {
          const addedTo = days
            .filter((d) => d.items.some((i) => i.place.id === place.id))
            .map((d) => m.dayNumber(d.dayIndex))
          return (
            <li
              key={place.id}
              className="flex items-center gap-2 rounded-lg border p-3"
            >
              <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                {r.rank(rank)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium wrap-break-word">{place.nameKo}</p>
                <p className="text-xs text-muted-foreground">
                  {m.category[place.category]} · {m.duration(place.durationMin)}
                </p>
                <p className="text-xs wrap-break-word">{reason}</p>
                {addedTo.length > 0 && (
                  <p className="text-xs font-medium text-green-800">
                    {m.picker.addedTo(addedTo.join(', '))}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                aria-label={r.addLabel(rank, place.nameKo)}
                onClick={() => onAdd(place, date)}
              >
                <Plus aria-hidden />
                {m.picker.add}
              </Button>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <section
      aria-label={r.title}
      className="flex flex-col gap-3 rounded-lg border border-dashed p-3"
    >
      <h4 className="flex items-center gap-1 font-semibold">
        <Sparkles className="size-4" aria-hidden />
        {r.title}
      </h4>
      <div
        role="group"
        aria-label={r.categories}
        className="flex flex-wrap gap-2"
      >
        {PLACE_CATEGORIES.map((category) => {
          const on = categories.includes(category)
          return (
            <Button
              key={category}
              size="sm"
              variant={on ? 'default' : 'outline'}
              aria-pressed={on}
              aria-label={r.categoryLabel(m.category[category])}
              onClick={() => toggle(category)}
            >
              {m.category[category]}
            </Button>
          )
        })}
      </div>
      <div
        role="radiogroup"
        aria-label={r.pace}
        className="flex flex-wrap gap-2"
      >
        {PACES.map((value) => (
          <Button
            key={value}
            size="sm"
            role="radio"
            variant={pace === value ? 'default' : 'outline'}
            aria-checked={pace === value}
            onClick={() => setPace(value)}
          >
            {r.paceOption[value]} ({r.perDay(PLACES_PER_DAY[value])})
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={categories.length === 0 || result.isFetching}
          onClick={submit}
        >
          {r.submit}
        </Button>
        {categories.length === 0 && (
          <span className="text-xs text-muted-foreground">
            {r.needCategory}
          </span>
        )}
      </div>
      {result.data && !result.isError && (
        <p className="text-xs text-muted-foreground">{r.basis}</p>
      )}
      {body}
    </section>
  )
}
