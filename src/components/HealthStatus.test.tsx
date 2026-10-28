import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { messages } from '@/constants/messages'
import { server } from '@/mocks/server'
import { HealthStatus } from './HealthStatus'

function renderStatus() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <HealthStatus />
    </QueryClientProvider>,
  )
}

describe('HealthStatus', () => {
  it('shows UP state', async () => {
    renderStatus()
    expect(await screen.findByText(messages.health.up)).toBeInTheDocument()
  })

  it('shows error and recovers on retry', async () => {
    server.use(http.get('*/api/v1/health', () => new HttpResponse(null, { status: 500 })))
    renderStatus()
    expect(await screen.findByText(messages.health.down)).toBeInTheDocument()

    server.resetHandlers()
    await userEvent.click(screen.getByRole('button', { name: messages.common.retry }))
    expect(await screen.findByText(messages.health.up)).toBeInTheDocument()
  })
})
