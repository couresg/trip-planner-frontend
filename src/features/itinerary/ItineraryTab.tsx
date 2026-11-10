import { CircleAlert, X } from 'lucide-react'
import { isCanceledStatus } from '@/api/flights'
import { useItinerary } from '@/api/itinerary'
import { useRefreshTripDetail } from '@/api/trips'
import { Button } from '@/components/ui/button'
import { messages } from '@/constants/messages'
import { CanceledBanner } from '@/features/transfer/CanceledBanner'
import {
  TransfersError,
  TransfersSkeleton,
} from '@/features/transfer/TransfersState'
import { useTransferSettings } from '@/stores/transferSettings'
import { ItineraryBoard } from './ItineraryBoard'
import { PlacePicker } from './PlacePicker'
import { useItineraryMutations } from './useItineraryMutations'

const m = messages.itinerary

export function ItineraryTab({
  tripId,
  cityCode,
  returnStatus,
}: {
  tripId: string
  cityCode: string
  returnStatus: string | null
}) {
  const immigrationMin = useTransferSettings((s) => s.immigrationMin)
  const airportBufferMin = useTransferSettings((s) => s.airportBufferMin)
  const itinerary = useItinerary(tripId, immigrationMin, airportBufferMin)
  // 일정 GET도 두 편을 재조회한다. 결과 필드가 없어 받을 때마다 여행 상세(결항 status)를 다시 받는다
  useRefreshTripDetail(tripId, itinerary.isSuccess, itinerary.dataUpdatedAt)
  const { add, remove, reorder, failure, clearFailure } =
    useItineraryMutations(tripId)

  return (
    <div className="flex flex-col gap-4">
      {isCanceledStatus(returnStatus) && <CanceledBanner />}
      {/* 긴 일정 아래쪽에서 실패해도 보이게 화면에 고정한다. 흐름에서 빠지므로 빈자리도, 나타날 때 내용이 밀리는 일도 없다 */}
      {failure && (
        <div
          role="alert"
          data-floating-banner
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800 shadow-lg"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 whitespace-pre-line">{failure}</p>
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-10 md:size-6"
            aria-label={m.dismiss}
            onClick={clearFailure}
          >
            <X aria-hidden />
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {m.basis(
          immigrationMin,
          messages.departure.airportBufferOption(airportBufferMin),
        )}
      </p>
      {itinerary.data && (
        <p className="text-xs text-muted-foreground">
          {m.returnMarginEstimate(itinerary.data.returnMarginMin)}
        </p>
      )}
      {/* 변경 뒤 다시 받기가 실패해도 보던 일정은 남긴다 */}
      {itinerary.isError && (
        <TransfersError
          error={itinerary.error}
          retrying={itinerary.isFetching}
          onRetry={() => itinerary.refetch()}
        />
      )}
      {itinerary.isPending && !itinerary.isError && <TransfersSkeleton />}
      {itinerary.data && (
        <>
          <PlacePicker
            cityCode={cityCode}
            days={itinerary.data.days}
            onAdd={add}
          />
          <ItineraryBoard
            tripId={tripId}
            itinerary={itinerary.data}
            onReorder={reorder}
            onRemove={remove}
          />
        </>
      )}
    </div>
  )
}
