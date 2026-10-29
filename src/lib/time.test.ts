import { describe, expect, it } from 'vitest'
import {
  dayDiff,
  formatDayBadge,
  formatLocal,
  isoOffsetZone,
  zonedInputToIso,
} from './time'

describe('formatLocal', () => {
  it('shows a UTC instant in Asia/Tokyo regardless of process TZ', () => {
    expect(formatLocal('2026-03-10T14:30:00Z', 'Asia/Tokyo')).toBe('23:30')
    expect(formatLocal('2026-03-10T14:30:00+00:00', 'Asia/Tokyo')).toBe('23:30')
  })

  it('converts from a different input offset', () => {
    expect(formatLocal('2026-03-10T23:30:00+09:00', 'Asia/Seoul')).toBe('23:30')
    expect(
      formatLocal(
        '2026-03-10T23:30:00+09:00',
        'Europe/Paris',
        'yyyy-MM-dd HH:mm',
      ),
    ).toBe('2026-03-10 15:30')
  })

  it('throws RangeError on invalid ISO', () => {
    expect(() => formatLocal('not-a-date', 'Asia/Tokyo')).toThrow(RangeError)
  })
})

describe('dayDiff', () => {
  it('is 0 on the same local day', () => {
    expect(
      dayDiff(
        '2026-03-10T10:00:00+09:00',
        '2026-03-10T22:00:00+09:00',
        'Asia/Tokyo',
      ),
    ).toBe(0)
  })

  it('is 1 when crossing midnight (23:30 arrival -> 00:40)', () => {
    expect(
      dayDiff(
        '2026-03-10T23:30:00+09:00',
        '2026-03-11T00:40:00+09:00',
        'Asia/Tokyo',
      ),
    ).toBe(1)
  })

  it('computes in tz even when inputs are UTC strings', () => {
    // 14:30Z = 23:30 JST, 15:40Z = 00:40 JST next day; same UTC day
    expect(
      dayDiff('2026-03-10T14:30:00Z', '2026-03-10T15:40:00Z', 'Asia/Tokyo'),
    ).toBe(1)
  })

  it('is negative when target is earlier', () => {
    expect(
      dayDiff(
        '2026-03-11T00:10:00+09:00',
        '2026-03-10T23:50:00+09:00',
        'Asia/Tokyo',
      ),
    ).toBe(-1)
  })

  it('throws RangeError on invalid ISO', () => {
    expect(() => dayDiff('x', '2026-03-10T00:00:00Z', 'Asia/Tokyo')).toThrow(
      RangeError,
    )
  })
})

describe('formatDayBadge', () => {
  it('formats diffs', () => {
    expect(formatDayBadge(0)).toBe('')
    expect(formatDayBadge(1)).toBe('+1')
    expect(formatDayBadge(-1)).toBe('-1')
  })
})

describe('zonedInputToIso', () => {
  it('treats datetime-local input as Asia/Tokyo wall time', () => {
    expect(zonedInputToIso('2026-11-05T13:45', 'Asia/Tokyo')).toBe(
      '2026-11-05T13:45:00+09:00',
    )
  })

  it('keeps the wall date across midnight', () => {
    expect(zonedInputToIso('2026-12-01T00:20', 'Asia/Tokyo')).toBe(
      '2026-12-01T00:20:00+09:00',
    )
  })

  it('applies DST offsets of the target zone', () => {
    expect(zonedInputToIso('2026-07-01T10:00', 'Europe/Paris')).toBe(
      '2026-07-01T10:00:00+02:00',
    )
  })
})

describe('isoOffsetZone', () => {
  it('extracts the offset and formats in it', () => {
    expect(isoOffsetZone('2026-11-05T22:30:00+09:00')).toBe('+09:00')
    expect(
      formatLocal(
        '2026-11-05T22:30:00+09:00',
        isoOffsetZone('2026-11-05T22:30:00+09:00'),
      ),
    ).toBe('22:30')
    expect(isoOffsetZone('2026-11-05T13:30:00Z')).toBe('UTC')
  })
})
