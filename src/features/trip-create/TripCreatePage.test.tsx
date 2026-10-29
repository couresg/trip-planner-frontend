import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { CreateTripRequest } from '@/api/trips'
import { server } from '@/mocks/server'
import { useOwnerTokens } from '@/stores/ownerTokens'
import { renderRoute } from '@/test/renderRoute'

type User = ReturnType<typeof userEvent.setup>

const section = (name: '가는 편' | '오는 편') =>
  within(screen.getByRole('group', { name }))

const setDate = (label: RegExp, value: string) => {
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

async function fillForm(
  user: User,
  {
    outbound,
    ret,
    start = '2026-11-05',
    end = '2026-11-08',
  }: {
    outbound: string
    ret: string
    start?: string
    end?: string
  },
) {
  await user.selectOptions(await screen.findByLabelText('여행 도시'), 'OSA')
  const area = screen.getByLabelText('숙소 지역')
  await waitFor(() => expect(area).toBeEnabled())
  await user.selectOptions(area, '11')
  setDate(/시작일/, start)
  setDate(/종료일/, end)
  await user.type(section('가는 편').getByLabelText('편명'), outbound)
  await user.type(section('오는 편').getByLabelText('편명'), ret)
}

describe('TripCreatePage', () => {
  it('validates a bad flight number before submit', async () => {
    const user = userEvent.setup()
    renderRoute('/trips/new')
    const input = section('가는 편').getByLabelText('편명')
    await user.type(input, 'k1')
    expect(input).toHaveValue('K1')
    await user.tab()
    expect(
      await screen.findByText('편명 형식이 올바르지 않습니다. 예: KE723'),
    ).toBeInTheDocument()
  })

  it('normalizes spaces and case while typing', async () => {
    const user = userEvent.setup()
    renderRoute('/trips/new')
    const input = section('가는 편').getByLabelText('편명')
    await user.type(input, 'ke 723')
    expect(input).toHaveValue('KE723')
  })

  it('rejects an end date before the start date before submit', async () => {
    let posted = false
    server.use(
      http.post('*/api/v1/trips', () => {
        posted = true
        return HttpResponse.json({}, { status: 500 })
      }),
    )
    const user = userEvent.setup()
    renderRoute('/trips/new')
    setDate(/시작일/, '2026-11-08')
    setDate(/종료일/, '2026-11-05')
    expect(
      await screen.findByText('종료일은 시작일보다 빠를 수 없습니다.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '여행 생성하기' }))
    expect(posted).toBe(false)
  })

  it('reloads and resets the area when the city changes', async () => {
    server.use(
      http.get('*/api/v1/cities', () =>
        HttpResponse.json([
          {
            code: 'OSA',
            nameKo: '오사카',
            country: 'JP',
            timezone: 'Asia/Tokyo',
            airports: [{ iata: 'KIX', nameKo: '간사이 국제공항' }],
          },
          {
            code: 'FUK',
            nameKo: '후쿠오카',
            country: 'JP',
            timezone: 'Asia/Tokyo',
            airports: [{ iata: 'FUK', nameKo: '후쿠오카 공항' }],
          },
        ]),
      ),
      http.get('*/api/v1/cities/FUK/areas', () =>
        HttpResponse.json([
          {
            id: 21,
            nameKo: '하카타',
            lat: 33.59,
            lng: 130.42,
            description: null,
          },
        ]),
      ),
    )
    const user = userEvent.setup()
    renderRoute('/trips/new')
    const area = screen.getByLabelText('숙소 지역')
    expect(area).toBeDisabled()

    await user.selectOptions(await screen.findByLabelText('여행 도시'), 'OSA')
    await waitFor(() => expect(area).toBeEnabled())
    await user.selectOptions(area, '11')
    expect(area).toHaveValue('11')

    await user.selectOptions(screen.getByLabelText('여행 도시'), 'FUK')
    await screen.findByRole('option', { name: '하카타' })
    expect(area).toHaveValue('')
    expect(
      screen.queryByRole('option', { name: '난바' }),
    ).not.toBeInTheDocument()
  })

  it('previews 7C1302 with a +1 badge on the next-day arrival', async () => {
    const user = userEvent.setup()
    renderRoute('/trips/new')
    await user.selectOptions(await screen.findByLabelText('여행 도시'), 'OSA')
    setDate(/시작일/, '2026-11-30')
    await user.type(section('가는 편').getByLabelText('편명'), '7C1302')
    const preview = await screen.findByTestId(
      'outbound-preview',
      {},
      { timeout: 2000 },
    )
    expect(within(preview).getByText('+1')).toBeInTheDocument()
    expect(within(preview).getByText('22:30')).toBeInTheDocument()
    expect(within(preview).getByText('00:20')).toBeInTheDocument()
    expect(within(preview).getByText('여행 도시 구간')).toBeInTheDocument()
  })

  it('shows revised time and delay badge, and highlights the city leg of a connection', async () => {
    const user = userEvent.setup()
    renderRoute('/trips/new')
    await user.selectOptions(await screen.findByLabelText('여행 도시'), 'OSA')
    setDate(/시작일/, '2026-11-05')
    const input = section('가는 편').getByLabelText('편명')
    await user.type(input, 'OZ112')
    let preview = await screen.findByTestId(
      'outbound-preview',
      {},
      { timeout: 2000 },
    )
    expect(within(preview).getByText('지연')).toBeInTheDocument()
    expect(within(preview).getByText('12:20')).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, 'TW9901')
    await waitFor(
      () =>
        expect(screen.getByTestId('outbound-preview')).toHaveTextContent('FUK'),
      {
        timeout: 2000,
      },
    )
    preview = screen.getByTestId('outbound-preview')
    expect(within(preview).getAllByText('여행 도시 구간')).toHaveLength(1)
  })

  it('shows the mismatch message when no leg touches a city airport', async () => {
    const user = userEvent.setup()
    renderRoute('/trips/new')
    await user.selectOptions(await screen.findByLabelText('여행 도시'), 'OSA')
    setDate(/시작일/, '2026-11-05')
    await user.type(section('가는 편').getByLabelText('편명'), 'KE724')
    expect(
      await screen.findByText(
        '이 항공편은 선택한 여행 도시(오사카)의 공항에 도착하지 않습니다.',
        {},
        { timeout: 2000 },
      ),
    ).toBeInTheDocument()
  })

  it('creates a trip, stores the owner token and navigates to the detail', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/trips/new')
    await fillForm(user, { outbound: 'KE723', ret: 'KE724' })
    await user.click(screen.getByRole('button', { name: '여행 생성하기' }))

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/trips\/[\w-]+$/),
    )
    const tripId = router.state.location.pathname.split('/')[2]
    expect(tripId).not.toBe('new')
    expect(useOwnerTokens.getState().tokens[tripId]).toBeTruthy()
    expect(
      JSON.parse(localStorage.getItem('ownerTokens') ?? '{}'),
    ).toHaveProperty(tripId)
    expect(await screen.findByText('오사카 · 난바')).toBeInTheDocument()
  })

  it('switches to manual mode on FLIGHT_NOT_FOUND and submits with the city offset', async () => {
    let body: CreateTripRequest | undefined
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'POST')
        body = (await request.clone().json()) as CreateTripRequest
    })
    const user = userEvent.setup()
    const { router } = renderRoute('/trips/new')
    await fillForm(user, { outbound: 'ZZ9999', ret: 'KE724' })

    const outbound = section('가는 편')
    expect(
      await outbound.findByText(
        '항공편을 찾지 못했습니다.',
        {},
        { timeout: 2000 },
      ),
    ).toBeInTheDocument()
    // 조회에 성공한 오는 편에는 직접 입력을 제안하지 않는다
    await screen.findByTestId('return-preview', {}, { timeout: 2000 })
    expect(
      section('오는 편').queryByRole('button', { name: '직접 입력' }),
    ).not.toBeInTheDocument()
    await user.click(outbound.getByRole('button', { name: '직접 입력' }))
    expect(outbound.getByLabelText('도착 공항')).toHaveValue('KIX')
    fireEvent.change(outbound.getByLabelText('도착 시각 (현지)'), {
      target: { value: '2026-11-05T13:45' },
    })
    await user.click(screen.getByRole('button', { name: '여행 생성하기' }))

    await waitFor(() =>
      expect(router.state.location.pathname).not.toBe('/trips/new'),
    )
    server.events.removeAllListeners()
    expect(body?.manualOverride).toEqual({
      outboundArrivalAt: '2026-11-05T13:45:00+09:00',
      outboundArrivalAirport: 'KIX',
    })
    expect(await screen.findByText('KIX 2026-11-05 13:45')).toBeInTheDocument()
    expect(screen.getByText('직접 입력')).toBeInTheDocument()
  })

  it('offers manual entry when the create call returns FLIGHT_PROVIDER_UNAVAILABLE', async () => {
    server.use(
      http.post('*/api/v1/trips', () =>
        HttpResponse.json(
          {
            title: 'Service Unavailable',
            status: 503,
            code: 'FLIGHT_PROVIDER_UNAVAILABLE',
          },
          { status: 503 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderRoute('/trips/new')
    await fillForm(user, { outbound: 'KE723', ret: 'KE724' })
    await user.click(screen.getByRole('button', { name: '여행 생성하기' }))
    expect(
      await screen.findByText(
        /항공편 정보를 일시적으로 조회할 수 없습니다. "직접 입력"/,
      ),
    ).toBeInTheDocument()
    expect(
      section('가는 편').getByRole('button', { name: '직접 입력' }),
    ).toBeInTheDocument()
    expect(
      section('오는 편').getByRole('button', { name: '직접 입력' }),
    ).toBeInTheDocument()
  })

  it('shows the server detail for CITY_AIRPORT_MISMATCH', async () => {
    const user = userEvent.setup()
    renderRoute('/trips/new')
    await fillForm(user, { outbound: 'KE724', ret: 'KE724' })
    await user.click(screen.getByRole('button', { name: '여행 생성하기' }))
    expect(
      await screen.findByText(
        '선택한 여행 도시(오사카)와 공항(ICN)이 다릅니다.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the server detail for INVALID_DATE_RANGE', async () => {
    server.use(
      http.post('*/api/v1/trips', () =>
        HttpResponse.json(
          {
            title: 'Bad Request',
            status: 400,
            code: 'INVALID_DATE_RANGE',
            detail: '오는 편 출발이 가는 편 도착보다 빠릅니다.',
          },
          { status: 400 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderRoute('/trips/new')
    await fillForm(user, { outbound: 'KE723', ret: 'KE724' })
    await user.click(screen.getByRole('button', { name: '여행 생성하기' }))
    expect(
      await screen.findByText('오는 편 출발이 가는 편 도착보다 빠릅니다.'),
    ).toBeInTheDocument()
  })

  it('clears a create error when a flight number or date changes', async () => {
    server.use(
      http.post('*/api/v1/trips', () =>
        HttpResponse.json(
          {
            title: 'Service Unavailable',
            status: 503,
            code: 'FLIGHT_PROVIDER_UNAVAILABLE',
          },
          { status: 503 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderRoute('/trips/new')
    await fillForm(user, { outbound: 'KE723', ret: 'KE724' })
    const submit = screen.getByRole('button', { name: '여행 생성하기' })
    const errorText = /항공편 정보를 일시적으로 조회할 수 없습니다. "직접 입력"/

    await user.click(submit)
    expect(await screen.findByText(errorText)).toBeInTheDocument()
    await user.type(section('오는 편').getByLabelText('편명'), '5')
    expect(screen.queryByText(errorText)).not.toBeInTheDocument()
    expect(
      section('가는 편').queryByRole('button', { name: '직접 입력' }),
    ).not.toBeInTheDocument()

    await user.click(submit)
    expect(await screen.findByText(errorText)).toBeInTheDocument()
    setDate(/종료일/, '2026-11-09')
    expect(screen.queryByText(errorText)).not.toBeInTheDocument()
  })
})
