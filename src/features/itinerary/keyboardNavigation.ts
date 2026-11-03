import { closestCenter, pointerWithin } from '@dnd-kit/core'
import type {
  CollisionDetection,
  KeyboardCoordinateGetter,
  UniqueIdentifier,
} from '@dnd-kit/core'
import type { ItineraryDay } from '@/api/itinerary'
import { keyboardTarget } from './itineraryOrder'

const DELTAS: Record<string, -1 | 1> = { ArrowUp: -1, ArrowDown: 1 }

/**
 * 키보드 드래그는 화면 좌표로 목적지를 고르면 날짜 영역과 항목이 겹쳐 결과가 들쭉날쭉하다.
 * keyboardTarget이 정한 자리를 기억해 충돌 판정에서 그대로 돌려준다.
 */
export function createKeyboardNavigation() {
  let days: ItineraryDay[] = []
  let target: UniqueIdentifier | null = null

  const coordinateGetter: KeyboardCoordinateGetter = (
    event,
    { active, context: { collisionRect, droppableRects } },
  ) => {
    const delta = DELTAS[event.code]
    if (!delta) return undefined
    event.preventDefault()
    if (typeof active !== 'number') return undefined
    const next = keyboardTarget(days, active, target ?? active, delta)
    const rect = next === null ? undefined : droppableRects.get(next)
    if (next === null || !rect || !collisionRect) return undefined
    target = next
    return {
      x: rect.left,
      // 날짜 영역은 그 날짜의 맨 뒤라는 뜻이다
      y:
        typeof next === 'string'
          ? rect.bottom - collisionRect.height
          : rect.top,
    }
  }

  /** 포인터 아래 항목을 먼저, 없으면 날짜 영역을 고른다 */
  const collisionDetection: CollisionDetection = (args) => {
    if (args.pointerCoordinates) {
      const hits = pointerWithin(args)
      const items = hits.filter((hit) => typeof hit.id === 'number')
      return items.length > 0 ? items : hits
    }
    const id = target ?? args.active.id
    const droppableContainer = args.droppableContainers.find((c) => c.id === id)
    return droppableContainer
      ? [{ id, data: { droppableContainer, value: 0 } }]
      : closestCenter(args)
  }

  return {
    coordinateGetter,
    collisionDetection,
    setDays: (next: ItineraryDay[]) => {
      days = next
    },
    reset: () => {
      target = null
    },
  }
}
