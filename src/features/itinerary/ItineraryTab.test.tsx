import { focusManager, onlineManager } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addItineraryItem } from '@/api/itinerary'
import type { Itinerary } from '@/api/itinerary'
import { createTrip, getTrip } from '@/api/trips'
import { server } from '@/mocks/server'
import { useItineraryFailures } from '@/stores/itineraryFailures'
import { useOwnerTokens } from '@/stores/ownerTokens'
import { useTransferSettings } from '@/stores/transferSettings'
import { renderRoute } from '@/test/renderRoute'

const ITEMS_PATH = '*/api/v1/trips/:tripId/itinerary/items'
const ITEM_PATH = '*/api/v1/trips/:tripId/itinerary/items/:itemId'
const ORDER_PATH = '*/api/v1/trips/:tripId/itinerary/days/:date/order'
const ITINERARY_PATH = '*/api/v1/trips/:tripId/itinerary'

const CASTLE = 501
const DOTONBORI = 520
const SKY = 530

const DAY1 = '1일차 · 11월 30일 (월)'
const DAY2 = '2일차 · 12월 1일 (화)'
const DAY3 = '3일차 · 12월 2일 (수)'

const serverError = () =>
  HttpResponse.json(
    { title: 'Internal Server Error', status: 500, code: 'INTERNAL_ERROR' },
    { status: 500 },
  )

/** KE723은 13:52 도착(지연), KE724는 15:00 출발 */
async function openTab(
  seed: { placeId: number; date: string; memo?: string }[] = [],
  returnFlightNo = 'KE724',
) {
  const { tripId, ownerToken } = await createTrip({
    outboundFlightNo: 'KE723',
    returnFlightNo,
    cityCode: 'OSA',
    areaId: 11,
    startDate: '2026-11-30',
    endDate: '2026-12-02',
    manualOverride: null,
  })
  useOwnerTokens.getState().setToken(tripId, ownerToken)
  for (const { placeId, date, memo } of seed)
    await addItineraryItem(
      tripId,
      { placeId, date, plannedTime: null, memo },
      ownerToken,
    )
  const user = userEvent.setup()
  renderRoute(`/trips/${tripId}`)
  await user.click(await screen.findByRole('tab', { name: '일정' }))
  await screen.findByRole('region', { name: DAY1 })
  return user
}

const day = (name: string) => within(screen.getByRole('region', { name }))

/** 번호 뱃지는 aria-hidden이라 이름으로 순서를 읽는다 */
const names = (name: string) =>
  day(name)
    .queryAllByRole('listitem', { name: /오사카성|도톤보리|우메다/ })
    .map((li) => li.getAttribute('aria-label'))

const picker = () => within(screen.getByRole('region', { name: '추천 장소' }))

