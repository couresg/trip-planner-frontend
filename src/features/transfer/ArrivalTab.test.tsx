import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { ManualOverride } from '@/api/trips'
import { createTrip } from '@/api/trips'
import { server } from '@/mocks/server'
import { useOwnerTokens } from '@/stores/ownerTokens'
import { renderRoute } from '@/test/renderRoute'

async function seedTrip(
  outboundFlightNo: string,
  startDate: string,
  manualOverride: ManualOverride | null = null,
) {
  const { tripId, ownerToken } = await createTrip({
    outboundFlightNo,
    returnFlightNo: 'KE724',
    cityCode: 'OSA',
    areaId: 11,
    startDate,
    endDate: '2026-12-03',
    manualOverride,
  })
  useOwnerTokens.getState().setToken(tripId, ownerToken)
  return tripId
}

const card = (name: string) => screen.getByRole('article', { name })

const chips = (name: string) =>
  within(within(card(name)).getByRole('list', { name: '출발 시각' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent)

const recommendedChip = (name: string) =>
  chips(name).filter((text) => text?.includes('추천'))

const timeline = () =>
  within(screen.getByRole('region', { name: '도착 타임라인' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent)

const cardOrder = () =>
  screen.getAllByRole('article').map((a) => a.querySelector('h3')?.textContent)

const firstDeparture = (name: string) =>
  within(card(name)).getByText(/운행 종료 · 첫차/)

describe('ArrivalTab', () => {
  it('shows the timeline and cards with recommended and hard-to-catch departures', async () => {
    // KE723 13:52 도착(지연 반영), 입국 60분 → 14:52 이후 첫 편 추천
    const tripId = await seedTrip('KE723', '2026-11-05')
    renderRoute(`/trips/${tripId}`)

    expect(
      await screen.findByRole('tab', { name: '도착일', selected: true }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('article', { name: '난카이 라피트' }),
    ).toBeInTheDocument()

    expect(timeline()).toEqual([
      '착륙13:52',
      '입국 완료14:52',
      '추천편 출발 · 난카이 라피트15:05',
      '숙소 도착 · 난바15:48',
    ])

    const rapit = within(card('난카이 라피트'))
    expect(rapit.getByText('철도')).toBeInTheDocument()
    expect(rapit.getByText('간사이공항역')).toBeInTheDocument()
    expect(rapit.getByText('난바역')).toBeInTheDocument()
    expect(rapit.getByText(/소요 38분 \+ 도보 5분/)).toBeInTheDocument()
    expect(rapit.getByText('¥1,490')).toBeInTheDocument()
    expect(
      rapit.getByText(
        '제1터미널 2층 연결통로 → 에어로플라자 → 난카이선 개찰구',
      ),
    ).toBeInTheDocument()
    expect(rapit.queryByText(/운행 종료/)).not.toBeInTheDocument()
    expect(chips('난카이 라피트')).toEqual([
      '14:05 출발도착 14:48탑승 어려움',
      '14:35 출발도착 15:18탑승 어려움',
      '15:05 출발도착 15:48✅ 추천',
      '15:35 출발도착 16:18',
    ])

    expect(recommendedChip('난카이 공항급행')).toEqual([
      '15:15 출발도착 16:05✅ 추천',
    ])

    const taxi = within(card('택시'))
    expect(taxi.getByText('24시간')).toBeInTheDocument()
    expect(taxi.getByText('난바')).toBeInTheDocument()
    expect(taxi.getByText(/¥17,000~20,000/)).toBeInTheDocument()
    expect(taxi.queryByRole('list')).not.toBeInTheDocument()

    // 택시·차량 호출은 맨 뒤
    expect(cardOrder()).toEqual(['난카이 라피트', '난카이 공항급행', '택시'])
  })

  it('re-queries and moves the recommended badge when immigration time changes', async () => {
    const tripId = await seedTrip('KE723', '2026-11-05')
    const requested: string[] = []
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url)
      if (url.pathname.endsWith('/transfers/arrival'))
        requested.push(url.searchParams.get('immigrationMin') ?? '')
    })
    const user = userEvent.setup()
    renderRoute(`/trips/${tripId}`)

    expect(await screen.findByRole('radio', { name: '60분' })).toBeChecked()
    await screen.findByRole('article', { name: '난카이 라피트' })
    expect(recommendedChip('난카이 라피트')).toEqual([
      '15:05 출발도착 15:48✅ 추천',
    ])

    await user.click(screen.getByRole('radio', { name: '30분' }))
    expect(screen.getByRole('radio', { name: '30분' })).toBeChecked()
    await waitFor(() =>
      expect(recommendedChip('난카이 라피트')).toEqual([
        '14:35 출발도착 15:18✅ 추천',
      ]),
    )
    expect(timeline()[1]).toBe('입국 완료14:22')

    await user.click(screen.getByRole('radio', { name: '90분' }))
    await waitFor(() =>
      expect(recommendedChip('난카이 라피트')).toEqual([
        '15:35 출발도착 16:18✅ 추천',
      ]),
    )
    expect(requested).toEqual(['60', '30', '90'])
    server.events.removeAllListeners()
  })

  it('shows taxi first and the first train when no transit runs (00:20 arrival)', async () => {
    // 7C1302 11-30 22:30 출발 → 12-01 00:20 도착, 조회 00:20~02:20
    const tripId = await seedTrip('7C1302', '2026-11-30')
    renderRoute(`/trips/${tripId}`)

    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent('운행하는 대중교통이 없습니다')
    expect(banner).toHaveTextContent('운행 종료 · 첫차 05:45')
    expect(cardOrder()).toEqual(['택시', '난카이 라피트', '난카이 공항급행'])
    expect(firstDeparture('난카이 라피트')).toHaveTextContent(
      '운행 종료 · 첫차 06:35',
    )
    expect(
      within(card('난카이 라피트')).queryByRole('list'),
    ).not.toBeInTheDocument()
    expect(timeline()).toEqual(['착륙00:20', '입국 완료01:20'])
    expect(
      screen.getByText(
        '입국 후 조회 시간 안에 탈 수 있는 대중교통이 없습니다.',
      ),
    ).toBeInTheDocument()
  })

  it('shows hard-to-catch chips together with the first train when nothing is catchable (22:50 arrival)', async () => {
    // 입국 60분 → 23:50 완료, 조회 22:50~00:50 안의 라피트 23:05·공항급행 23:15(막차)는 모두 탑승 어려움
    const tripId = await seedTrip('KE723', '2026-11-05', {
      outboundArrivalAt: '2026-11-05T22:50:00+09:00',
      outboundArrivalAirport: 'KIX',
    })
    renderRoute(`/trips/${tripId}`)

    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent('운행 종료 · 첫차 05:45+1')
    expect(cardOrder()).toEqual(['택시', '난카이 라피트', '난카이 공항급행'])

    expect(chips('난카이 라피트')).toEqual(['23:05 출발도착 23:48탑승 어려움'])
    expect(firstDeparture('난카이 라피트')).toHaveTextContent(
      '운행 종료 · 첫차 06:35+1',
    )
    expect(chips('난카이 공항급행')).toEqual([
      '23:15 출발도착 00:05+1 다음 날탑승 어려움',
    ])
    expect(firstDeparture('난카이 공항급행')).toHaveTextContent(
      '운행 종료 · 첫차 05:45+1',
    )
    expect(screen.queryByText(/✅/)).not.toBeInTheDocument()
    expect(timeline()).toEqual(['착륙22:50', '입국 완료23:50'])
  })

  it('marks +1 with screen-reader text for times after midnight on a 23:30 arrival', async () => {
    const tripId = await seedTrip('KE723', '2026-11-05', {
      outboundArrivalAt: '2026-11-05T23:30:00+09:00',
      outboundArrivalAirport: 'KIX',
    })
    renderRoute(`/trips/${tripId}`)

    await screen.findByRole('article', { name: '난카이 공항급행' })
    // 조회 23:30~01:30(자정 넘김), 입국 60분 → 00:30 완료. 두 노선 모두 막차가 지났다
    expect(timeline()).toEqual(['착륙23:30', '입국 완료00:30+1 다음 날'])
    const ready = within(
      screen.getByRole('region', { name: '도착 타임라인' }),
    ).getByText('+1')
    expect(ready).toHaveAttribute('aria-hidden', 'true')
    expect(firstDeparture('난카이 공항급행')).toHaveTextContent(
      '운행 종료 · 첫차 05:45+1 다음 날',
    )
    expect(firstDeparture('난카이 라피트')).toHaveTextContent(
      '운행 종료 · 첫차 06:35+1 다음 날',
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      '운행 종료 · 첫차 05:45+1 다음 날',
    )
  })

  it('shows an error with a retry button', async () => {
    const tripId = await seedTrip('KE723', '2026-11-05')
    server.use(
      http.get(
        '*/api/v1/trips/:tripId/transfers/arrival',
        () =>
          HttpResponse.json(
            {
              title: 'Internal Server Error',
              status: 500,
              code: 'INTERNAL_ERROR',
            },
            { status: 500 },
          ),
        { once: true },
      ),
    )
    const user = userEvent.setup()
    renderRoute(`/trips/${tripId}`)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('문제가 발생했습니다')
    await user.click(within(alert).getByRole('button', { name: '다시 시도' }))
    expect(
      await screen.findByRole('article', { name: '난카이 라피트' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
