import { CircleAlert, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { PLACE_CATEGORIES } from '@/api/catalog'
import type { Place, PlaceCategory } from '@/api/catalog'
import { ApiError } from '@/api/client'
import type { ItineraryDay } from '@/api/itinerary'
import { isRateLimited, rateLimitedMessage } from '@/api/queryClient'
import { PACES, usePlaceRecommendations } from '@/api/recommendations'
import type { Pace, RecommendationRequest } from '@/api/recommendations'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { messages } from '@/constants/messages'
import { cn } from '@/lib/utils'
import { useOwnerTokens } from '@/stores/ownerTokens'

const m = messages.itinerary
const r = m.recommend

/**
 * 추천을 받기 전에 선택지에 보여줄 하루 장소 수. 백엔드 Pace.java(RELAXED 2 / NORMAL 3 / PACKED 5)와 같아야 한다.
 * 결과의 개수 계산은 서버가 하고 응답의 placesPerDay가 기준이다.
 */
const PLACES_PER_DAY: Record<Pace, number> = {
  RELAXED: 2,
  NORMAL: 3,
  PACKED: 5,
}

function errorMessage(error: unknown) {
  if (isRateLimited(error)) return rateLimitedMessage(error)
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
  const [submission, setSubmission] = useState(0)
  const hasToken = useOwnerTokens((s) => !!s.tokens[tripId])
  const result = usePlaceRecommendations(tripId, request, submission)
  const targetDay = days.find((d) => d.date === date)
  const targetLabel = targetDay ? m.dayNumber(targetDay.dayIndex) : date

  const toggle = (category: PlaceCategory) =>
    setCategories((current) =>
      current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category],
    )

  // 누를 때마다 새 키로 받는다 (예전 조건으로 돌아와도 그사이 일정에 넣은 장소가 빠진 결과)
  const submit = () => {
    setRequest({ categories, pace })
    setSubmission((n) => n + 1)
  }

  let body = null
  if (request && !hasToken) {
    // 토큰이 없으면 쿼리가 꺼져 있어 로딩만 계속 보이므로 이유를 알려준다
    body = (
      <p role="alert" className="text-sm text-red-600">
        {r.noToken}
      </p>
    )
  } else if (request && result.isError) {
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
                aria-label={r.addLabel(rank, place.nameKo, targetLabel)}
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
      {/* 네이티브 라디오: 화살표 키 이동·탭 한 번 진입을 브라우저가 처리한다 */}
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">{r.pace}</legend>
        {PACES.map((value) => (
          <label
            key={value}
            className={cn(
              'inline-flex cursor-pointer items-center rounded-md border px-3 py-1 text-sm font-medium has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50',
              pace === value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-background',
            )}
          >
            <input
              type="radio"
              name={`recommend-pace-${tripId}`}
              value={value}
              className="sr-only"
              checked={pace === value}
              onChange={() => setPace(value)}
            />
            {r.paceOption[value]} ({r.perDay(PLACES_PER_DAY[value])})
          </label>
        ))}
      </fieldset>
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
