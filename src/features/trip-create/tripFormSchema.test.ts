import { describe, expect, it } from 'vitest'
import {
  makeTripFormSchema,
  tripFormDefaults,
  tripFormSchema,
} from './tripFormSchema'

const parse = (startDate: string, endDate: string) =>
  tripFormSchema.safeParse({
    ...tripFormDefaults,
    outboundFlightNo: 'KE723',
    returnFlightNo: 'KE724',
    cityCode: 'OSA',
    areaId: '11',
    startDate,
    endDate,
  })

const endDateErrors = (startDate: string, endDate: string) => {
  const result = parse(startDate, endDate)
  return result.success
    ? []
    : result.error.issues
        .filter((i) => i.path[0] === 'endDate')
        .map((i) => i.message)
}

// 백엔드와 동일: ChronoUnit.DAYS(start, end) > 30 이면 INVALID_DATE_RANGE
describe('tripFormSchema trip length', () => {
  it('allows a same-day trip', () => {
    expect(parse('2026-11-01', '2026-11-01').success).toBe(true)
  })

  it('allows exactly 30 days (11-01 → 12-01)', () => {
    expect(parse('2026-11-01', '2026-12-01').success).toBe(true)
  })

  it('rejects 31 days (11-01 → 12-02)', () => {
    expect(endDateErrors('2026-11-01', '2026-12-02')).toEqual([
      '여행 기간은 최대 30일입니다.',
    ])
  })

  it('rejects an end date before the start date', () => {
    expect(endDateErrors('2026-11-02', '2026-11-01')).toEqual([
      '종료일은 시작일보다 빠를 수 없습니다.',
    ])
  })
})

describe('tripFormSchema manual time order', () => {
  const parseManual = (outboundAt: string, returnAt: string) =>
    makeTripFormSchema('Asia/Tokyo').safeParse({
      ...tripFormDefaults,
      outboundFlightNo: 'KE723',
      returnFlightNo: 'KE724',
      cityCode: 'OSA',
      areaId: '11',
      startDate: '2026-11-05',
      endDate: '2026-11-05',
      outboundManual: true,
      outboundAirport: 'KIX',
      outboundAt,
      returnManual: true,
      returnAirport: 'KIX',
      returnAt,
    })
  const returnAtErrors = (outboundAt: string, returnAt: string) => {
    const result = parseManual(outboundAt, returnAt)
    return result.success
      ? []
      : result.error.issues
          .filter((i) => i.path[0] === 'returnAt')
          .map((i) => i.message)
  }

  it('accepts a return departure after the outbound arrival', () => {
    expect(parseManual('2026-11-05T09:00', '2026-11-05T21:00').success).toBe(
      true,
    )
  })

  it('rejects a return departure at or before the outbound arrival', () => {
    const message = '오는 편 출발 시각은 가는 편 도착 시각보다 늦어야 합니다.'
    expect(returnAtErrors('2026-11-05T13:45', '2026-11-05T13:45')).toEqual([
      message,
    ])
    expect(returnAtErrors('2026-11-05T13:45', '2026-11-05T09:00')).toEqual([
      message,
    ])
  })

  // 백엔드와 동일: 가는 편 도착일은 시작일 또는 그다음 날, 오는 편 출발일은 종료일
  it('rejects an outbound arrival outside the start date and the day after', () => {
    const errors = (outboundAt: string) => {
      const result = parseManual(outboundAt, '2026-11-05T23:59')
      return result.success
        ? []
        : result.error.issues
            .filter((i) => i.path[0] === 'outboundAt')
            .map((i) => i.message)
    }
    const message = '가는 편 도착일은 시작일 또는 그다음 날이어야 합니다.'
    expect(errors('2026-11-04T23:59')).toEqual([message])
    expect(errors('2026-11-07T00:00')).toEqual([message])
    expect(errors('2026-11-05T00:00')).toEqual([])
    expect(errors('2026-11-06T23:59')).toEqual([])
  })

  it('rejects a return departure that is not on the end date', () => {
    const message = '오는 편 출발일은 종료일과 같아야 합니다.'
    expect(returnAtErrors('2026-11-05T09:00', '2026-11-06T00:00')).toEqual([
      message,
    ])
    expect(returnAtErrors('2026-11-05T09:00', '2026-11-05T23:59')).toEqual([])
  })

  it('skips the order check when only one direction is manual', () => {
    const result = makeTripFormSchema('Asia/Tokyo').safeParse({
      ...tripFormDefaults,
      outboundFlightNo: 'KE723',
      returnFlightNo: 'KE724',
      cityCode: 'OSA',
      areaId: '11',
      startDate: '2026-11-05',
      endDate: '2026-11-05',
      outboundManual: true,
      outboundAirport: 'KIX',
      outboundAt: '2026-11-05T23:00',
    })
    expect(result.success).toBe(true)
  })
})
