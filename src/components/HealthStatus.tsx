import { CircleAlert, CircleCheck } from 'lucide-react'
import { useHealthQuery } from '@/api/health'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { messages } from '@/constants/messages'

export function HealthStatus() {
  const { data, isPending, isError, isFetching, refetch } = useHealthQuery()

  if (isPending && !isError) {
    return <Skeleton className="h-6 w-40" aria-label={messages.common.loading} />
  }

  if (isError || data?.status !== 'UP') {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-red-600">
        <CircleAlert className="size-4" aria-hidden />
        <span>{messages.health.down}</span>
        <Button size="sm" variant="outline" disabled={isFetching} onClick={() => refetch()}>
          {messages.common.retry}
        </Button>
      </div>
    )
  }

  return (
    <div role="status" className="flex items-center gap-2 text-sm text-green-700">
      <CircleCheck className="size-4" aria-hidden />
      <span>{messages.health.up}</span>
    </div>
  )
}
