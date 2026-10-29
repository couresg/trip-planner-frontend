import type { RouteObject } from 'react-router'
import { createBrowserRouter } from 'react-router'
import { HomePage } from '@/features/home/HomePage'
import { NotFoundPage } from '@/features/home/NotFoundPage'
import { TripCreatePage } from '@/features/trip-create/TripCreatePage'
import { TripDetailPage } from '@/features/trip-detail/TripDetailPage'

export const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/trips/new', element: <TripCreatePage /> },
  { path: '/trips/:tripId', element: <TripDetailPage /> },
  { path: '*', element: <NotFoundPage /> },
]

export const router = createBrowserRouter(routes)
