import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DepartureOption, DepartureTransfers } from '@/api/transfers'
import { createTrip } from '@/api/trips'
import { server } from '@/mocks/server'
import { useOwnerTokens } from '@/stores/ownerTokens'
import { renderRoute } from '@/test/renderRoute'

const DEPARTURE_PATH = '*/api/v1/trips/:tripId/transfers/departure'

/** returnAt을 주면 그 시각에 출발하는 오는 편을 직접 입력으로 만든다 (기본 KE724 15:00) */
async function openDepartureTab({
  flightNo = 'KE724',
  returnAt,
  landAt,
}: { flightNo?: string; returnAt?: string; landAt?: string } = {}) {
  const { tripId, ownerToken } = await createTrip({
    outboundFlightNo: 'KE723',
    returnFlightNo: flightNo,
    cityCode: 'OSA',
    areaId: 11,
    startDate: '2026-11-30',
    endDate: '2026-12-03',
    manualOverride: {
      ...(returnAt && {
        returnDepartureAt: returnAt,
        returnDepartureAirport: 'KIX',
      }),
      ...(landAt && {
        outboundArrivalAt: landAt,
        outboundArrivalAirport: 'KIX',
      }),
    },
  })
  useOwnerTokens.getState().setToken(tripId, ownerToken)
  const user = userEvent.setup()
  renderRoute(`/trips/${tripId}`)
  await user.click(await screen.findByRole('tab', { name: '귀국일' }))
  return user
}

const panel = () => within(screen.getByRole('tabpanel'))

const card = (name: string) => panel().getByRole('article', { name })

