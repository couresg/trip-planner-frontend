import { create } from 'zustand'

interface ItineraryFailuresState {
  /** 여행별 마지막 일정 변경 실패 문구 */
  failures: Record<string, string>
  setFailure: (tripId: string, message: string | null) => void
}

export const useItineraryFailures = create<ItineraryFailuresState>((set) => ({
  failures: {},
  setFailure: (tripId, message) =>
    set(({ failures }) => {
      const next = { ...failures }
      if (message) next[tripId] = message
      else delete next[tripId]
      return { failures: next }
    }),
}))
