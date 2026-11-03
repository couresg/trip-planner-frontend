import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type {
  Announcements,
  DragEndEvent,
  UniqueIdentifier,
} from '@dnd-kit/core'
import { useEffect, useState } from 'react'
import type { Itinerary } from '@/api/itinerary'
import { messages } from '@/constants/messages'
import { dayLabel } from './dayLabel'
import { DayColumn } from './DayColumn'
import {
  dayDroppableId,
  orderForDrop,
  orderForMoveToDate,
  orderForShift,
} from './itineraryOrder'
import type { DayOrder } from './itineraryOrder'
import { createKeyboardNavigation } from './keyboardNavigation'

const m = messages.itinerary

export function ItineraryBoard({
  tripId,
  itinerary,
  onReorder,
  onRemove,
}: {
  tripId: string
  itinerary: Itinerary
  onReorder: (order: DayOrder) => void
  onRemove: (itemId: number) => void
}) {
  const { days, timezone, returnMarginMin } = itinerary
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [keyboard] = useState(createKeyboardNavigation)
  useEffect(() => keyboard.setDays(days), [keyboard, days])
  // MouseSensor는 터치에 반응하지 않아 터치 드래그는 길게 누르기로만 시작한다
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: keyboard.coordinateGetter,
    }),
  )

  const items = days.flatMap((d) => d.items)
  const nameOf = (id: UniqueIdentifier) =>
    items.find((i) => i.itemId === id)?.place.nameKo ?? ''
  const targetOf = (id: UniqueIdentifier) => {
    const day = days.find((d) => dayDroppableId(d.date) === id)
    return day ? dayLabel(day) : nameOf(id)
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => m.dnd.start(nameOf(active.id)),
    onDragOver: ({ active, over }) =>
      over ? m.dnd.over(nameOf(active.id), targetOf(over.id)) : undefined,
    onDragEnd: ({ active, over }) =>
      over ? m.dnd.end(nameOf(active.id), targetOf(over.id)) : undefined,
    onDragCancel: ({ active }) => m.dnd.cancel(nameOf(active.id)),
  }

  const onDragCancel = () => {
    setActiveId(null)
    keyboard.reset()
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    onDragCancel()
    if (!over || typeof active.id !== 'number') return
    const order = orderForDrop(days, active.id, over.id)
    if (order) onReorder(order)
  }

  const onShift = (date: string, itemId: number, delta: -1 | 1) => {
    const day = days.find((d) => d.date === date)
    const order = day && orderForShift(day, itemId, delta)
    if (order) onReorder(order)
  }

  const onMoveToDate = (itemId: number, date: string) => {
    const order = orderForMoveToDate(days, itemId, date)
    if (order) onReorder(order)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={keyboard.collisionDetection}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: m.dnd.instructions },
      }}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="flex flex-col gap-3">
        {days.map((day) => (
          <DayColumn
            key={day.date}
            tripId={tripId}
            day={day}
            days={days}
            timezone={timezone}
            returnMarginMin={returnMarginMin}
            onShift={onShift}
            onMoveToDate={onMoveToDate}
            onRemove={onRemove}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeId !== null && (
          <div className="rounded-lg border bg-background p-3 font-medium shadow-lg">
            {nameOf(activeId)}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
