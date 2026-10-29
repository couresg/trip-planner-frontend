const BASE_URL = '/api/v1'

export class ApiError extends Error {
  readonly status: number
  readonly title: string
  readonly detail?: string
  readonly code?: string

  constructor(status: number, title: string, detail?: string, code?: string) {
    super(detail ?? title)
    this.name = 'ApiError'
    this.status = status
    this.title = title
    this.detail = detail
    this.code = code
  }
}

interface ProblemDetail {
  title?: string
  status?: number
  detail?: string
  code?: string
}

export interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  /** 여러 개면 콤마로 이어 보낸다 (GET /trips) */
  ownerToken?: string | string[]
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const problem = (await res.json()) as ProblemDetail
    return new ApiError(
      problem.status ?? res.status,
      problem.title ?? res.statusText,
      problem.detail,
      problem.code,
    )
  } catch {
    return new ApiError(res.status, res.statusText)
  }
}

export async function apiFetch<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { body, ownerToken, headers, ...init } = options
  const finalHeaders = new Headers(headers)
  finalHeaders.set('Accept', 'application/json')
  if (body !== undefined) finalHeaders.set('Content-Type', 'application/json')
  const token = Array.isArray(ownerToken) ? ownerToken.join(',') : ownerToken
  if (token) finalHeaders.set('X-Owner-Token', token)

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw await toApiError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
