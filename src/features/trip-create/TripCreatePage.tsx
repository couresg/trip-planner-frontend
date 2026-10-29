import { ArrowLeft, CircleAlert } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { useAreasQuery, useCitiesQuery } from '@/api/catalog'
import { ApiError } from '@/api/client'
import { useCreateTrip } from '@/api/trips'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { messages } from '@/constants/messages'
import { fieldClass } from './fieldClass'
import { FlightSection } from './FlightSection'
import type {
  TripFormContext,
  TripFormInput,
  TripFormOutput,
} from './tripFormSchema'
import {
  isManualFallbackError,
  toCreateTripRequest,
  tripFormDefaults,
  tripFormResolver,
} from './tripFormSchema'

const m = messages.tripCreate

function serverErrorText(error: Error) {
  if (!(error instanceof ApiError)) return messages.common.error
  // 도시·공항 불일치, 기간 오류는 서버 detail이 무엇이 틀렸는지 설명한다
  if (
    (error.code === 'CITY_AIRPORT_MISMATCH' ||
      error.code === 'INVALID_DATE_RANGE') &&
    error.detail
  )
    return error.detail
  return (error.code && m.errors[error.code]) || messages.common.error
}

function FieldError({
  id,
  message,
}: {
  id: string
  message: string | undefined
}) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-sm text-red-600">
      {message}
    </p>
  )
}

export function TripCreatePage() {
  const navigate = useNavigate()
  const cities = useCitiesQuery()
  const createTrip = useCreateTrip()
  const [cityTimezone, setCityTimezone] = useState<string>()
  const form = useForm<TripFormInput, TripFormContext, TripFormOutput>({
    resolver: tripFormResolver,
    context: { timezone: cityTimezone },
    defaultValues: tripFormDefaults,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    trigger,
    formState: { errors },
  } = form

  const [cityCode, startDate, endDate] = useWatch({
    control,
    name: ['cityCode', 'startDate', 'endDate'],
  })
  const city = cities.data?.find((c) => c.code === cityCode)
  const areas = useAreasQuery(cityCode || undefined)
  const offerManual = isManualFallbackError(createTrip.error)

  const cityReg = register('cityCode', {
    onChange: (e: { target: { value: string } }) => {
      const next = cities.data?.find((c) => c.code === e.target.value)
      const airport = next?.airports[0]?.iata ?? ''
      setCityTimezone(next?.timezone)
      createTrip.reset()
      setValue('areaId', '')
      setValue('outboundAirport', airport)
      setValue('returnAirport', airport)
    },
  })
  const startReg = register('startDate', {
    onChange: () => {
      createTrip.reset()
      if (getValues('endDate')) void trigger('endDate')
    },
  })

  const onSubmit = (values: TripFormOutput) => {
    if (!city) return
    createTrip.mutate(toCreateTripRequest(values, city), {
      onSuccess: ({ tripId }) => navigate(`/trips/${tripId}`),
    })
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link to="/" aria-label={messages.tripDetail.home}>
            <ArrowLeft aria-hidden />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">{m.title}</h1>
      </div>

      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="cityCode" className="text-sm font-medium">
            {m.city}
          </label>
          {cities.isPending ? (
            <Skeleton
              className="h-11 w-full"
              aria-label={messages.common.loading}
            />
          ) : cities.isError ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-2 text-sm text-red-600"
            >
              <span>{m.citiesError}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => cities.refetch()}
              >
                {messages.common.retry}
              </Button>
            </div>
          ) : (
            <select
              id="cityCode"
              className={fieldClass}
              aria-invalid={!!errors.cityCode}
              {...cityReg}
            >
              <option value="">{m.cityPlaceholder}</option>
              {cities.data.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.nameKo}
                </option>
              ))}
            </select>
          )}
          <FieldError id="cityCode-error" message={errors.cityCode?.message} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="areaId" className="text-sm font-medium">
            {m.area}
          </label>
          {areas.isError ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-2 text-sm text-red-600"
            >
              <span>{m.areasError}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => areas.refetch()}
              >
                {messages.common.retry}
              </Button>
            </div>
          ) : (
            <select
              id="areaId"
              className={fieldClass}
              disabled={!cityCode || areas.isPending}
              aria-invalid={!!errors.areaId}
              {...register('areaId')}
            >
              <option value="">
                {!cityCode
                  ? m.areaNeedsCity
                  : areas.isPending
                    ? messages.common.loading
                    : m.areaPlaceholder}
              </option>
              {areas.data?.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.nameKo}
                </option>
              ))}
            </select>
          )}
          <FieldError id="areaId-error" message={errors.areaId?.message} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="startDate" className="text-sm font-medium">
              {m.startDate}
            </label>
            <input
              id="startDate"
              type="date"
              className={fieldClass}
              aria-invalid={!!errors.startDate}
              {...startReg}
            />
            <FieldError
              id="startDate-error"
              message={errors.startDate?.message}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="endDate" className="text-sm font-medium">
              {m.endDate}
            </label>
            <input
              id="endDate"
              type="date"
              min={startDate || undefined}
              className={fieldClass}
              aria-invalid={!!errors.endDate}
              {...register('endDate', { onChange: () => createTrip.reset() })}
            />
            <FieldError id="endDate-error" message={errors.endDate?.message} />
          </div>
        </div>

        <FlightSection
          direction="outbound"
          form={form}
          date={startDate}
          city={city}
          offerManual={offerManual}
          onFlightNoChange={createTrip.reset}
        />
        <FlightSection
          direction="return"
          form={form}
          date={endDate}
          city={city}
          offerManual={offerManual}
          onFlightNoChange={createTrip.reset}
        />

        {createTrip.error && (
          <p
            role="alert"
            className="flex items-start gap-1.5 text-sm text-red-600"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {serverErrorText(createTrip.error)}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={createTrip.isPending}
        >
          {createTrip.isPending ? m.submitting : m.submit}
        </Button>
      </form>
    </main>
  )
}
