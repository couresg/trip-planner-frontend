import { useParams } from 'react-router'
import { messages } from '@/constants/messages'

export function TripDetailPage() {
  const { tripId } = useParams()
  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="text-xl font-bold">{messages.tripDetail.title}</h1>
      <p className="text-sm text-muted-foreground">#{tripId}</p>
    </main>
  )
}
