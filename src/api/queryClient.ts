import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './client'

/** 429(요청 제한)는 다시 보내도 더 막힐 뿐이라 자동 재시도하지 않는다 */
export function isRateLimited(error: unknown) {
  return error instanceof ApiError && error.status === 429
}

/** 쿼리 재시도 규칙. 4xx(429 포함)는 다시 보내도 같은 결과라 즉시 포기하고, 나머지는 기본(최대 3회)을 따른다. 변경(POST/DELETE)은 재전송하면 중복될 수 있어 재시도하지 않는다 */
export function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500)
    return false
  return failureCount < 3
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry },
      mutations: { retry: false },
    },
  })
}
