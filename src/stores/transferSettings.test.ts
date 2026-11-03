import { afterEach, describe, expect, it, vi } from 'vitest'

/** 새로고침처럼 모듈을 다시 읽어 저장소에서 초기값을 복원한다 */
const reload = async () => {
  vi.resetModules()
  const { useTransferSettings } = await import('./transferSettings')
  return useTransferSettings
}

describe('airport buffer persistence', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to 120 when nothing is stored', async () => {
    expect((await reload()).getState().airportBufferMin).toBe(120)
  })

  it('restores the chosen buffer after a reload', async () => {
    const before = await reload()
    before.getState().setAirportBufferMin(180)
    expect(before.getState().airportBufferMin).toBe(180)

    expect((await reload()).getState().airportBufferMin).toBe(180)
  })

  it.each(['999', '"150"', '[150]', 'null', 'not json', ''])(
    'falls back to 120 for the invalid stored value %j',
    async (stored) => {
      localStorage.setItem('airportBufferMin', stored)
      expect((await reload()).getState().airportBufferMin).toBe(120)
    },
  )

  it('keeps working when storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const store = await reload()
    expect(store.getState().airportBufferMin).toBe(120)

    store.getState().setAirportBufferMin(150)
    expect(store.getState().airportBufferMin).toBe(150)
  })
})
