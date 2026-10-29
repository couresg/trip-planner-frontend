import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { CreateTripRequest } from '@/api/trips'
import { createTrip } from '@/api/trips'
import { server } from '@/mocks/server'
import { useOwnerTokens } from '@/stores/ownerTokens'
import { renderRoute } from '@/test/renderRoute'

const base: CreateTripRequest = {
  outboundFlightNo: 'KE723',
  returnFlightNo: 'KE724',
  cityCode: 'OSA',
  areaId: 11,
  startDate: '2026-11-05',
  endDate: '2026-11-08',
  manualOverride: null,
}

async function seedOwnedTrip(overrides: Partial<CreateTripRequest> = {}) {
  const { tripId, ownerToken } = await createTrip({ ...base, ...overrides })
  useOwnerTokens.getState().setToken(tripId, ownerToken)
  return tripId
}

describe('TripList on HomePage', () => {
  it('shows the empty state without stored tokens', async () => {
    renderRoute('/')
    expect(
      await screen.findByText('아직 만든 여행이 없습니다.'),
    ).toBeInTheDocument()
  })

  it('renders stored trips sorted by start date with links', async () => {
    const later = await seedOwnedTrip({
      startDate: '2026-12-01',
      endDate: '2026-12-03',
      areaId: 12,
    })
    const earlier = await seedOwnedTrip()
    // 토큰이 없는 다른 사람의 여행은 보이지 않는다
    await createTrip({ ...base, areaId: 13 })

    let header: string | null = null
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/v1/trips')
        header = request.headers.get('X-Owner-Token')
    })
    renderRoute('/')
    const links = await screen.findAllByRole('link', { name: /오사카/ })
    server.events.removeAllListeners()

    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', `/trips/${earlier}`)
    expect(links[1]).toHaveAttribute('href', `/trips/${later}`)
    expect(within(links[0]).getByText('오사카 · 난바')).toBeInTheDocument()
    expect(
      within(links[0]).getByText('2026-11-05 ~ 2026-11-08'),
    ).toBeInTheDocument()
    expect(within(links[0]).getByText('KE723 / KE724')).toBeInTheDocument()
    expect(within(links[1]).getByText('오사카 · 우메다')).toBeInTheDocument()
    expect(header).not.toBeNull()
    expect(String(header).split(',')).toHaveLength(2)
  })

  it('shows an error with retry', async () => {
    useOwnerTokens.getState().setToken('t1', 'tok')
    server.use(
      http.get(
        '*/api/v1/trips',
        () => HttpResponse.json({ status: 500 }, { status: 500 }),
        {
          once: true,
        },
      ),
    )
    renderRoute('/')
    expect(
      await screen.findByText('여행 목록을 불러오지 못했습니다.'),
    ).toBeInTheDocument()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: '다시 시도' }))
    expect(
      await screen.findByText('아직 만든 여행이 없습니다.'),
    ).toBeInTheDocument()
  })
})