describe('ItineraryTab', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('re-reads the trip after the itinerary loads so a cancellation found by the refresh shows', async () => {
    const { tripId, ownerToken } = await createTrip({
      outboundFlightNo: 'KE723',
      returnFlightNo: 'KE724',
      cityCode: 'OSA',
      areaId: 11,
      startDate: '2026-11-30',
      endDate: '2026-12-02',
      manualOverride: null,
    })
    useOwnerTokens.getState().setToken(tripId, ownerToken)
    const saved = await getTrip(tripId, ownerToken)
    let reads = 0
    // 처음 받은 여행 상세는 Expected, 일정 GET이 재조회한 뒤에는 결항이다
    server.use(
      http.get('*/api/v1/trips/:tripId', () => {
        reads += 1
        return HttpResponse.json(
          reads === 1
            ? saved
            : { ...saved, return: { ...saved.return, status: 'Canceled' } },
        )
      }),
    )
    const user = userEvent.setup()
    renderRoute(`/trips/${tripId}`)
    await user.click(await screen.findByRole('tab', { name: '일정' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '결항 또는 결항 가능성',
    )
    expect(reads).toBeGreaterThanOrEqual(2)
  })

  it('renders every trip date, including empty days', async () => {
    await openTab()
    for (const name of [DAY1, DAY2, DAY3])
      expect(day(name).getByText('아직 일정이 없어요.')).toBeVisible()
  })

  it('shows earliestStart and latestEnd only on their own days', async () => {
    await openTab()
    // 입국 완료 14:52 → 라피트 15:05 출발 + 38분 + 도보 5분
    expect(day(DAY1).getByText('숙소 도착 예상 15:48 이후')).toBeVisible()
    // 마감 13:00 → 공항급행 12:15 탑승 → 12:00 숙소 출발 (귀국일 강조 문구와 같다)
    expect(day(DAY3).getByText('늦어도 12:00 숙소 출발')).toBeVisible()
    expect(day(DAY2).queryByText(/숙소 도착 예상/)).not.toBeInTheDocument()
    expect(day(DAY2).queryByText(/숙소 출발/)).not.toBeInTheDocument()
    expect(day(DAY1).queryByText(/숙소 출발/)).not.toBeInTheDocument()
    expect(day(DAY3).queryByText(/숙소 도착 예상/)).not.toBeInTheDocument()
  })

  it('formats the headers in the city timezone regardless of offset and browser zone', async () => {
    vi.stubEnv('TZ', 'America/New_York')
    server.use(
      http.get(ITINERARY_PATH, () =>
        HttpResponse.json({
          timezone: 'Asia/Tokyo',
          returnMarginMin: 45,
          days: [
            {
              date: '2026-11-30',
              dayIndex: 1,
              // 같은 순간을 UTC로 보내도 현지 00:30으로 보인다 (자정 넘김)
              earliestStart: '2026-11-29T15:30:00Z',
              latestEnd: null,
              items: [],
            },
          ],
        } satisfies Itinerary),
      ),
    )
    await openTab()
    expect(day(DAY1).getByText('숙소 도착 예상 00:30 이후')).toBeVisible()
  })

  it('adds a place from the picker to the chosen date and persists it', async () => {
    const user = await openTab()
    await user.selectOptions(screen.getByLabelText('추가할 날짜'), DAY2)
    await user.click(
      await picker().findByRole('button', { name: '오사카성 추가' }),
    )

    expect(await day(DAY2).findByText('오사카성')).toBeVisible()
    expect(day(DAY1).queryByText('오사카성')).not.toBeInTheDocument()
    expect(day(DAY1).getByText('아직 일정이 없어요.')).toBeVisible()
    expect(await picker().findByText('일정에 있음: 2일차')).toBeVisible()
    // 다시 받은 뒤에도 임시 항목이 아니라 서버 항목이다
    await waitFor(() =>
      expect(
        day(DAY2).getByRole('button', { name: '오사카성 삭제' }),
      ).toBeEnabled(),
    )
  })

  it('shows the added place before the server answers and sends the contract body', async () => {
    let body: unknown
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    server.use(
      http.post(ITEMS_PATH, async ({ request }) => {
        body = await request.clone().json()
        await held
      }),
    )
    const user = await openTab()
    await user.click(
      await picker().findByRole('button', { name: '도톤보리 추가' }),
    )

    expect(await day(DAY1).findByText('도톤보리')).toBeVisible()
    // 저장 전에는 서버가 모르는 항목이라 조작할 수 없다
    expect(
      day(DAY1).getByRole('button', { name: '도톤보리 삭제' }),
    ).toBeDisabled()
    expect(body).toEqual({
      placeId: DOTONBORI,
      date: '2026-11-30',
      plannedTime: null,
      memo: '',
    })
    release()
    await waitFor(() =>
      expect(
        day(DAY1).getByRole('button', { name: '도톤보리 삭제' }),
      ).toBeEnabled(),
    )
  })

  it('filters the picker by category', async () => {
    const user = await openTab()
    await picker().findByText('오사카성')
    expect(picker().getByRole('button', { name: '전체' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(picker().getByRole('button', { name: '맛집' }))
    expect(picker().getByRole('button', { name: '맛집' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await waitFor(() =>
      expect(picker().queryByText('오사카성')).not.toBeInTheDocument(),
    )
    expect(picker().getByText('도톤보리')).toBeVisible()
    expect(picker().queryByText('우메다 스카이빌딩')).not.toBeInTheDocument()

    await user.click(picker().getByRole('button', { name: '쇼핑' }))
    expect(
      await picker().findByText('이 카테고리에는 장소가 없습니다.'),
    ).toBeVisible()

    await user.click(picker().getByRole('button', { name: '전체' }))
    expect(await picker().findByText('우메다 스카이빌딩')).toBeVisible()
  })

  it('shows a retry when the place list fails', async () => {
    server.use(
      http.get('*/api/v1/cities/:cityCode/places', serverError, { once: true }),
    )
    const user = await openTab()
    const alert = await picker().findByRole('alert')
    expect(alert).toHaveTextContent('장소 목록을 불러오지 못했습니다.')
    await user.click(within(alert).getByRole('button', { name: '다시 시도' }))
    expect(await picker().findByText('오사카성')).toBeVisible()
  })

  it('deletes an item', async () => {
    const user = await openTab([
      { placeId: CASTLE, date: '2026-11-30' },
      { placeId: DOTONBORI, date: '2026-11-30' },
    ])
    await user.click(day(DAY1).getByRole('button', { name: '오사카성 삭제' }))

    await waitFor(() => expect(names(DAY1)).toEqual(['도톤보리']))
    // 낙관적 반영 후 다시 받아도 그대로다
    await waitFor(() =>
      expect(day(DAY1).queryByText('오사카성')).not.toBeInTheDocument(),
    )
  })

  it('moves items up and down with the same order request as dragging', async () => {
    const orders: unknown[] = []
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'PUT') orders.push(await request.clone().json())
    })
    const user = await openTab([
      { placeId: CASTLE, date: '2026-11-30' },
      { placeId: DOTONBORI, date: '2026-11-30' },
      { placeId: SKY, date: '2026-11-30' },
    ])
    const first = names(DAY1)
    expect(first).toEqual(['오사카성', '도톤보리', '우메다 스카이빌딩'])
    expect(
      day(DAY1).getByRole('button', { name: '오사카성 위로' }),
    ).toBeDisabled()
    expect(
      day(DAY1).getByRole('button', { name: '우메다 스카이빌딩 아래로' }),
    ).toBeDisabled()

    await user.click(day(DAY1).getByRole('button', { name: '오사카성 아래로' }))
    await waitFor(() =>
      expect(names(DAY1)).toEqual([
        '도톤보리',
        '오사카성',
        '우메다 스카이빌딩',
      ]),
    )
    await user.click(
      day(DAY1).getByRole('button', { name: '우메다 스카이빌딩 위로' }),
    )
    await waitFor(() =>
      expect(names(DAY1)).toEqual([
        '도톤보리',
        '우메다 스카이빌딩',
        '오사카성',
      ]),
    )
    await waitFor(() => expect(orders).toHaveLength(2))
    server.events.removeAllListeners()
  })

  it('keeps the order when several moves are sent in quick succession', async () => {
    let inFlight = 0
    let maxInFlight = 0
    server.use(
      http.put(ORDER_PATH, async () => {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        // 두 번째 클릭이 첫 응답 전에 일어나도록 충분히 붙잡는다
        await delay(200)
        inFlight -= 1
      }),
    )
    const user = await openTab([
      { placeId: CASTLE, date: '2026-11-30' },
      { placeId: DOTONBORI, date: '2026-11-30' },
      { placeId: SKY, date: '2026-11-30' },
    ])
    await user.click(day(DAY1).getByRole('button', { name: '오사카성 아래로' }))
    await user.click(day(DAY1).getByRole('button', { name: '오사카성 아래로' }))

    expect(names(DAY1)).toEqual(['도톤보리', '우메다 스카이빌딩', '오사카성'])
    await waitFor(() => expect(inFlight).toBe(0))
    await waitFor(() =>
      expect(names(DAY1)).toEqual([
        '도톤보리',
        '우메다 스카이빌딩',
        '오사카성',
      ]),
    )
    // scope로 묶여 PUT은 한 번에 하나씩 나간다
    expect(maxInFlight).toBe(1)
  })

  it('moves an item to another date, and the source day shows empty', async () => {
    const user = await openTab([
      { placeId: CASTLE, date: '2026-11-30', memo: '천수각' },
      { placeId: DOTONBORI, date: '2026-12-01' },
    ])
    await user.selectOptions(
      day(DAY1).getByRole('combobox', { name: '오사카성 날짜 옮기기' }),
      DAY2,
    )

    await waitFor(() => expect(names(DAY2)).toEqual(['도톤보리', '오사카성']))
    expect(await day(DAY1).findByText('아직 일정이 없어요.')).toBeVisible()
    await waitFor(() => expect(day(DAY2).getByText('천수각')).toBeVisible())
    expect(
      day(DAY2).getByRole('combobox', { name: '오사카성 날짜 옮기기' }),
    ).toHaveValue('2026-12-01')
  })

  it('edits, then clears, the time and the memo', async () => {
    const bodies: unknown[] = []
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'PATCH') bodies.push(await request.clone().json())
    })
    const user = await openTab([{ placeId: DOTONBORI, date: '2026-12-01' }])
    expect(day(DAY2).getByText('시간 미정')).toBeVisible()

    await user.click(
      day(DAY2).getByRole('button', { name: '도톤보리 시간·메모 수정' }),
    )
    await user.type(day(DAY2).getByLabelText('방문 예정 시각 (현지)'), '18:30')
    await user.type(day(DAY2).getByLabelText('메모'), '타코야키')
    await user.click(day(DAY2).getByRole('button', { name: '저장' }))

    expect(await day(DAY2).findByText('18:30')).toBeVisible()
    expect(day(DAY2).getByText('타코야키')).toBeVisible()
    expect(
      day(DAY2).queryByRole('button', { name: '저장' }),
    ).not.toBeInTheDocument()

    await user.click(
      day(DAY2).getByRole('button', { name: '도톤보리 시간·메모 수정' }),
    )
    expect(day(DAY2).getByLabelText('방문 예정 시각 (현지)')).toHaveValue(
      '18:30',
    )
    expect(day(DAY2).getByLabelText('메모')).toHaveValue('타코야키')
    await user.click(day(DAY2).getByRole('button', { name: '시각 지우기' }))
    await user.click(day(DAY2).getByRole('button', { name: '메모 지우기' }))
    await user.click(day(DAY2).getByRole('button', { name: '저장' }))

    expect(await day(DAY2).findByText('시간 미정')).toBeVisible()
    expect(day(DAY2).queryByText('타코야키')).not.toBeInTheDocument()
    await waitFor(() => expect(bodies).toHaveLength(2))
    expect(bodies).toEqual([
      { plannedTime: '18:30', memo: '타코야키' },
      { plannedTime: null, memo: '' },
    ])
    server.events.removeAllListeners()
  })

  it('limits the memo to 500 characters', async () => {
    const user = await openTab([{ placeId: DOTONBORI, date: '2026-12-01' }])
    await user.click(
      day(DAY2).getByRole('button', { name: '도톤보리 시간·메모 수정' }),
    )
    expect(day(DAY2).getByLabelText('메모')).toHaveAttribute('maxlength', '500')
    expect(day(DAY2).getByText('0/500')).toBeVisible()
  })

  it('keeps the form open and shows an error when saving fails', async () => {
    const user = await openTab([{ placeId: DOTONBORI, date: '2026-12-01' }])
    server.use(http.patch(ITEM_PATH, serverError))
    await user.click(
      day(DAY2).getByRole('button', { name: '도톤보리 시간·메모 수정' }),
    )
    await user.type(day(DAY2).getByLabelText('메모'), '실패')
    await user.click(day(DAY2).getByRole('button', { name: '저장' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '시각과 메모를 저장하지 못했어요',
    )
    expect(day(DAY2).getByLabelText('메모')).toHaveValue('실패')
  })

  describe('rollback on a failed change', () => {
    let releaseRefetch = () => {}

    /** 실패 뒤 다시 받기를 붙잡는다. 화면이 돌아온 것이 재조회가 아니라 롤백 덕분임을 보장한다 */
    const holdRefetch = () => {
      const held = new Promise<void>((resolve) => (releaseRefetch = resolve))
      server.use(
        http.get(ITINERARY_PATH, async () => {
          await held
        }),
      )
    }

    /** 응답을 늦춰 낙관적 상태를 먼저 확인할 수 있게 한다 */
    const failLater = async () => {
      await delay(50)
      return serverError()
    }

    afterEach(() => releaseRefetch())

    it('removes the optimistic place and shows an error', async () => {
      const user = await openTab()
      await picker().findByText('도톤보리')
      holdRefetch()
      server.use(http.post(ITEMS_PATH, failLater))
      await user.click(picker().getByRole('button', { name: '도톤보리 추가' }))
      expect(await day(DAY1).findByText('도톤보리')).toBeVisible()

      expect(await screen.findByRole('alert')).toHaveTextContent(
        '장소를 추가하지 못해 되돌렸어요',
      )
      expect(day(DAY1).queryByText('도톤보리')).not.toBeInTheDocument()
      expect(day(DAY1).getByText('아직 일정이 없어요.')).toBeVisible()
    })

    it('brings a deleted item back and shows an error', async () => {
      const user = await openTab([{ placeId: CASTLE, date: '2026-11-30' }])
      holdRefetch()
      server.use(http.delete(ITEM_PATH, failLater))
      await user.click(day(DAY1).getByRole('button', { name: '오사카성 삭제' }))
      await waitFor(() => expect(names(DAY1)).toEqual([]))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        '일정을 삭제하지 못해 되돌렸어요',
      )
      expect(names(DAY1)).toEqual(['오사카성'])
    })

    it('restores the order and the date, and lets the error be dismissed', async () => {
      const user = await openTab([
        { placeId: CASTLE, date: '2026-11-30' },
        { placeId: DOTONBORI, date: '2026-11-30' },
      ])
      holdRefetch()
      server.use(http.put(ORDER_PATH, failLater))

      await user.click(
        day(DAY1).getByRole('button', { name: '오사카성 아래로' }),
      )
      await waitFor(() => expect(names(DAY1)).toEqual(['도톤보리', '오사카성']))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '순서를 바꾸지 못해 되돌렸어요',
      )
      expect(names(DAY1)).toEqual(['오사카성', '도톤보리'])

      await user.selectOptions(
        day(DAY1).getByRole('combobox', { name: '오사카성 날짜 옮기기' }),
        DAY3,
      )
      await waitFor(() => expect(names(DAY1)).toEqual(['오사카성', '도톤보리']))
      expect(names(DAY3)).toEqual([])
      expect(await screen.findByRole('alert')).toBeVisible()

      await user.click(screen.getByRole('button', { name: '닫기' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    describe('when several changes overlap', () => {
      const ADD_FAILED = '장소를 추가하지 못해 되돌렸어요'
      const REORDER_FAILED = '순서를 바꾸지 못해 되돌렸어요'
      const seed = [
        { placeId: CASTLE, date: '2026-11-30' },
        { placeId: DOTONBORI, date: '2026-11-30' },
      ]

      /** 느린 POST 뒤에 순서 변경을 줄 세운다. 응답은 release로 함께 푼다 */
      const addThenReorder = async (
        user: Awaited<ReturnType<typeof openTab>>,
        respond: {
          post?: () => Response | undefined
          put?: () => Response | undefined
        },
      ) => {
        await picker().findByText('우메다 스카이빌딩')
        let release = () => {}
        const held = new Promise<void>((resolve) => (release = resolve))
        server.use(
          http.post(ITEMS_PATH, async () => {
            await held
            return respond.post?.()
          }),
          http.put(ORDER_PATH, () => respond.put?.()),
          http.get(ITINERARY_PATH, serverError),
        )
        await user.click(
          picker().getByRole('button', { name: '우메다 스카이빌딩 추가' }),
        )
        await day(DAY1).findByText('우메다 스카이빌딩')
        await user.click(
          day(DAY1).getByRole('button', { name: '오사카성 아래로' }),
        )
        expect(names(DAY1)).toEqual([
          '도톤보리',
          '오사카성',
          '우메다 스카이빌딩',
        ])
        release()
      }

      const banner = () =>
        screen
          .getAllByRole('alert')
          .find((a) => a.hasAttribute('data-floating-banner'))

      it('leaves no ghost and reports both failures when everything fails, even the refetch', async () => {
        const user = await openTab(seed)
        await addThenReorder(user, { post: serverError, put: serverError })

        await waitFor(() => expect(banner()).toHaveTextContent(REORDER_FAILED))
        expect(banner()).toHaveTextContent(ADD_FAILED)
        await waitFor(() =>
          expect(names(DAY1)).toEqual(['오사카성', '도톤보리']),
        )
        // 다시 받기 실패도 재시도와 함께 알린다
        expect(
          await screen.findByRole('button', { name: '다시 시도' }),
        ).toBeVisible()
        expect(names(DAY1)).toEqual(['오사카성', '도톤보리'])
      })

      it('drops the ghost but keeps the saved reorder when the refetch also fails', async () => {
        const user = await openTab(seed)
        await addThenReorder(user, { post: serverError })

        await waitFor(() => expect(banner()).toHaveTextContent(ADD_FAILED))
        await waitFor(() =>
          expect(names(DAY1)).toEqual(['도톤보리', '오사카성']),
        )
        await screen.findByRole('button', { name: '다시 시도' })
        expect(names(DAY1)).toEqual(['도톤보리', '오사카성'])
      })

      it('keeps a saved place when only the later reorder fails', async () => {
        const user = await openTab(seed)
        await addThenReorder(user, { put: serverError })

        await waitFor(() => expect(banner()).toHaveTextContent(REORDER_FAILED))
        await screen.findByRole('button', { name: '다시 시도' })
        expect(
          day(DAY1).getByRole('button', { name: '우메다 스카이빌딩 삭제' }),
        ).toBeEnabled()
      })

      it('clears the old failures when a new change starts after the batch', async () => {
        const user = await openTab(seed)
        await addThenReorder(user, { post: serverError, put: serverError })
        await waitFor(() => expect(banner()).toHaveTextContent(ADD_FAILED))
        await waitFor(() =>
          expect(names(DAY1)).toEqual(['오사카성', '도톤보리']),
        )

        server.use(http.delete(ITEM_PATH, serverError))
        await user.click(
          day(DAY1).getByRole('button', { name: '오사카성 삭제' }),
        )
        await waitFor(() =>
          expect(banner()).toHaveTextContent('일정을 삭제하지 못해 되돌렸어요'),
        )
        expect(banner()).not.toHaveTextContent(ADD_FAILED)
      })
    })

    it('leaves room at the page bottom so the banner can scroll clear of the last button', async () => {
      const user = await openTab()
      await picker().findByText('도톤보리')
      expect(screen.getByRole('main').className).toContain(
        'has-data-floating-banner:pb-48',
      )
      server.use(http.post(ITEMS_PATH, serverError))
      await user.click(picker().getByRole('button', { name: '도톤보리 추가' }))
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveAttribute('data-floating-banner')
      expect(screen.getByRole('main')).toContainElement(alert)
    })

    it('explains a stale item with the server error code', async () => {
      const user = await openTab([{ placeId: CASTLE, date: '2026-11-30' }])
      server.use(
        http.delete(ITEM_PATH, () =>
          HttpResponse.json(
            {
              title: 'Not Found',
              status: 404,
              code: 'ITINERARY_ITEM_NOT_FOUND',
            },
            { status: 404 },
          ),
        ),
      )
      await user.click(day(DAY1).getByRole('button', { name: '오사카성 삭제' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '이미 삭제된 일정이에요',
      )
    })
  })

  it('shows each warning as text with an icon, not by color alone', async () => {
    server.use(
      http.get(ITINERARY_PATH, () =>
        HttpResponse.json({
          timezone: 'Asia/Tokyo',
          returnMarginMin: 45,
          days: [
            {
              date: '2026-11-30',
              dayIndex: 1,
              earliestStart: null,
              latestEnd: null,
              items: [
                {
                  itemId: 1,
                  position: 0,
                  plannedTime: '03:00',
                  memo: '',
                  place: {
                    id: CASTLE,
                    nameKo: '오사카성',
                    category: 'SIGHT',
                    lat: 34.6,
                    lng: 135.5,
                    durationMin: 90,
                  },
                  warnings: [
                    'OUTSIDE_OPENING_HOURS',
                    'BEFORE_ARRIVAL',
                    'AFTER_DEPARTURE_LEAVE_TIME',
                  ],
                },
              ],
            },
          ],
        } satisfies Itinerary),
      ),
    )
    await openTab()
    const warnings = [
      '영업시간이 아니거나 머무는 중에 문을 닫을 수 있어요.',
      '숙소 도착 예상 시각보다 이른 일정이에요.',
      // 여유 시간은 서버가 준 값을 쓴다
      '숙소로 돌아갈 여유 45분 포함 기준, 숙소 출발 시각을 넘겨요.',
    ]
    for (const text of warnings) {
      const warning = day(DAY1).getByText(text)
      expect(warning).toBeVisible()
      expect(warning.querySelector('svg')).toBeInTheDocument()
    }
  })

  it('refreshes the warnings from the server after saving a time', async () => {
    const user = await openTab([{ placeId: CASTLE, date: '2026-11-30' }])
    expect(
      day(DAY1).queryByText(/머무는 중에 문을 닫을/),
    ).not.toBeInTheDocument()

    // 11월 30일은 월요일, 오사카성은 09:00~17:00. 08:00은 입국 전이기도 하다
    await user.click(
      day(DAY1).getByRole('button', { name: '오사카성 시간·메모 수정' }),
    )
    await user.type(day(DAY1).getByLabelText('방문 예정 시각 (현지)'), '08:00')
    await user.click(day(DAY1).getByRole('button', { name: '저장' }))

    expect(await day(DAY1).findByText(/머무는 중에 문을 닫을/)).toBeVisible()
    expect(
      day(DAY1).getByText('숙소 도착 예상 시각보다 이른 일정이에요.'),
    ).toBeVisible()
  })

  it('warns when a visit runs past closing, not only when it starts outside the hours', async () => {
    const user = await openTab([{ placeId: CASTLE, date: '2026-11-30' }])
    // 16:00 입장 + 90분 = 17:30, 오사카성은 17:00에 닫는다
    await user.click(
      day(DAY1).getByRole('button', { name: '오사카성 시간·메모 수정' }),
    )
    await user.type(day(DAY1).getByLabelText('방문 예정 시각 (현지)'), '16:00')
    await user.click(day(DAY1).getByRole('button', { name: '저장' }))

    expect(await day(DAY1).findByText(/머무는 중에 문을 닫을/)).toBeVisible()
  })

  it('counts the return margin against the departure leave time and says the margin is an estimate', async () => {
    const user = await openTab([{ placeId: DOTONBORI, date: '2026-12-02' }])
    expect(
      screen.getByText(
        '숙소로 돌아갈 여유 30분은 실제 거리와 무관한 추정치예요.',
      ),
    ).toBeVisible()
    // 마감 12:00. 09:30 + 120분 = 11:30은 그 자체로 맞지만 여유 30분을 더하면 12:00으로 경계, 09:31부터 넘는다
    await user.click(
      day(DAY3).getByRole('button', { name: '도톤보리 시간·메모 수정' }),
    )
    await user.type(day(DAY3).getByLabelText('방문 예정 시각 (현지)'), '09:31')
    await user.click(day(DAY3).getByRole('button', { name: '저장' }))

    expect(
      await day(DAY3).findByText(
        '숙소로 돌아갈 여유 30분 포함 기준, 숙소 출발 시각을 넘겨요.',
      ),
    ).toBeVisible()
  })

  it('shows the canceled-flight banner of the departure tab', async () => {
    await openTab([], 'LJ232')
    expect(screen.getByRole('alert')).toHaveTextContent(
      '결항 또는 결항 가능성이 있는 항공편',
    )
  })

  it('does not show the canceled-flight banner for a normal flight', async () => {
    await openTab()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('explains a full day with the server error code', async () => {
    const user = await openTab()
    await picker().findByText('도톤보리')
    server.use(
      http.post(ITEMS_PATH, () =>
        HttpResponse.json(
          { title: 'Bad Request', status: 400, code: 'ITINERARY_DAY_FULL' },
          { status: 400 },
        ),
      ),
    )
    await user.click(picker().getByRole('button', { name: '도톤보리 추가' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '이 날짜에는 일정을 더 넣을 수 없어요',
    )
  })

  describe('while changes are in flight', () => {
    afterEach(() => {
      onlineManager.setOnline(true)
      focusManager.setFocused(undefined)
    })

    const refocus = () =>
      act(() => {
        focusManager.setFocused(false)
        focusManager.setFocused(true)
      })

    const countItineraryRequests = () => {
      const counter = { gets: 0 }
      server.events.on('request:start', ({ request }) => {
        if (
          request.method === 'GET' &&
          new URL(request.url).pathname.endsWith('/itinerary')
        )
          counter.gets += 1
      })
      return counter
    }

    it('rolls back at once and says so when offline, instead of pausing as if saved', async () => {
      const user = await openTab([
        { placeId: CASTLE, date: '2026-11-30' },
        { placeId: DOTONBORI, date: '2026-11-30' },
      ])
      onlineManager.setOnline(false)
      server.use(http.put(ORDER_PATH, () => HttpResponse.error()))
      await user.click(
        day(DAY1).getByRole('button', { name: '오사카성 아래로' }),
      )

      expect(await screen.findByRole('alert')).toHaveTextContent(
        '순서를 바꾸지 못해 되돌렸어요',
      )
      expect(names(DAY1)).toEqual(['오사카성', '도톤보리'])
    })

    it('shows a failure on returning to the tab, when it happened while on another tab', async () => {
      const user = await openTab([
        { placeId: CASTLE, date: '2026-11-30' },
        { placeId: DOTONBORI, date: '2026-11-30' },
      ])
      let release = () => {}
      const held = new Promise<void>((resolve) => (release = resolve))
      server.use(
        http.put(ORDER_PATH, async () => {
          await held
          return serverError()
        }),
      )
      await user.click(
        day(DAY1).getByRole('button', { name: '오사카성 아래로' }),
      )
      await user.click(screen.getByRole('tab', { name: '귀국일' }))
      release()
      await waitFor(() =>
        expect(
          Object.values(useItineraryFailures.getState().failures),
        ).toHaveLength(1),
      )

      await user.click(screen.getByRole('tab', { name: '일정' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '순서를 바꾸지 못해 되돌렸어요',
      )
      await user.click(screen.getByRole('button', { name: '닫기' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      await screen.findByRole('region', { name: DAY1 })
      expect(names(DAY1)).toEqual(['오사카성', '도톤보리'])
    })

    it('does not refetch on focus during a change, and does when idle', async () => {
      const user = await openTab([
        { placeId: CASTLE, date: '2026-11-30' },
        { placeId: DOTONBORI, date: '2026-11-30' },
      ])
      const counter = countItineraryRequests()
      refocus()
      await waitFor(() => expect(counter.gets).toBe(1))

      let release = () => {}
      const held = new Promise<void>((resolve) => (release = resolve))
      server.use(
        http.put(ORDER_PATH, async () => {
          await held
        }),
      )
      await user.click(
        day(DAY1).getByRole('button', { name: '오사카성 아래로' }),
      )
      await waitFor(() => expect(names(DAY1)).toEqual(['도톤보리', '오사카성']))
      counter.gets = 0
      refocus()
      await delay(50)
      expect(counter.gets).toBe(0)
      expect(names(DAY1)).toEqual(['도톤보리', '오사카성'])

      release()
      await waitFor(() => expect(counter.gets).toBe(1))
      await waitFor(() => expect(names(DAY1)).toEqual(['도톤보리', '오사카성']))
      server.events.removeAllListeners()
    })

    it('does not refetch on returning to the tab during a change, and still loads a first visit', async () => {
      const user = await openTab([
        { placeId: CASTLE, date: '2026-11-30' },
        { placeId: DOTONBORI, date: '2026-11-30' },
      ])
      const counter = countItineraryRequests()
      let release = () => {}
      const held = new Promise<void>((resolve) => (release = resolve))
      server.use(
        http.put(ORDER_PATH, async () => {
          await held
        }),
      )
      await user.click(
        day(DAY1).getByRole('button', { name: '오사카성 아래로' }),
      )
      await waitFor(() => expect(names(DAY1)).toEqual(['도톤보리', '오사카성']))

      await user.click(screen.getByRole('tab', { name: '귀국일' }))
      await user.click(screen.getByRole('tab', { name: '일정' }))
      await delay(50)
      expect(counter.gets).toBe(0)
      expect(names(DAY1)).toEqual(['도톤보리', '오사카성'])

      // 마운트 때 다시 받는 일반 동작은 변경이 없으면 그대로다
      release()
      await waitFor(() => expect(counter.gets).toBe(1))
      await user.click(screen.getByRole('tab', { name: '귀국일' }))
      await user.click(screen.getByRole('tab', { name: '일정' }))
      await waitFor(() => expect(counter.gets).toBe(2))
      server.events.removeAllListeners()
    })

    it('sends the real id of a slow new place in a later order, so the screen order holds', async () => {
      const orders: { itemIds: number[] }[] = []
      server.events.on('request:start', async ({ request }) => {
        if (request.method === 'PUT')
          orders.push((await request.clone().json()) as { itemIds: number[] })
      })
      const user = await openTab([
        { placeId: CASTLE, date: '2026-11-30' },
        { placeId: DOTONBORI, date: '2026-11-30' },
      ])
      await picker().findByText('우메다 스카이빌딩')
      let release = () => {}
      const held = new Promise<void>((resolve) => (release = resolve))
      server.use(
        http.post(ITEMS_PATH, async () => {
          await held
        }),
      )
      await user.click(
        picker().getByRole('button', { name: '우메다 스카이빌딩 추가' }),
      )
      await day(DAY1).findByText('우메다 스카이빌딩')
      await user.click(
        day(DAY1).getByRole('button', { name: '도톤보리 아래로' }),
      )
      const onScreen = ['오사카성', '우메다 스카이빌딩', '도톤보리']
      expect(names(DAY1)).toEqual(onScreen)

      release()
      await waitFor(() => expect(orders).toHaveLength(1))
      expect(orders[0].itemIds).toHaveLength(3)
      expect(orders[0].itemIds.every((id) => id > 0)).toBe(true)
      // 다시 받은 서버 순서도 화면과 같다
      await waitFor(() =>
        expect(
          day(DAY1).getByRole('button', { name: '우메다 스카이빌딩 삭제' }),
        ).toBeEnabled(),
      )
      await delay(50)
      expect(names(DAY1)).toEqual(onScreen)
      server.events.removeAllListeners()
    })
  })

  describe('keyboard dragging', () => {
    const keyboardMove = async (
      user: Awaited<ReturnType<typeof openTab>>,
      name: string,
      key: string,
    ) => {
      screen.getByRole('button', { name: `${name} 끌어서 옮기기` }).focus()
      await user.keyboard('[Space]')
      await delay(10)
      await user.keyboard(key)
      await delay(10)
      await user.keyboard('[Space]')
    }

    const seed = [
      { placeId: CASTLE, date: '2026-11-30' },
      { placeId: DOTONBORI, date: '2026-12-01' },
      { placeId: SKY, date: '2026-12-01' },
    ]

    it('moves the first item up to the end of the previous day', async () => {
      const user = await openTab(seed)
      await keyboardMove(user, '도톤보리', '[ArrowUp]')
      await waitFor(() => expect(names(DAY1)).toEqual(['오사카성', '도톤보리']))
      expect(names(DAY2)).toEqual(['우메다 스카이빌딩'])
    })

    it('moves the last item down to the start of the next day', async () => {
      const user = await openTab(seed)
      await keyboardMove(user, '오사카성', '[ArrowDown]')
      await waitFor(() =>
        expect(names(DAY2)).toEqual([
          '오사카성',
          '도톤보리',
          '우메다 스카이빌딩',
        ]),
      )
      expect(names(DAY1)).toEqual([])
    })

    it('moves the only item into an empty day in either direction', async () => {
      const user = await openTab([{ placeId: CASTLE, date: '2026-12-01' }])
      await keyboardMove(user, '오사카성', '[ArrowUp]')
      await waitFor(() => expect(names(DAY1)).toEqual(['오사카성']))
      await waitFor(() =>
        expect(
          day(DAY1).getByRole('button', { name: '오사카성 끌어서 옮기기' }),
        ).toBeEnabled(),
      )
      await keyboardMove(user, '오사카성', '[ArrowDown]')
      await waitFor(() => expect(names(DAY2)).toEqual(['오사카성']))
    })

    it('reorders inside a day and leaves everything alone on Escape', async () => {
      const user = await openTab(seed)
      await keyboardMove(user, '도톤보리', '[ArrowDown]')
      await waitFor(() =>
        expect(names(DAY2)).toEqual(['우메다 스카이빌딩', '도톤보리']),
      )

      screen
        .getByRole('button', { name: '우메다 스카이빌딩 끌어서 옮기기' })
        .focus()
      await user.keyboard('[Space]')
      await delay(10)
      await user.keyboard('[ArrowUp]')
      await delay(10)
      await user.keyboard('[Escape]')
      await delay(10)
      expect(names(DAY1)).toEqual(['오사카성'])
      expect(names(DAY2)).toEqual(['우메다 스카이빌딩', '도톤보리'])
    })
  })

  it('opens the map only on request, and shows the no-key notice with a numbered list', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', '')
    const user = await openTab([
      { placeId: CASTLE, date: '2026-11-30' },
      { placeId: DOTONBORI, date: '2026-11-30' },
    ])
    expect(
      screen.queryByRole('list', { name: '방문 순서' }),
    ).not.toBeInTheDocument()

    await user.click(day(DAY1).getByRole('button', { name: '지도 보기' }))
    expect(day(DAY1).getByRole('status')).toHaveTextContent(
      '지도 키가 설정되지 않아',
    )
    expect(
      within(day(DAY1).getByRole('list', { name: '방문 순서' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['1오사카성', '2도톤보리'])
    expect(day(DAY2).queryByRole('status')).not.toBeInTheDocument()

    // 순서를 바꾸면 목록도 따라간다
    await user.click(day(DAY1).getByRole('button', { name: '오사카성 아래로' }))
    await waitFor(() =>
      expect(
        within(day(DAY1).getByRole('list', { name: '방문 순서' }))
          .getAllByRole('listitem')
          .map((li) => li.textContent),
      ).toEqual(['1도톤보리', '2오사카성']),
    )

    await user.click(day(DAY1).getByRole('button', { name: '지도 닫기' }))
    expect(
      screen.queryByRole('list', { name: '방문 순서' }),
    ).not.toBeInTheDocument()
  })

  describe('transfer settings', () => {
    const watchItineraryRequests = () => {
      const requested: (string | null)[][] = []
      server.events.on('request:start', ({ request }) => {
        const url = new URL(request.url)
        if (url.pathname.endsWith('/itinerary'))
          requested.push([
            url.searchParams.get('immigrationMin'),
            url.searchParams.get('airportBufferMin'),
          ])
      })
      return requested
    }

    it('sends the defaults and states them', async () => {
      const requested = watchItineraryRequests()
      await openTab()
      expect(requested[0]).toEqual(['60', '120'])
      expect(screen.getByText(/입국 60분, 공항 여유 2시간 기준/)).toBeVisible()
      server.events.removeAllListeners()
    })

    it('follows the stored settings and updates the headers', async () => {
      const requested = watchItineraryRequests()
      useTransferSettings.setState({
        immigrationMin: 30,
        airportBufferMin: 180,
      })
      await openTab()

      expect(requested[0]).toEqual(['30', '180'])
      // 입국 완료 14:22 → 라피트 14:35 + 43분
      expect(day(DAY1).getByText('숙소 도착 예상 15:18 이후')).toBeVisible()
      // 마감 12:00 → 공항급행 11:15 탑승 → 11:00 숙소 출발
      expect(day(DAY3).getByText('늦어도 11:00 숙소 출발')).toBeVisible()
      server.events.removeAllListeners()
    })

    it('refetches on a change and never shows the old time while loading', async () => {
      const requested = watchItineraryRequests()
      await openTab()
      expect(day(DAY3).getByText('늦어도 12:00 숙소 출발')).toBeVisible()

      act(() => useTransferSettings.setState({ airportBufferMin: 150 }))
      expect(
        screen.queryByText('늦어도 12:00 숙소 출발'),
      ).not.toBeInTheDocument()

      await waitFor(() => expect(requested.at(-1)).toEqual(['60', '150']))
      // 마감 12:30 → 공항급행 11:45 탑승 → 11:30 숙소 출발
      expect(await screen.findByText('늦어도 11:30 숙소 출발')).toBeVisible()
      server.events.removeAllListeners()
    })
  })

  it('shows an error with a retry when the itinerary fails to load', async () => {
    server.use(http.get(ITINERARY_PATH, serverError, { once: true }))
    const { tripId, ownerToken } = await createTrip({
      outboundFlightNo: 'KE723',
      returnFlightNo: 'KE724',
      cityCode: 'OSA',
      areaId: 11,
      startDate: '2026-11-30',
      endDate: '2026-12-02',
      manualOverride: null,
    })
    useOwnerTokens.getState().setToken(tripId, ownerToken)
    const user = userEvent.setup()
    renderRoute(`/trips/${tripId}`)
    await user.click(await screen.findByRole('tab', { name: '일정' }))

    const alert = await screen.findByRole('alert')
    await user.click(within(alert).getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('region', { name: DAY1 })).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
