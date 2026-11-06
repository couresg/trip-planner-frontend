import { CircleAlert } from 'lucide-react'
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
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 text-sm text-red-600"
    >
      <CircleAlert className="size-4" aria-hidden />
      <span>
        {isRateLimited(error)
          ? messages.common.rateLimited
          : messages.common.error}
      </span>
      <Button size="sm" variant="outline" disabled={retrying} onClick={onRetry}>
        {messages.common.retry}
      </Button>
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
