import { describe, expect, it } from 'vitest'
import { useOwnerTokens } from './ownerTokens'

const stored = () => JSON.parse(localStorage.getItem('ownerTokens') ?? '{}')

describe('useOwnerTokens across tabs', () => {
  it('keeps a token another tab wrote when setting a new one', () => {
    useOwnerTokens.getState().setToken('mine', 'tok-mine')
    // 다른 탭이 이 탭 모르게 저장소에 토큰을 추가
    localStorage.setItem(
      'ownerTokens',
      JSON.stringify({ ...stored(), other: 'tok-other' }),
    )

    useOwnerTokens.getState().setToken('mine2', 'tok-mine2')

    expect(stored()).toEqual({
      mine: 'tok-mine',
      other: 'tok-other',
      mine2: 'tok-mine2',
    })
    expect(useOwnerTokens.getState().tokens).toEqual(stored())
  })

  it('keeps another tab token when removing one', () => {
    useOwnerTokens.getState().setToken('mine', 'tok-mine')
    localStorage.setItem(
      'ownerTokens',
      JSON.stringify({ ...stored(), other: 'tok-other' }),
    )

    useOwnerTokens.getState().removeToken('mine')

    expect(stored()).toEqual({ other: 'tok-other' })
    expect(useOwnerTokens.getState().tokens).toEqual({ other: 'tok-other' })
  })

  it('refreshes state on a storage event for its key', () => {
    localStorage.setItem('ownerTokens', JSON.stringify({ other: 'tok-other' }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' }))
    expect(useOwnerTokens.getState().tokens).toEqual({})

    window.dispatchEvent(new StorageEvent('storage', { key: 'ownerTokens' }))
    expect(useOwnerTokens.getState().tokens).toEqual({ other: 'tok-other' })
  })
})
