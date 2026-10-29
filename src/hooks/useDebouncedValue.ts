import { useEffect, useState } from 'react'

/** 입력이 delayMs 동안 멈췄을 때만 값을 갱신한다 (타이핑 중 외부 API 조회 방지). */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
