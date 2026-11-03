import { act, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ItineraryItem } from '@/api/itinerary'
import { DayMap } from './DayMap'

const maps = vi.hoisted(() => ({
  status: 'LOADED',
  fitBounds: vi.fn(),
  providerKeys: [] as string[],
}))

// jsdom에서는 Google Maps를 로드할 수 없어 라이브러리 경계만 대체한다
vi.mock('@vis.gl/react-google-maps', () => ({
  APILoadingStatus: {
    NOT_LOADED: 'NOT_LOADED',
    LOADING: 'LOADING',
    LOADED: 'LOADED',
    FAILED: 'FAILED',
    AUTH_FAILURE: 'AUTH_FAILURE',
  },
  APIProvider: ({
    apiKey,
    children,
  }: {
    apiKey: string
    children: ReactNode
  }) => {
    maps.providerKeys.push(apiKey)
    return <>{children}</>
  },
  Map: ({
    children,
    reuseMaps,
  }: {
    children: ReactNode
    reuseMaps?: boolean
  }) => (
    <div data-testid="map" data-reuse={reuseMaps}>
      {children}
    </div>
  ),
  Marker: ({ title, label }: { title: string; label: { text: string } }) => (
    <div data-testid="marker">{`${label.text}:${title}`}</div>
  ),
  Polyline: ({ path }: { path: { lat: number; lng: number }[] }) => (
    <div data-testid="polyline">{JSON.stringify(path)}</div>
  ),
  useApiLoadingStatus: () => maps.status,
  useMap: () => ({ fitBounds: maps.fitBounds }),
}))

const item = (
  itemId: number,
  nameKo: string,
  lat: number,
  lng: number,
): ItineraryItem => ({
  itemId,
  position: 0,
  plannedTime: null,
  memo: '',
  place: { id: itemId, nameKo, category: 'SIGHT', lat, lng, durationMin: 60 },
  warnings: [],
})

const items = [
  item(2, '오사카성', 34.6873, 135.5262),
  item(1, '도톤보리', 34.6687, 135.5013),
]

const stopList = () =>
  within(screen.getByRole('list', { name: '방문 순서' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent)

describe('DayMap', () => {
  beforeEach(() => {
    maps.status = 'LOADED'
    maps.fitBounds.mockClear()
    maps.providerKeys.length = 0
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('shows a notice and the numbered list when no key is set, without loading Maps', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', '')
    render(<DayMap items={items} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      '지도 키가 설정되지 않아',
    )
    expect(stopList()).toEqual(['1오사카성', '2도톤보리'])
    expect(screen.queryByTestId('map')).not.toBeInTheDocument()
    expect(maps.providerKeys).toEqual([])
  })

  it('draws numbered markers and a line in day order, and says the line is straight', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
    render(<DayMap items={items} />)

    expect(maps.providerKeys[0]).toBe('test-key')
    expect(screen.getByTestId('map')).toHaveAttribute('data-reuse', 'true')
    expect(screen.getAllByTestId('marker').map((e) => e.textContent)).toEqual([
      '1:오사카성',
      '2:도톤보리',
    ])
    expect(JSON.parse(screen.getByTestId('polyline').textContent)).toEqual([
      { lat: 34.6873, lng: 135.5262 },
      { lat: 34.6687, lng: 135.5013 },
    ])
    expect(screen.getByText(/직선이며 실제 이동 경로가 아니에요/)).toBeVisible()
    expect(stopList()).toEqual(['1오사카성', '2도톤보리'])
    expect(maps.fitBounds).toHaveBeenCalled()
  })

  it('draws no line for a single stop', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
    render(<DayMap items={[items[0]]} />)
    expect(screen.getAllByTestId('marker')).toHaveLength(1)
    expect(screen.queryByTestId('polyline')).not.toBeInTheDocument()
  })

  it.each(['FAILED', 'AUTH_FAILURE'])(
    'falls back to the notice and the list when loading ends in %s',
    (status) => {
      vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'bad-key')
      maps.status = status
      render(<DayMap items={items} />)

      expect(screen.getByRole('status')).toHaveTextContent(
        '지도를 불러오지 못했어요',
      )
      expect(screen.queryByTestId('map')).not.toBeInTheDocument()
      expect(stopList()).toEqual(['1오사카성', '2도톤보리'])
    },
  )

  it('says so for an empty day, even with a key', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
    render(<DayMap items={[]} />)
    expect(screen.getByText('지도에 표시할 일정이 없어요.')).toBeVisible()
    expect(maps.providerKeys).toEqual([])
  })

  // 인증 실패는 페이지 전체에 남으므로 이 파일의 마지막 테스트로 둔다
  it('swaps the map for the notice when Google rejects the key, also for maps opened later', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'rejected-key')
    const { unmount } = render(<DayMap items={items} />)
    expect(screen.getByTestId('map')).toBeInTheDocument()

    act(() => window.gm_authFailure?.())
    expect(screen.getByRole('status')).toHaveTextContent(
      '지도를 불러오지 못했어요',
    )
    expect(screen.queryByTestId('map')).not.toBeInTheDocument()
    expect(stopList()).toEqual(['1오사카성', '2도톤보리'])

    unmount()
    render(<DayMap items={items} />)
    expect(screen.queryByTestId('map')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      '지도를 불러오지 못했어요',
    )
  })
})
