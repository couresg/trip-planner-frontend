import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { Place } from '@/api/catalog'
import { ApiError } from '@/api/client'
import {
  addItineraryItem,
  deleteItineraryItem,
  putDayOrder,
  updateItineraryItem,
} from '@/api/itinerary'
import type { Itinerary, ItineraryDay, ItineraryItem } from '@/api/itinerary'
import { queryKeys } from '@/api/queryKeys'
import { messages } from '@/constants/messages'
import { useItineraryFailures } from '@/stores/itineraryFailures'
import { useOwnerTokens } from '@/stores/ownerTokens'
import { useTransferSettings } from '@/stores/transferSettings'
import {
  appendItem,
  applyDayOrder,
  isUnsavedItem,
  removeItem,
  removeUnsavedItems,
  replaceItem,
} from './itineraryOrder'
import type { DayOrder } from './itineraryOrder'

const m = messages.itinerary

let lastTempId = 0

/** 임시 id → 저장된 id. 임시 항목 뒤에 줄 선 순서 변경이 응답 후 실제 id를 보낼 수 있게 한다 */
const savedIds = new Map<number, number>()

const mutationOptionsOf = (tripId: string) => ({
  mutationKey: queryKeys.itineraryMutations(tripId),
  // 순서대로 처리되도록 같은 여행의 변경을 한 scope로 묶는다
  scope: { id: `itinerary:${tripId}` },
  // 기본값이면 오프라인에서 요청이 멈춰 저장된 것처럼 보인다. 바로 실패시켜 되돌린다
  networkMode: 'always' as const,
})

const failureMessage = (error: unknown, fallback: string) =>
  (error instanceof ApiError && error.code && m.errors[error.code]) || fallback

/** 탭을 옮겨 화면이 사라져도 돌아왔을 때 보이도록 store에 남긴다 */
const setFailure = (tripId: string, message: string | null) =>
  useItineraryFailures.getState().setFailure(tripId, message)

/**
 * 겹쳐서 처리 중인 변경 묶음. 뒤 변경의 스냅샷에는 앞 변경의 낙관적 상태가 들어 있어
 * 변경마다 되돌리면 유령 항목이 남으므로, 묶음의 첫 스냅샷만 두고 마지막 변경이 끝날 때 정리한다.
 * 화면이 사라져도 응답은 오므로 훅이 아니라 모듈에 둔다.
 */
interface Batch {
  queryKey: QueryKey
  previous: Itinerary | undefined
  succeeded: boolean
  failures: string[]
}

const batches = new Map<string, Batch>()

function joinBatch(
  queryClient: QueryClient,
  tripId: string,
  queryKey: QueryKey,
) {
  if (batches.has(tripId)) return
  setFailure(tripId, null)
  batches.set(tripId, {
    queryKey,
    previous: queryClient.getQueryData<Itinerary>(queryKey),
    succeeded: false,
    failures: [],
  })
}

/** failure가 null이면 성공이다. 앞선 실패가 가려지지 않게 묶음의 실패 문구를 모두 보여 준다 */
function settleBatch(
  queryClient: QueryClient,
  tripId: string,
  failure: string | null,
) {
  const batch = batches.get(tripId)
  if (batch && failure === null) batch.succeeded = true
  if (batch && failure !== null) {
    if (!batch.failures.includes(failure)) batch.failures.push(failure)
    setFailure(tripId, batch.failures.join('\n'))
  }
  // 아직 처리 중인 변경이 남았으면 되돌리거나 다시 받지 않는다. 낙관적 상태를 중간 결과로 덮어쓰기 때문이다
  if (
    queryClient.isMutating({
      mutationKey: queryKeys.itineraryMutations(tripId),
    }) > 1
  )
    return
  batches.delete(tripId)

  const queryKey = queryKeys.itineraryAll(tripId)
  if (batch && !batch.succeeded && batch.previous) {
    queryClient.setQueryData(batch.queryKey, batch.previous)
  } else {
    // 일부가 성공했으면 스냅샷은 옛 상태다. 다시 받기 결과에 맡기되, 그것도 실패할 때를 위해 저장 못 한 항목은 지금 지운다
    queryClient.setQueriesData<Itinerary>(
      { queryKey },
      (data) => data && { ...data, days: removeUnsavedItems(data.days) },
    )
  }
  // 다른 설정의 캐시는 옛 일정이므로 다시 보일 때 잠깐이라도 읽히지 않게 버린다
  queryClient.removeQueries({ queryKey, type: 'inactive' })
  void queryClient.invalidateQueries({ queryKey })
}

