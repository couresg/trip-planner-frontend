import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { createTrip, getTrip } from '@/api/trips'
import { server } from '@/mocks/server'
import { useOwnerTokens } from '@/stores/ownerTokens'
import { renderRoute } from '@/test/renderRoute'

async function seedTrip(store = true) {
  const { tripId, ownerToken } = await createTrip({
    outboundFlightNo: '7C1302',
    returnFlightNo: 'KE724',
    cityCode: 'OSA',
    areaId: 11,
    startDate: '2026-11-30',
    endDate: '2026-12-03',
    manualOverride: {
      returnDepartureAt: '2026-12-03T15:00:00+09:00',
      returnDepartureAirport: 'KIX',
    },
  })
  if (store) useOwnerTokens.getState().setToken(tripId, ownerToken)
  return tripId
}

describe('TripDetailPage', () => {
  it('renders the summary in the city local time with source and status', async () => {
    const tripId = await seedTrip()
    renderRoute(`/trips/${tripId}`)
    expect(await screen.findByText('오사카 · 난바')).toBeInTheDocument()
    expect(screen.getByText('2026-11-30 ~ 2026-12-03')).toBeInTheDocument()
    expect(screen.getByText('KIX 2026-12-01 00:20')).toBeInTheDocument()
    expect(screen.getByText('KIX 2026-12-03 15:00')).toBeInTheDocument()
    expect(screen.getByText('항공편 조회')).toBeInTheDocument()
    expect(screen.getByText('예정')).toBeInTheDocument()
    expect(screen.getByText('직접 입력')).toBeInTheDocument()
  })

  it('receives status Manual for a manual leg and shows it once as 직접 입력', async () => {
    const tripId = await seedTrip()
    const detail = await getTrip(
      tripId,
      useOwnerTokens.getState().tokens[tripId],
    )
    expect(detail.return).toMatchObject({ source: 'MANUAL', status: 'Manual' })
    renderRoute(`/trips/${tripId}`)
    expect(await screen.findAllByText('직접 입력')).toHaveLength(1)
  })

  it('shows Manual status as 직접 입력 and tolerates a null status', async () => {
    const tripId = await seedTrip()
    const real = await getTrip(tripId, useOwnerTokens.getState().tokens[tripId])
    server.use(
      http.get('*/api/v1/trips/:tripId', () =>
        HttpResponse.json({
          ...real,
          outbound: { ...real.outbound, status: 'Manual' },
          return: { ...real.return, source: 'AERODATABOX', status: null },
        }),
      ),
    )
    renderRoute(`/trips/${tripId}`)
    expect(await screen.findByText('직접 입력')).toBeInTheDocument()
    expect(screen.getAllByText('항공편 조회')).toHaveLength(2)
    expect(screen.queryByText('예정')).not.toBeInTheDocument()
  })

  it('deletes after confirmation and returns home', async () => {
    const tripId = await seedTrip()
    const user = userEvent.setup()
    const { router } = renderRoute(`/trips/${tripId}`)
    await user.click(await screen.findByRole('button', { name: '여행 삭제' }))
    await user.click(screen.getByRole('button', { name: '취소' }))
    await user.click(screen.getByRole('button', { name: '여행 삭제' }))
    expect(
      screen.getByText('이 여행을 삭제할까요? 되돌릴 수 없습니다.'),
    ).toBeInTheDocument()
    // 토큰이 지워지는 순간 이미 홈에 있어야 '토큰 없음' 문구가 깜빡이지 않는다
    let pathAtRemoval: string | undefined
    let flashed = false
    const unsubscribe = useOwnerTokens.subscribe((state) => {
      if (!state.tokens[tripId] && pathAtRemoval === undefined) {
        pathAtRemoval = router.state.location.pathname
        flashed = !!screen.queryByText(/이 기기에서 만든 여행만/)
      }
    })
    await user.click(screen.getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    await waitFor(() =>
      expect(useOwnerTokens.getState().tokens[tripId]).toBeUndefined(),
    )
    unsubscribe()
    expect(pathAtRemoval).toBe('/')
    expect(flashed).toBe(false)
    expect(
      await screen.findByText('아직 만든 여행이 없습니다.'),
    ).toBeInTheDocument()
  })

  it('shows a message when no token is stored', async () => {
    const tripId = await seedTrip(false)
    renderRoute(`/trips/${tripId}`)
    expect(
      await screen.findByText(/이 기기에서 만든 여행만 볼 수 있습니다/),
    ).toBeInTheDocument()
  })

  it('shows forbidden for a wrong token', async () => {
    const tripId = await seedTrip(false)
    useOwnerTokens.getState().setToken(tripId, 'wrong-token')
    renderRoute(`/trips/${tripId}`)
    expect(
      await screen.findByText('이 여행을 볼 권한이 없습니다.'),
    ).toBeInTheDocument()
  })

  it('shows not found for a deleted trip and drops its token', async () => {
    useOwnerTokens.getState().setToken('missing', 'tok')
    renderRoute('/trips/missing')
    expect(
      await screen.findByText('여행을 찾을 수 없습니다.'),
    ).toBeInTheDocument()
    expect(useOwnerTokens.getState().tokens).not.toHaveProperty('missing')
  })
})
