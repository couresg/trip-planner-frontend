import { CircleAlert } from 'lucide-react'
import { ApiError } from '@/api/client'
import { isRateLimited } from '@/api/queryClient'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { messages } from '@/constants/messages'

export function TransfersError({
  error,
  retrying,
  onRetry,
}: {
  error?: unknown
  retrying: boolean
  onRetry: () => void
}) {
  // 여행이 삭제됐거나 권한이 없으면 다시 시도해도 성공할 수 없다
  const fatal =
    error instanceof ApiError && error.status === 403
      ? messages.tripDetail.forbidden
      : error instanceof ApiError && error.status === 404
        ? messages.tripDetail.notFound
        : null
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 text-sm text-red-600"
    >
      <CircleAlert className="size-4" aria-hidden />
      <span>
        {isRateLimited(error)
          ? messages.common.rateLimited
          : (fatal ?? messages.common.error)}
      </span>
      {!fatal && (
        <Button
          size="sm"
          variant="outline"
          disabled={retrying}
          onClick={onRetry}
        >
          {messages.common.retry}
        </Button>
      )}
    </div>
  )
}

export function TransfersSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-label={messages.common.loading}>
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
