import { Link } from 'react-router'
import { HealthStatus } from '@/components/HealthStatus'
import { Button } from '@/components/ui/button'
import { messages } from '@/constants/messages'

export function HomePage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">{messages.app.title}</h1>
      <HealthStatus />
      <Button asChild>
        <Link to="/trips/new">{messages.home.newTrip}</Link>
      </Button>
    </main>
  )
}
