import { create } from 'zustand'
import { getJSON, setJSON } from '@/lib/storage'

const STORAGE_KEY = 'ownerTokens'

interface OwnerTokenState {
  tokens: Record<string, string>
  getToken: (tripId: string) => string | undefined
  setToken: (tripId: string, token: string) => void
  removeToken: (tripId: string) => void
}

export const useOwnerTokens = create<OwnerTokenState>((set, get) => ({
  tokens: getJSON<Record<string, string>>(STORAGE_KEY, {}),
  getToken: (tripId) => get().tokens[tripId],
  setToken: (tripId, token) => {
    const tokens = { ...get().tokens, [tripId]: token }
    setJSON(STORAGE_KEY, tokens)
    set({ tokens })
  },
  removeToken: (tripId) => {
    const { [tripId]: _removed, ...tokens } = get().tokens
    void _removed
    setJSON(STORAGE_KEY, tokens)
    set({ tokens })
  },
}))
