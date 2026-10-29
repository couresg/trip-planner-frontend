import { differenceInCalendarDays, parseISO } from 'date-fns'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Resolver } from 'react-hook-form'
import { z } from 'zod'
import type { City } from '@/api/catalog'
import { ApiError } from '@/api/client'
import { isValidFlightNo, normalizeFlightNo } from '@/api/flights'
import type { CreateTripRequest, ManualOverride } from '@/api/trips'
import { messages } from '@/constants/messages'
import { zonedInputToIso } from '@/lib/time'

const v = messages.tripCreate.validation

export const MAX_TRIP_DAYS = 30

/** 항공편 조회 실패 중 수동 입력으로 넘어가야 하는 오류 (404 미발견 / 503 장애) */
export const isManualFallbackError = (error: unknown) =>
  error instanceof ApiError &&
  (error.code === 'FLIGHT_NOT_FOUND' ||
    error.code === 'FLIGHT_PROVIDER_UNAVAILABLE' ||
    error.status === 503)

export type Direction = 'outbound' | 'return'

/** 입력 중 정규화: 공백·하이픈 제거 + 대문자 (앞자리 0 제거는 제출 시 normalizeFlightNo) */
export const cleanFlightNoInput = (input: string) =>
  input.replace(/[\s-]+/g, '').toUpperCase()

const flightNo = z
  .string()
  .transform(normalizeFlightNo)
  .refine(isValidFlightNo, v.flightNo)

// 다른 필드에 오류가 있어도 교차 검증을 돌려 제출 전에 안내한다
const always = { when: () => true }

/** 수동 입력 시각 비교에 쓸 여행 도시 timezone을 받는다 (도시 미선택이면 UTC 벽시계 기준) */
export const makeTripFormSchema = (timezone = 'UTC') =>
  z
    .object({
      outboundFlightNo: flightNo,
      returnFlightNo: flightNo,
      cityCode: z.string().min(1, v.city),
      areaId: z.string().min(1, v.area),
      startDate: z.string().min(1, v.startDate),
      endDate: z.string().min(1, v.endDate),
      outboundManual: z.boolean(),
      outboundAirport: z.string(),
      outboundAt: z.string(),
      returnManual: z.boolean(),
      returnAirport: z.string(),
      returnAt: z.string(),
    })
    .refine((f) => !f.startDate || !f.endDate || f.endDate >= f.startDate, {
      ...always,
      path: ['endDate'],
      message: v.endBeforeStart,
    })
    .refine(
      (f) =>
        !f.startDate ||
        !f.endDate ||
        differenceInCalendarDays(parseISO(f.endDate), parseISO(f.startDate)) <=
          MAX_TRIP_DAYS,
      { ...always, path: ['endDate'], message: v.tooLong },
    )
    .refine((f) => !f.outboundManual || !!f.outboundAirport, {
      ...always,
      path: ['outboundAirport'],
      message: v.airport,
    })
    .refine((f) => !f.outboundManual || !!f.outboundAt, {
      ...always,
      path: ['outboundAt'],
      message: v.manualAt,
    })
    .refine((f) => !f.returnManual || !!f.returnAirport, {
      ...always,
      path: ['returnAirport'],
      message: v.airport,
    })
    .refine((f) => !f.returnManual || !!f.returnAt, {
      ...always,
      path: ['returnAt'],
      message: v.manualAt,
    })
    .refine(
      (f) =>
        !f.outboundManual ||
        !f.returnManual ||
        !f.outboundAt ||
        !f.returnAt ||
        Date.parse(zonedInputToIso(f.returnAt, timezone)) >
          Date.parse(zonedInputToIso(f.outboundAt, timezone)),
      { ...always, path: ['returnAt'], message: v.returnBeforeOutbound },
    )

export const tripFormSchema = makeTripFormSchema()

export type TripFormInput = z.input<typeof tripFormSchema>
export type TripFormOutput = z.output<typeof tripFormSchema>
export interface TripFormContext {
  timezone?: string
}

/** useForm의 context.timezone(선택한 도시)으로 매번 스키마를 만들어 검증한다 */
export const tripFormResolver: Resolver<
  TripFormInput,
  TripFormContext,
  TripFormOutput
> = (values, context, options) =>
  zodResolver(makeTripFormSchema(context?.timezone))(values, context, options)

export const tripFormDefaults: TripFormInput = {
  outboundFlightNo: '',
  returnFlightNo: '',
  cityCode: '',
  areaId: '',
  startDate: '',
  endDate: '',
  outboundManual: false,
  outboundAirport: '',
  outboundAt: '',
  returnManual: false,
  returnAirport: '',
  returnAt: '',
}

/** 수동 입력 시각은 여행 도시 timezone의 벽시계 시각으로 보고 오프셋 ISO로 바꾼다 */
export function toCreateTripRequest(
  f: TripFormOutput,
  city: City,
): CreateTripRequest {
  const override: ManualOverride = {}
  if (f.outboundManual) {
    override.outboundArrivalAt = zonedInputToIso(f.outboundAt, city.timezone)
    override.outboundArrivalAirport = f.outboundAirport
  }
  if (f.returnManual) {
    override.returnDepartureAt = zonedInputToIso(f.returnAt, city.timezone)
    override.returnDepartureAirport = f.returnAirport
  }
  return {
    outboundFlightNo: f.outboundFlightNo,
    returnFlightNo: f.returnFlightNo,
    cityCode: f.cityCode,
    areaId: Number(f.areaId),
    startDate: f.startDate,
    endDate: f.endDate,
    manualOverride: f.outboundManual || f.returnManual ? override : null,
  }
}
