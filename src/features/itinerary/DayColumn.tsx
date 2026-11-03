import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Map as MapIcon } from 'lucide-react'
import { useState } from 'react'
import type { ItineraryDay } from '@/api/itinerary'
import { Button } from '@/components/ui/button'
import { messages } from '@/constants/messages'
import { formatLocal } from '@/lib/time'
import { cn } from '@/lib/utils'
import { DayMap } from './DayMap'
import { dayLabel } from './dayLabel'
import { dayDroppableId } from './itineraryOrder'
import { ItineraryItemCard } from './ItineraryItemCard'

const m = messages.itinerary

export function DayColumn({
  tripId,
  day,
  days,
  timezone,
  returnMarginMin,
  onShift,
  onMoveToDate,
  onRemove,
}: {
  tripId: string
  day: ItineraryDay
  days: ItineraryDay[]
  timezone: string
  returnMarginMin: number
  onShift: (date: string, itemId: number, delta: -1 | 1) => void
  onMoveToDate: (itemId: number, date: string) => void
  onRemove: (itemId: number) => void
}) {
  const [mapOpen, setMapOpen] = useState(false)
  const id = dayDroppableId(day.date)
  const { setNodeRef, over } = useDroppable({ id })
  const highlighted =
    over !== null &&
    (over.id === id || day.items.some((i) => i.itemId === over.id))
  const label = dayLabel(day)

  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-3',
        highlighted && 'ring-2 ring-primary',
      )}
    >
      <header className="flex flex-col gap-1">
        <h3 className="font-semibold">{label}</h3>
        {day.earliestStart && (
          <p className="text-sm text-muted-foreground">
            {m.earliestStart(formatLocal(day.earliestStart, timezone))}
          </p>
        )}
        {day.latestEnd && (
          <p className="text-sm font-medium text-green-900">
            {m.latestEnd(formatLocal(day.latestEnd, timezone))}
          </p>
        )}
      </header>

      <SortableContext
        id={id}
        items={day.items.map((i) => i.itemId)}
        strategy={verticalListSortingStrategy}
      >
        {day.items.length > 0 ? (
          <ol aria-label={m.dayItems(label)} className="flex flex-col gap-2">
            {day.items.map((item, index) => (
              <ItineraryItemCard
                key={item.itemId}
                tripId={tripId}
                item={item}
                number={index + 1}
                isLast={index === day.items.length - 1}
                date={day.date}
                days={days}
                returnMarginMin={returnMarginMin}
                onShift={(itemId, delta) => onShift(day.date, itemId, delta)}
                onMoveToDate={onMoveToDate}
                onRemove={onRemove}
              />
            ))}
          </ol>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            {m.emptyDay}
          </p>
        )}
      </SortableContext>

      <Button
        variant="outline"
        size="sm"
        className="self-start"
        aria-expanded={mapOpen}
        onClick={() => setMapOpen((open) => !open)}
      >
        <MapIcon aria-hidden />
        {mapOpen ? m.map.close : m.map.open}
      </Button>
      {mapOpen && <DayMap items={day.items} />}
    </section>
  )
}
