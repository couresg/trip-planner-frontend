import { Link } from 'react-router'
import { messages } from '@/constants/messages'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-2 p-4">
      <h1 className="text-xl font-bold">{messages.notFound.title}</h1>
      <Link className="underline" to="/">
        {messages.notFound.home}
      </Link>
    </main>
  )
}
