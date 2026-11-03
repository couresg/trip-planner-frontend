import { OctagonAlert } from 'lucide-react'
import { messages } from '@/constants/messages'

export function CanceledBanner() {
  return (
    <div
      role="alert"
      className="flex gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800"
    >
      <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{messages.departure.canceled}</p>
    </div>
  )
}