const chips = (name: string) =>
  within(within(card(name)).getByRole('list', { name: '출발 시각' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent)

const timeline = () =>
  within(panel().getByRole('region', { name: '귀국일 타임라인' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent)

const cardOrder = () =>
  panel()
    .getAllByRole('article')
    .map((a) => a.querySelector('h3')?.textContent)

const FIRST_TRAIN = '첫차로는 시간을 맞출 수 없어요'
const LAST_TRAIN = /마감 시각에 맞출 수 있는 막차예요/

const route = (overrides: Partial<DepartureOption>): DepartureOption => ({
  routeId: 201,
  mode: 'RAIL',
  name: '난카이 라피트',
  from: '난바역',
  to: '간사이공항역',
  durationMin: 38,
  walkBeforeMin: 5,
  fare: null,
  boardingTip: null,
  is24h: false,
  departures: [],
  leaveByAt: null,
  dataAsOf: '2026-11-03',
  source: 'SEED',
  note: null,
  ...overrides,
})

const noTransit: DepartureTransfers = {
  flightDepartureAt: '2026-12-03T07:00:00+09:00',
  revisedDepartureAt: null,
  boardingMarginMin: 10,
  airportDeadline: '2026-12-03T05:00:00+09:00',
  windowStart: '2026-12-03T03:30:00+09:00',
  timezone: 'Asia/Tokyo',
  firstTrainTooLate: true,
  noTimeAfterLanding: false,
  latestLeaveAt: null,
  scheduledDepartureAt: '2026-12-03T07:00:00+09:00',
  flightStatus: 'Expected',
  flightCheck: { result: 'REFRESHED', checkedAt: '2026-12-02T09:00:00+09:00' },
  options: [],
}

describe('DepartureTab', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('shows the headline, the summary, and LATEST/SAFER for each route (15:00 flight)', async () => {
    await openDepartureTab()

    // 마감 13:00, 공항 도착 11:30~13:00. 공항급행 12:15 → 13:00 도착(경계 포함)이 가장 늦다
    // 숙소 출발 = 탑승 - 도보 5분 - 탑승 여유 10분
    expect(await screen.findByText(/에 숙소에서 출발하세요/)).toHaveTextContent(
      '늦어도 12:00에 숙소에서 출발하세요',
    )
    expect(
      panel().getByText(
        '표 구매와 승강장 이동에 필요한 10분을 포함한 시각이에요.',
      ),
    ).toBeInTheDocument()
    expect(timeline()).toEqual([
      '숙소 출발 · 난카이 공항급행12:00',
      '공항 도착 마감13:00',
      '항공편 출발15:00',
    ])

    expect(chips('난카이 라피트')).toEqual([
      '10:45 숙소 출발탑승 11:00공항 도착 11:38',
      '11:15 숙소 출발탑승 11:30공항 도착 12:08여유 있게',
      '11:45 숙소 출발탑승 12:00공항 도착 12:38✅ 가장 늦은 출발',
    ])
    expect(chips('난카이 공항급행')).toEqual([
      '10:30 숙소 출발탑승 10:45공항 도착 11:30',
      '11:00 숙소 출발탑승 11:15공항 도착 12:00',
      '11:30 숙소 출발탑승 11:45공항 도착 12:30여유 있게',
      '12:00 숙소 출발탑승 12:15공항 도착 13:00✅ 가장 늦은 출발',
    ])

    const rapit = within(card('난카이 라피트'))
    expect(rapit.getByText(/도보 5분 \+ 소요 38분/)).toBeInTheDocument()
    expect(rapit.getByText('¥1,490')).toBeInTheDocument()
    expect(rapit.getByText('난바역')).toBeInTheDocument()

    const taxi = within(card('택시'))
    expect(taxi.getByText('24시간')).toBeInTheDocument()
    expect(taxi.queryByRole('list')).not.toBeInTheDocument()
    expect(taxi.getByText(/출발$/)).toHaveTextContent('늦어도 12:10 출발')
    expect(
      taxi.getByText(
        '소요 시간은 추정치이고 교통 상황에 따라 더 걸릴 수 있어요.',
      ),
    ).toBeInTheDocument()
    expect(rapit.queryByText(/추정치/)).not.toBeInTheDocument()

    expect(cardOrder()).toEqual(['난카이 공항급행', '난카이 라피트', '택시'])
    expect(panel().queryByText(FIRST_TRAIN)).not.toBeInTheDocument()
    expect(panel().queryByText(LAST_TRAIN)).not.toBeInTheDocument()
  })

  it('re-queries when the buffer changes and never shows the old latest time while loading', async () => {
    const requested: string[] = []
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url)
      if (url.pathname.endsWith('/transfers/departure'))
        requested.push(url.searchParams.get('airportBufferMin') ?? '')
    })
    const user = await openDepartureTab()
    await screen.findByRole('article', { name: '난카이 라피트' })
    expect(panel().getByRole('radio', { name: '2시간' })).toBeChecked()
    expect(
      panel()
        .getAllByRole('radio')
        .map((r) => r.parentElement?.textContent),
    ).toEqual(['2시간', '2시간 30분', '3시간'])

    // 응답을 기다리는 동안 이전 시각이 읽히면 안 된다 (undefined를 돌려주면 기본 핸들러로 넘어간다)
    server.use(
      http.get(DEPARTURE_PATH, async () => {
        await delay(50)
      }),
    )
    await user.click(panel().getByRole('radio', { name: '3시간' }))
    expect(panel().getByRole('radio', { name: '3시간' })).toBeChecked()
    expect(panel().getByLabelText('불러오는 중...')).toBeInTheDocument()
    expect(
      panel().queryByText(/에 숙소에서 출발하세요/),
    ).not.toBeInTheDocument()
    expect(
      panel().queryByRole('region', { name: '귀국일 타임라인' }),
    ).not.toBeInTheDocument()
    expect(panel().queryByRole('article')).not.toBeInTheDocument()
    expect(screen.getByRole('tabpanel')).not.toHaveTextContent('12:00')

    // 마감 12:00 → 공항급행 11:15 → 숙소 11:00
    expect(
      await panel().findByText(/에 숙소에서 출발하세요/),
    ).toHaveTextContent('늦어도 11:00에 숙소에서 출발하세요')
    expect(localStorage.getItem('airportBufferMin')).toBe('180')
    expect(timeline()[1]).toBe('공항 도착 마감12:00')

    await user.click(panel().getByRole('radio', { name: '2시간 30분' }))
    await waitFor(() => expect(timeline()[1]).toBe('공항 도착 마감12:30'))
    expect(requested).toEqual(['120', '180', '150'])
    server.events.removeAllListeners()
  })

  it('warns about the first train and puts the taxi on top (07:00 flight)', async () => {
    await openDepartureTab({ returnAt: '2026-12-03T07:00:00+09:00' })

    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent(FIRST_TRAIN)
    expect(banner).toHaveTextContent('택시·차량 호출을 이용하세요.')
    expect(panel().queryByText(LAST_TRAIN)).not.toBeInTheDocument()

    expect(cardOrder()).toEqual(['택시', '난카이 라피트', '난카이 공항급행'])
    expect(within(card('택시')).getByText(/출발$/)).toHaveTextContent(
      '늦어도 04:10 출발',
    )
    expect(
      within(card('난카이 라피트')).getByText(
        '조회 시간 안에 출발편이 없습니다.',
      ),
    ).toBeInTheDocument()

    // 탈 수 있는 대중교통이 없으니 숙소 출발 시각을 단정하지 않는다
    expect(
      panel().queryByText(/에 숙소에서 출발하세요/),
    ).not.toBeInTheDocument()
    expect(timeline()).toEqual(['공항 도착 마감05:00', '항공편 출발07:00'])
  })

  it('says there is no time after landing instead of the first-train warning (land 13:00, return 15:30)', async () => {
    await openDepartureTab({
      landAt: '2026-12-03T13:00:00+09:00',
      returnAt: '2026-12-03T15:30:00+09:00',
    })

    // 마감 13:30. 택시도 12:40에 나서야 해서 착륙 전이다
    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent('착륙 후 공항을 나갈 시간이 없어요')
    expect(panel().queryByText(FIRST_TRAIN)).not.toBeInTheDocument()
    expect(panel().queryByText(/택시·차량 호출/)).not.toBeInTheDocument()
    expect(
      panel().queryByText(/에 숙소에서 출발하세요/),
    ).not.toBeInTheDocument()

    const taxi = within(card('택시'))
    expect(taxi.queryByText(/늦어도/)).not.toBeInTheDocument()
    expect(taxi.queryByText(/추정치/)).not.toBeInTheDocument()
    expect(taxi.getByText('24시간')).toBeInTheDocument()
    expect(cardOrder()).toEqual(['난카이 라피트', '난카이 공항급행', '택시'])
    expect(timeline()).toEqual(['공항 도착 마감13:30', '항공편 출발15:30'])
  })

  it('keeps the first-train warning and taxi time when a taxi still works after landing (land 23:30, return 05:00)', async () => {
    await openDepartureTab({
      landAt: '2026-12-02T23:30:00+09:00',
      returnAt: '2026-12-03T05:00:00+09:00',
    })

    // 마감 03:00. 착륙 뒤 열차는 없지만 택시는 02:10에 나서면 된다
    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent(FIRST_TRAIN)
    expect(banner).toHaveTextContent('택시·차량 호출을 이용하세요.')
    expect(banner).not.toHaveTextContent('착륙 후')
    expect(cardOrder()).toEqual(['택시', '난카이 라피트', '난카이 공항급행'])
    expect(within(card('택시')).getByText(/출발$/)).toHaveTextContent(
      '늦어도 02:10 출발',
    )
  })

  it('explains the last train when every route is outside the window, across midnight (03:30 flight)', async () => {
    await openDepartureTab({ returnAt: '2026-12-03T03:30:00+09:00' })

    // 마감 01:30, 조회 00:00~01:30. 전날 22:45 공항급행이 23:30 도착
    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent(LAST_TRAIN)
    expect(banner).toHaveTextContent('오래 기다리기 어렵다면')
    expect(banner).not.toHaveTextContent(FIRST_TRAIN)

    const headline = panel().getByText(/에 숙소에서 출발하세요/)
    expect(headline).toHaveTextContent(
      '늦어도 22:30-1 1일 전에 숙소에서 출발하세요',
    )
    expect(
      panel().getByText('12월 2일 출발이에요. 항공편 출발일과 날짜가 달라요.'),
    ).toBeInTheDocument()
    expect(timeline()).toEqual([
      '숙소 출발 · 난카이 공항급행22:30-1 1일 전',
      '공항 도착 마감01:30',
      '항공편 출발03:30',
    ])

    expect(chips('난카이 공항급행')).toEqual([
      '22:30-1 1일 전 숙소 출발탑승 22:45-1 1일 전공항 도착 23:30-1 1일 전막차',
    ])
    expect(chips('난카이 라피트')).toEqual([
      '21:45-1 1일 전 숙소 출발탑승 22:00-1 1일 전공항 도착 22:38-1 1일 전막차',
    ])
    expect(screen.queryByText(/가장 늦은 출발/)).not.toBeInTheDocument()
    expect(
      within(card('난카이 라피트')).getByText(LAST_TRAIN),
    ).toBeInTheDocument()

    // 첫차 경고가 아니므로 택시를 위로 올리지 않는다
    expect(cardOrder()).toEqual(['난카이 공항급행', '난카이 라피트', '택시'])
    expect(within(card('택시')).getByText(/출발$/)).toHaveTextContent(
      '늦어도 00:40 출발',
    )
  })

  it('keeps the last-train message on the card when only one route is outside the window (02:30 flight)', async () => {
    await openDepartureTab({ returnAt: '2026-12-03T02:30:00+09:00' })

    // 마감 00:30, 조회 23:00~00:30. 공항급행 22:45 → 23:30은 범위 안, 라피트 22:00 → 22:38은 범위 밖
    await screen.findByRole('article', { name: '난카이 라피트' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(panel().getByText(/에 숙소에서 출발하세요/)).toHaveTextContent(
      '늦어도 22:30',
    )
    expect(
      within(card('난카이 라피트')).getByText(LAST_TRAIN),
    ).toBeInTheDocument()
    expect(
      within(card('난카이 공항급행')).queryByText(LAST_TRAIN),
    ).not.toBeInTheDocument()
    expect(
      chips('난카이 공항급행').filter((c) => c?.includes('가장 늦은 출발')),
    ).toHaveLength(1)
  })

  it('warns prominently when the return flight is canceled but still shows the times', async () => {
    await openDepartureTab({ flightNo: 'LJ232' })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('결항 또는 결항 가능성')
    expect(alert).toHaveTextContent('참고용')
    expect(
      await panel().findByText(/에 숙소에서 출발하세요/),
    ).toBeInTheDocument()
  })

  it('treats CanceledUncertain as canceled', async () => {
    await openDepartureTab({ flightNo: 'LJ233' })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '결항 또는 결항 가능성',
    )
    expect(screen.getByText('결항 가능성')).toHaveClass('bg-red-100')
  })

  it('bases the times on the original departure and warns when a delay is on record', async () => {
    await openDepartureTab({ flightNo: 'OZ113' })

    // 원래 15:00, 지연 16:30. 지연은 줄어들 수 있으므로 15:00 기준 (마감 13:00)
    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent('지연 반영됨: 예정 15:00 → 변경 16:30')
    expect(banner).toHaveTextContent('지연은 줄어들 수 있어서')
    expect(banner).toHaveTextContent('원래 출발 시각을 기준으로')
    expect(banner).toHaveTextContent('항공사에 확인해 주세요')
    expect(panel().getByText(/에 숙소에서 출발하세요/)).toHaveTextContent(
      '늦어도 12:00에',
    )
    expect(timeline()).toEqual([
      '숙소 출발 · 난카이 공항급행12:00',
      '공항 도착 마감13:00',
      '항공편 원래 출발15:00',
    ])
  })

  it('warns about a cancellation found by the refresh even when the saved trip says Expected', async () => {
    server.use(
      http.get(DEPARTURE_PATH, () =>
        HttpResponse.json({ ...noTransit, flightStatus: 'Canceled' }),
      ),
    )
    await openDepartureTab()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '결항 또는 결항 가능성',
    )
  })

  it('says the check period is over after departure, not that it will check later', async () => {
    server.use(
      http.get(DEPARTURE_PATH, () =>
        HttpResponse.json({
          ...noTransit,
          flightCheck: {
            result: 'AFTER_WINDOW',
            checkedAt: '2026-12-03T06:50:00+09:00',
          },
        }),
      ),
    )
    await openDepartureTab()

    expect(
      await panel().findByText(
        /확인 기간이 지나 더 이상 지연을 다시 확인하지 않아요/,
      ),
    ).toBeInTheDocument()
    expect(
      panel().queryByText(/이 화면을 열 때마다 항공편 지연을/),
    ).not.toBeInTheDocument()
  })

  it('says the flight check failed and when it was last checked', async () => {
    server.use(
      http.get(DEPARTURE_PATH, () =>
        HttpResponse.json({
          ...noTransit,
          flightCheck: {
            result: 'FAILED',
            checkedAt: '2026-12-02T09:30:00+09:00',
          },
        }),
      ),
    )
    await openDepartureTab()

    expect(
      await panel().findByText(/다시 확인하지 못해 마지막으로 확인한 시각으로/),
    ).toBeInTheDocument()
    expect(
      panel().getByText('항공편 정보 마지막 확인 12월 2일 09:30'),
    ).toBeInTheDocument()
  })

  it('does not show the canceled warning for a flight that is not canceled', async () => {
    await openDepartureTab()
    await screen.findByRole('article', { name: '난카이 라피트' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('always shows the saved-flight-time and special-timetable notice, even on error', async () => {
    const NOTICE =
      /출발 48시간 전부터 이 화면을 열 때 다시 확인해요.*연말연시 같은 특별 시간표.*다시 확인하세요/
    await openDepartureTab()
    expect(panel().getByText(NOTICE)).toBeInTheDocument()
    await screen.findByRole('article', { name: '난카이 라피트' })
    expect(panel().getByText(NOTICE)).toBeInTheDocument()

    server.use(
      http.get(DEPARTURE_PATH, () =>
        HttpResponse.json(
          { title: 'Internal Server Error', status: 500 },
          { status: 500 },
        ),
      ),
    )
    await userEvent.click(panel().getByRole('radio', { name: '3시간' }))
    await screen.findByRole('alert')
    expect(panel().getByText(NOTICE)).toBeInTheDocument()
  })

  it('shows an error with a retry button', async () => {
    server.use(
      http.get(
        DEPARTURE_PATH,
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
    const user = await openDepartureTab()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('문제가 발생했습니다')
    await user.click(within(alert).getByRole('button', { name: '다시 시도' }))
    expect(
      await screen.findByRole('article', { name: '난카이 라피트' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not mention trains or taxis when the area has no options at all', async () => {
    server.use(http.get(DEPARTURE_PATH, () => HttpResponse.json(noTransit)))
    await openDepartureTab()

    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent('이용할 수 있는 교통편이 없어요')
    expect(panel().queryByText(FIRST_TRAIN)).not.toBeInTheDocument()
    expect(panel().queryByRole('article')).not.toBeInTheDocument()
    expect(timeline()).toEqual(['공항 도착 마감05:00', '항공편 출발07:00'])
  })

  it('does not suggest a taxi when transit is too late and there is no taxi', async () => {
    server.use(
      http.get(DEPARTURE_PATH, () =>
        HttpResponse.json({ ...noTransit, options: [route({})] }),
      ),
    )
    await openDepartureTab()

    expect(await panel().findByText(FIRST_TRAIN)).toBeInTheDocument()
    expect(panel().getByText(/이용할 수 있는 교통편이 없어요/)).toBeVisible()
    expect(panel().queryByText(/택시·차량 호출/)).not.toBeInTheDocument()
  })

  it('renders in the airport timezone regardless of the browser zone and ISO offset', async () => {
    vi.stubEnv('TZ', 'America/New_York')
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
      'America/New_York',
    )
    // 같은 순간을 UTC 표기로 보내도 Asia/Tokyo 현지 시각으로 보인다
    server.use(
      http.get(DEPARTURE_PATH, () =>
        HttpResponse.json({
          ...noTransit,
          flightDepartureAt: '2026-12-02T15:30:00Z',
          airportDeadline: '2026-12-02T13:30:00Z',
          firstTrainTooLate: false,
          latestLeaveAt: '2026-12-02T12:10:00Z',
          options: [
            route({
              departures: [
                {
                  leaveAreaAt: '2026-12-02T12:10:00Z',
                  departAt: '2026-12-02T12:15:00Z',
                  arriveAirportAt: '2026-12-02T12:53:00Z',
                  label: 'LATEST',
                  outsideWindow: false,
                },
              ],
            }),
          ],
        }),
      ),
    )
    await openDepartureTab()

    expect(
      await panel().findByText(/에 숙소에서 출발하세요/),
    ).toHaveTextContent('늦어도 21:10')
    expect(timeline()).toEqual([
      '숙소 출발 · 난카이 라피트21:10-1 1일 전',
      '공항 도착 마감22:30-1 1일 전',
      '항공편 출발00:30',
    ])
    expect(chips('난카이 라피트')[0]).toContain('21:10')
  })
})