/** 추가·삭제·순서 변경. 화면에 먼저 반영하고 실패하면 되돌린 뒤 실패 문구를 남긴다 */
export function useItineraryMutations(tripId: string) {
  const queryClient = useQueryClient()
  const token = useOwnerTokens((s) => s.tokens[tripId])
  const immigrationMin = useTransferSettings((s) => s.immigrationMin)
  const airportBufferMin = useTransferSettings((s) => s.airportBufferMin)
  const failure = useItineraryFailures((s) => s.failures[tripId] ?? null)
  const queryKey = queryKeys.itinerary(tripId, immigrationMin, airportBufferMin)

  const setDays = (update: (days: ItineraryDay[]) => ItineraryDay[]) =>
    queryClient.setQueryData<Itinerary>(
      queryKey,
      (data) => data && { ...data, days: update(data.days) },
    )

  const optimistic = <V>(
    fallback: string,
    apply: (days: ItineraryDay[], variables: V) => ItineraryDay[],
  ) => ({
    ...mutationOptionsOf(tripId),
    onMutate: async (variables: V) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.itineraryAll(tripId),
      })
      joinBatch(queryClient, tripId, queryKey)
      setDays((days) => apply(days, variables))
    },
    onSettled: (_data: unknown, error: unknown) =>
      settleBatch(
        queryClient,
        tripId,
        error ? failureMessage(error, fallback) : null,
      ),
  })

  const add = useMutation({
    ...optimistic<{ place: Place; date: string; tempId: number }>(
      m.failed.add,
      (days, { place, date, tempId }) => {
        const unsaved: ItineraryItem = {
          itemId: tempId,
          position: 0,
          plannedTime: null,
          memo: '',
          place,
          warnings: [],
        }
        return appendItem(days, date, unsaved)
      },
    ),
    mutationFn: ({ place, date }) =>
      addItineraryItem(
        tripId,
        { placeId: place.id, date, plannedTime: null, memo: '' },
        token,
      ),
    onSuccess: (saved, { tempId }) => {
      savedIds.set(tempId, saved.itemId)
      setDays((days) =>
        replaceItem(days, tempId, {
          itemId: saved.itemId,
          position: saved.position,
          plannedTime: saved.plannedTime,
          memo: saved.memo,
          place: saved.place,
          warnings: [],
        }),
      )
    },
  })

  const remove = useMutation({
    ...optimistic<number>(m.failed.remove, removeItem),
    mutationFn: (itemId) => deleteItineraryItem(tripId, itemId, token),
  })

  const reorder = useMutation({
    ...optimistic<DayOrder>(m.failed.reorder, applyDayOrder),
    // scope 덕에 앞선 POST가 끝난 뒤 실행되므로 임시 id를 실제 id로 바꿀 수 있다. 저장에 실패한 항목은 뺀다
    mutationFn: ({ date, itemIds }) =>
      putDayOrder(
        tripId,
        date,
        itemIds.flatMap((id) =>
          isUnsavedItem(id) ? (savedIds.get(id) ?? []) : id,
        ),
        token,
      ),
  })

  return {
    add: (place: Place, date: string) =>
      add.mutate({ place, date, tempId: --lastTempId }),
    remove: (itemId: number) => remove.mutate(itemId),
    reorder: (order: DayOrder) => reorder.mutate(order),
    failure,
    clearFailure: () => {
      const batch = batches.get(tripId)
      if (batch) batch.failures = []
      setFailure(tripId, null)
    },
  }
}

/** 시각·메모 저장. 경고가 바뀌므로 낙관적으로 그리지 않고 응답 뒤 다시 받는다 */
export function useUpdateItineraryItem(tripId: string) {
  const queryClient = useQueryClient()
  const token = useOwnerTokens((s) => s.tokens[tripId])
  const immigrationMin = useTransferSettings((s) => s.immigrationMin)
  const airportBufferMin = useTransferSettings((s) => s.airportBufferMin)
  const queryKey = queryKeys.itinerary(tripId, immigrationMin, airportBufferMin)
  return useMutation({
    ...mutationOptionsOf(tripId),
    mutationFn: ({
      itemId,
      ...body
    }: {
      itemId: number
      plannedTime: string | null
      memo: string
    }) => updateItineraryItem(tripId, itemId, body, token),
    onMutate: () => joinBatch(queryClient, tripId, queryKey),
    onSettled: (_data, error) =>
      settleBatch(
        queryClient,
        tripId,
        error ? failureMessage(error, m.failed.update) : null,
      ),
  })
}
