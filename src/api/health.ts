import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import { queryKeys } from './queryKeys'

export interface Health {
  status: string
}

export const getHealth = () => apiFetch<Health>('/health')

export function useHealthQuery() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: getHealth,
    retry: false,
  })
}
