import { useSortable } from '@dnd-kit/sortable'
import {
  ArrowDown,
  ArrowUp,
  Clock,
  GripVertical,
  Pencil,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import type { ItineraryDay, ItineraryItem } from '@/api/itinerary'
import { Button } from '@/components/ui/button'
import { messages } from '@/constants/messages'
import { fieldClass } from '@/features/trip-create/fieldClass'
import { cn } from '@/lib/utils'
import { dayLabel } from './dayLabel'
import { isUnsavedItem } from './itineraryOrder'
import { useUpdateItineraryItem } from './useItineraryMutations'

const m = messages.itinerary

const MEMO_MAX_LENGTH = 500

function ItemEditor({
  tripId,
  item,
  onClose,
}: {
  tripId: string
  item: ItineraryItem
  onClose: () => void
}) {
  const [plannedTime, setPlannedTime] = useState(item.plannedTime ?? '')
  const [memo, setMemo] = useState(item.memo)
  const update = useUpdateItineraryItem(tripId)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    update.mutate(
      { itemId: item.itemId, plannedTime: plannedTime || null, memo },
      { onSuccess: onClose },
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        {m.plannedTime}
        <input
          type="time"
          className={fieldClass}
          value={plannedTime}
          onChange={(e) => setPlannedTime(e.target.value)}
        />
      </label>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        disabled={!plannedTime}
        onClick={() => setPlannedTime('')}
      >
        {m.clearTime}
      </Button>
      <label className="flex flex-col gap-1 text-sm">
        {m.memo}
        <textarea
          rows={3}
          maxLength={MEMO_MAX_LENGTH}
          className={cn(fieldClass, 'h-auto py-2')}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </label>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!memo}
          onClick={() => setMemo('')}
        >
          {m.clearMemo}
        </Button>
        <span className="text-xs text-muted-foreground">
          {memo.length}/{MEMO_MAX_LENGTH}
        </span>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={update.isPending}>
          {update.isPending ? m.saving : m.save}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={update.isPending}
          onClick={onClose}
        >
          {m.cancel}
        </Button>
      </div>
    </form>
  )
}

export function ItineraryItemCard({
  tripId,
  item,
  number,
  isLast,
  date,
  days,
  returnMarginMin,
  onShift,
  onMoveToDate,
  onRemove,
}: {
  tripId: string
  item: ItineraryItem
  number: number
  isLast: boolean
  date: string
  days: ItineraryDay[]
  returnMarginMin: number
  onShift: (itemId: number, delta: -1 | 1) => void
  onMoveToDate: (itemId: number, date: string) => void
  onRemove: (itemId: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const unsaved = isUnsavedItem(item.itemId)
  const name = item.place.nameKo
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    activeIndex,
  } = useSortable({
    id: item.itemId,
    disabled: unsaved,
    attributes: { roleDescription: m.dnd.roleDescription },
  })

  return (
    <li
      ref={setNodeRef}
      aria-label={name}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
      }}
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-background p-3',
        isDragging && 'opacity-40',
        // 다른 날짜에서 온 항목은 이 항목 앞에 들어간다
        isOver && activeIndex === -1 && 'border-t-4 border-t-primary',
      )}
    >
      <div className="flex items-start gap-2">
        {/* 터치는 길게 눌러야 시작하므로 손잡이에서 시작한 스크롤은 막지 않는다 */}
        <Button
          ref={setActivatorNodeRef}
          variant="ghost"
          size="icon"
          disabled={unsaved}
          className="cursor-grab touch-manipulation select-none"
          {...attributes}
          {...listeners}
          aria-label={m.dragHandle(name)}
        >
          <GripVertical aria-hidden />
        </Button>
        <span
          aria-hidden
          className="mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          {number}
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <p className="font-medium wrap-break-word">{name}</p>
          <p className="text-xs text-muted-foreground">
            {m.category[item.place.category]} ·{' '}
            {m.duration(item.place.durationMin)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={unsaved}
          aria-label={m.remove(name)}
          onClick={() => onRemove(item.itemId)}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>

      <p className="flex items-center gap-1 text-sm">
        <Clock className="size-4 shrink-0" aria-hidden />
        <span className="tabular-nums">{item.plannedTime ?? m.noTime}</span>
      </p>
      {item.memo && (
        <p className="text-sm wrap-break-word whitespace-pre-wrap">
          {item.memo}
        </p>
      )}
      {item.warnings.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-amber-900">
          {item.warnings.map((warning) => (
            <li key={warning} className="flex gap-1">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {m.warnings(returnMarginMin)[warning] ?? warning}
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <ItemEditor
          tripId={tripId}
          item={item}
          onClose={() => setEditing(false)}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={unsaved || number === 1}
            aria-label={m.moveUp(name)}
            onClick={() => onShift(item.itemId, -1)}
          >
            <ArrowUp aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={unsaved || isLast}
            aria-label={m.moveDown(name)}
            onClick={() => onShift(item.itemId, 1)}
          >
            <ArrowDown aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-9"
            disabled={unsaved}
            aria-label={m.edit(name)}
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden />
            {m.editLabel}
          </Button>
          {/* 375px에서 날짜 문구가 잘리지 않도록 한 줄을 다 쓴다 */}
          <select
            aria-label={m.moveToDate(name)}
            className={cn(fieldClass, 'h-9 basis-full px-2')}
            disabled={unsaved}
            value={date}
            onChange={(e) => onMoveToDate(item.itemId, e.target.value)}
          >
            {days.map((d) => (
              <option key={d.date} value={d.date}>
                {dayLabel(d)}
              </option>
            ))}
          </select>
        </div>
      )}
    </li>
  )
}
