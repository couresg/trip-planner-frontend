import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { createTrip } from '@/api/trips'
import { server } from '@/mocks/server'
import { useOwnerTokens } from '@/stores/ownerTokens'
import { renderRoute } from '@/test/renderRoute'

const PATH = '*/api/v1/trips/:tripId/recommendations/places'
const DAY1 = '1일차 · 11월 30일 (월)'
const DAY2 = '2일차 · 12월 1일 (화)'

async function openTab() {
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
  await screen.findByRole('region', { name: DAY1 })
  return user
}

const panel = () => within(screen.getByRole('region', { name: '추천 받기' }))
const picker = () => within(screen.getByRole('region', { name: '추천 장소' }))
const day = (name: string) => within(screen.getByRole('region', { name }))
const submitButton = () => panel().getByRole('button', { name: '추천 받기' })

describe('RecommendationPanel', () => {
  it('needs at least one category and sends categories in a fixed order with the pace', async () => {
    let url: URL | undefined
    server.use(
      http.get(PATH, ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({
          pace: 'PACKED',
          placesPerDay: 5,
          dayCount: 3,
          candidateCount: 0,
          recommendations: [],
        })
      }),
    )
    const user = await openTab()
    expect(submitButton()).toBeDisabled()
    expect(
      panel().getByText('관심 카테고리를 하나 이상 고르세요.'),
    ).toBeVisible()

    await user.click(
      panel().getByRole('button', { name: '관심 카테고리 야경' }),
    )
    await user.click(
      panel().getByRole('button', { name: '관심 카테고리 관광' }),
    )
    await user.click(panel().getByRole('radio', { name: /알차게/ }))
    expect(panel().getByRole('radio', { name: /알차게/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await user.click(submitButton())

    expect(
      await panel().findByText(
        '추천할 장소가 없어요. 이 도시의 장소가 모두 일정에 있어요.',
      ),
    ).toBeVisible()
    expect(url?.searchParams.get('categories')).toBe('SIGHT,NIGHT')
    expect(url?.searchParams.get('pace')).toBe('PACKED')
  })

  it('shows a skeleton while loading, then ranked places with reasons', async () => {
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    server.use(
      http.get(PATH, async () => {
        await held
        return undefined
      }),
    )
    const user = await openTab()
    await user.click(
      panel().getByRole('button', { name: '관심 카테고리 관광' }),
    )
    await user.click(
      panel().getByRole('button', { name: '관심 카테고리 야경' }),
    )
    await user.click(submitButton())

    expect(panel().getByLabelText('불러오는 중...')).toBeInTheDocument()
    release()

    const list = within(await panel().findByRole('list', { name: '추천 결과' }))
    const items = list.getAllByRole('listitem')
    // 3일 × 보통 3곳 = 9곳이지만 후보가 3곳뿐이다. 관광 → 야경 → 관심 밖(맛집)
    expect(items).toHaveLength(3)
    expect(within(items[0]).getByText('1위')).toBeVisible()
    expect(within(items[0]).getByText('오사카성')).toBeVisible()
    expect(
      within(items[0]).getByText('관심사와 맞아요 · 천수각 전망대와 넓은 공원'),
    ).toBeVisible()
    expect(within(items[1]).getByText('우메다 스카이빌딩')).toBeVisible()
    expect(within(items[2]).getByText('3위')).toBeVisible()
    expect(within(items[2]).getByText('도톤보리')).toBeVisible()
  })

  it('adds a recommended place to the chosen date with the existing add flow', async () => {
    const user = await openTab()
    await user.selectOptions(screen.getByLabelText('추가할 날짜'), DAY2)
    await user.click(
      panel().getByRole('button', { name: '관심 카테고리 관광' }),
    )
    await user.click(submitButton())
    await user.click(
      await panel().findByRole('button', { name: '추천 1위 오사카성 추가' }),
    )

    expect(await day(DAY2).findByText('오사카성')).toBeVisible()
    expect(day(DAY1).queryByText('오사카성')).not.toBeInTheDocument()
    // 추천 목록은 그대로 두고 일정에 넣은 것만 표시한다 (자동으로 다시 받지 않는다)
    const first = within(panel().getAllByRole('listitem')[0] as HTMLElement)
    expect(await first.findByText('일정에 있음: 2일차')).toBeVisible()
    expect(first.getByText('오사카성')).toBeVisible()
  })

  it('explains a recommender outage, keeps the place list usable, and retries', async () => {
    let calls = 0
    server.use(
      http.get(PATH, () => {
        calls += 1
        if (calls === 1)
          return HttpResponse.json(
            {
              title: '장소 추천기 장애',
              status: 503,
              detail:
                '지금은 장소를 추천할 수 없습니다. 잠시 후 다시 시도하세요.',
              code: 'RECOMMENDATION_UNAVAILABLE',
            },
            { status: 503 },
          )
        return HttpResponse.json({
          pace: 'NORMAL',
          placesPerDay: 3,
          dayCount: 3,
          candidateCount: 3,
          recommendations: [
            {
              rank: 1,
              reason: '관심사와 맞아요',
              place: {
                id: 530,
                nameKo: '우메다 스카이빌딩',
                category: 'NIGHT',
                lat: 34.7053,
                lng: 135.4906,
                openingHours: [],
                alwaysOpen: true,
                durationMin: 60,
                summary: '공중정원 전망대 야경',
              },
            },
          ],
        })
      }),
    )
    const user = await openTab()
    await user.click(
      panel().getByRole('button', { name: '관심 카테고리 야경' }),
    )
    await user.click(submitButton())

    const alert = await panel().findByRole('alert')
    expect(alert).toHaveTextContent(
      '지금은 추천을 받을 수 없어요. 아래 장소 목록에서 직접 고를 수 있어요.',
    )
    // 장소 목록과 추가는 그대로 쓸 수 있다
    await user.click(
      await picker().findByRole('button', { name: '오사카성 추가' }),
    )
    expect(await day(DAY1).findByText('오사카성')).toBeVisible()

    await user.click(within(alert).getByRole('button', { name: '다시 시도' }))
    expect(
      await panel().findByRole('button', {
        name: '추천 1위 우메다 스카이빌딩 추가',
      }),
    ).toBeVisible()
    expect(panel().queryByRole('alert')).not.toBeInTheDocument()
  })

  it('excludes places already in the itinerary when asked again with the same input', async () => {
    const user = await openTab()
    await user.click(
      panel().getByRole('button', { name: '관심 카테고리 관광' }),
    )
    await user.click(submitButton())
    await user.click(
      await panel().findByRole('button', { name: '추천 1위 오사카성 추가' }),
    )
    await day(DAY1).findByText('오사카성')

    await waitFor(() => expect(submitButton()).toBeEnabled())
    await user.click(submitButton())
    await waitFor(() =>
      expect(
        panel().queryByRole('button', { name: /오사카성 추가/ }),
      ).not.toBeInTheDocument(),
    )
    expect(
      panel().getByRole('button', { name: '추천 1위 도톤보리 추가' }),
    ).toBeVisible()
  })
})
