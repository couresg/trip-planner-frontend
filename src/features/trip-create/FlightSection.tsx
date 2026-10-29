import type { UseFormReturn } from 'react-hook-form'
import { useWatch } from 'react-hook-form'
import type { City } from '@/api/catalog'
import { ApiError } from '@/api/client'
import { useFlightLookup } from '@/api/flights'
import { Button } from '@/components/ui/button'
import { messages } from '@/constants/messages'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { fieldClass } from './fieldClass'
import { FlightPreview } from './FlightPreview'
import type { Direction, TripFormInput, TripFormOutput } from './tripFormSchema'
import { cleanFlightNoInput } from './tripFormSchema'

const m = messages.tripCreate

interface FlightSectionProps {
  direction: Direction
  form: UseFormReturn<TripFormInput, unknown, TripFormOutput>
  /** 가는 편은 시작일, 오는 편은 종료일 */
  date: string
  city: City | undefined
  /** 생성 요청이 FLIGHT_NOT_FOUND/503으로 실패하면 조회 결과와 무관하게 직접 입력을 제안 */
  offerManual: boolean
  /** 편명이 바뀌면 이전 생성 오류를 지운다 */
  onFlightNoChange: () => void
}

export function FlightSection({
  direction,
  form,
  date,
  city,
  offerManual,
  onFlightNoChange,
}: FlightSectionProps) {
  const {
    register,
    control,
    setValue,
    getValues,
    clearErrors,
    formState: { errors },
  } = form
  const names = {
    flightNo: `${direction}FlightNo`,
    manual: `${direction}Manual`,
    airport: `${direction}Airport`,
    at: `${direction}At`,
  } as const
  const ids = {
    flightNo: `${direction}-flight-no`,
    airport: `${direction}-airport`,
    at: `${direction}-at`,
  }

  const flightNo = useWatch({ control, name: names.flightNo })
  const manual = useWatch({ control, name: names.manual })
  const debouncedFlightNo = useDebouncedValue(flightNo)
  // FlightPreview와 같은 query key라 요청은 한 번만 나간다
  const lookup = useFlightLookup(debouncedFlightNo, date || undefined, {
    enabled: !manual,
  })
  // 이 방향의 조회가 404/503일 때만 (생성 실패로 인한 제안은 offerManual)
  const lookupFailed =
    lookup.error instanceof ApiError &&
    (lookup.error.status === 404 || lookup.error.status === 503)
  const canOfferManual = offerManual || lookupFailed

  const flightReg = register(names.flightNo)

  const enterManual = () => {
    if (!getValues(names.airport))
      setValue(names.airport, city?.airports[0]?.iata ?? '')
    setValue(names.manual, true)
  }
  const leaveManual = () => {
    setValue(names.manual, false)
    clearErrors([names.airport, names.at])
  }

  const flightError = errors[names.flightNo]?.message
  const airportError = errors[names.airport]?.message
  const atError = errors[names.at]?.message

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-semibold">{m[direction]}</legend>
      <label htmlFor={ids.flightNo} className="text-sm">
        {m.flightNo}
      </label>
      <input
        id={ids.flightNo}
        className={fieldClass}
        placeholder={m.flightNoPlaceholder}
        autoCapitalize="characters"
        autoComplete="off"
        aria-invalid={!!flightError}
        aria-describedby={flightError ? `${ids.flightNo}-error` : undefined}
        {...flightReg}
        onChange={(e) => {
          e.target.value = cleanFlightNoInput(e.target.value)
          onFlightNoChange()
          return flightReg.onChange(e)
        }}
      />
      {flightError && (
        <p
          id={`${ids.flightNo}-error`}
          role="alert"
          className="text-sm text-red-600"
        >
          {flightError}
        </p>
      )}

      {manual ? (
        <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-2">
          <p className="text-xs text-muted-foreground">{m.manual.hint}</p>
          <label htmlFor={ids.airport} className="text-sm">
            {direction === 'outbound'
              ? m.manual.outboundAirport
              : m.manual.returnAirport}
          </label>
          <select
            id={ids.airport}
            className={fieldClass}
            disabled={!city}
            aria-invalid={!!airportError}
            {...register(names.airport)}
          >
            <option value="">
              {city ? m.manual.airportPlaceholder : m.areaNeedsCity}
            </option>
            {city?.airports.map((a) => (
              <option key={a.iata} value={a.iata}>
                {a.nameKo} ({a.iata})
              </option>
            ))}
          </select>
          {airportError && (
            <p role="alert" className="text-sm text-red-600">
              {airportError}
            </p>
          )}
          <label htmlFor={ids.at} className="text-sm">
            {direction === 'outbound' ? m.manual.outboundAt : m.manual.returnAt}
          </label>
          <input
            id={ids.at}
            type="datetime-local"
            className={fieldClass}
            aria-invalid={!!atError}
            {...register(names.at)}
          />
          {atError && (
            <p role="alert" className="text-sm text-red-600">
              {atError}
            </p>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={leaveManual}
          >
            {m.manual.back}
          </Button>
        </div>
      ) : (
        <>
          <FlightPreview
            flightNo={debouncedFlightNo}
            date={date}
            direction={direction}
            city={city}
          />
          {canOfferManual && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={enterManual}
            >
              {m.manual.enter}
            </Button>
          )}
        </>
      )}
    </fieldset>
  )
}
