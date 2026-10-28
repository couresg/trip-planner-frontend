import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/mocks/server'
import { ApiError, apiFetch } from './client'

describe('apiFetch', () => {
  it('parses ProblemDetail into ApiError', async () => {
    server.use(
      http.get('*/api/v1/boom', () =>
        HttpResponse.json(
          { title: 'Bad Request', status: 400, detail: 'invalid flight', code: 'INVALID_FLIGHT' },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    const err = await apiFetch('/boom').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({
      status: 400,
      title: 'Bad Request',
      detail: 'invalid flight',
      code: 'INVALID_FLIGHT',
    })
  })

  it('falls back to status text when body is not JSON', async () => {
    server.use(http.get('*/api/v1/boom', () => new HttpResponse('oops', { status: 502 })))
    const err = await apiFetch('/boom').catch((e: unknown) => e)
    expect(err).toMatchObject({ status: 502 })
  })

  it('sends X-Owner-Token only when given', async () => {
    const seen: Array<string | null> = []
    server.use(
      http.get('*/api/v1/trips/1', ({ request }) => {
        seen.push(request.headers.get('X-Owner-Token'))
        return HttpResponse.json({})
      }),
    )
    await apiFetch('/trips/1', { ownerToken: 'secret' })
    await apiFetch('/trips/1')
    expect(seen).toEqual(['secret', null])
  })
})
