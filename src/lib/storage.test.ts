import { afterEach, describe, expect, it, vi } from 'vitest'
import { getItem, getJSON, removeItem, setItem, setJSON } from './storage'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('storage', () => {
  it('roundtrips strings and JSON', () => {
    expect(setItem('a', 'b')).toBe(true)
    expect(getItem('a')).toBe('b')
    expect(setJSON('j', { x: 1 })).toBe(true)
    expect(getJSON('j', null)).toEqual({ x: 1 })
    removeItem('a')
    expect(getItem('a')).toBeNull()
  })

  it('returns fallback for missing or corrupt JSON', () => {
    expect(getJSON('missing', 42)).toBe(42)
    localStorage.setItem('bad', '{oops')
    expect(getJSON('bad', 'fb')).toBe('fb')
  })

  it('does not throw when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(setItem('a', 'b')).toBe(false)
    expect(setJSON('a', 1)).toBe(false)
  })

  it('does not throw when getItem/removeItem throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(getItem('a')).toBeNull()
    expect(getJSON('a', 1)).toBe(1)
    expect(() => removeItem('a')).not.toThrow()
  })
})
