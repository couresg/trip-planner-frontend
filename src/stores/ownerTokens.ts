import { create } from 'zustand'
import { getJSON, setJSON } from '@/lib/storage'

const STORAGE_KEY = 'ownerTokens'

type Tokens = Record<string, string>

interface OwnerTokenState {
  tokens: Tokens
  getToken: (tripId: string) => string | undefined
  setToken: (tripId: string, token: string) => void
  removeToken: (tripId: string) => void
  removeTokens: (tripIds: string[]) => void
}

const readStored = () => getJSON<Tokens | null>(STORAGE_KEY, null)

export const useOwnerTokens = create<OwnerTokenState>((set, get) => {
  // 다른 탭이 쓴 토큰을 덮어쓰지 않도록 항상 저장소의 최신 값에 병합한다.
  // 저장소를 못 쓰는 환경(값 없음)에서는 메모리 상태가 기준이다.
  const latest = () => readStored() ?? get().tokens
  const save = (tokens: Tokens) => {
    setJSON(STORAGE_KEY, tokens)
    set({ tokens })
  }
  const removeTokens = (tripIds: string[]) => {
    const tokens = { ...latest() }
    for (const id of tripIds) delete tokens[id]
    save(tokens)
  }
  return {
    tokens: readStored() ?? {},
    getToken: (tripId) => get().tokens[tripId],
    setToken: (tripId, token) => save({ ...latest(), [tripId]: token }),
    removeToken: (tripId) => removeTokens([tripId]),
    removeTokens,
  }
})

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    // key === null 은 다른 탭의 localStorage.clear()
    if (event.key === STORAGE_KEY || event.key === null)
      useOwnerTokens.setState({ tokens: readStored() ?? {} })
  })
}
