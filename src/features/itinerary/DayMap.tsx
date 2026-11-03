import {
  APILoadingStatus,
  APIProvider,
  Map,
  Marker,
  Polyline,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps'
import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { ItineraryItem } from '@/api/itinerary'
import { messages } from '@/constants/messages'
import { boundsOf, stopsOf } from './mapStops'
import type { MapStop } from './mapStops'

declare global {
  interface Window {
    gm_authFailure?: () => void
  }
}

const m = messages.itinerary.map

const BOUNDS_PADDING_PX = 32

// 잘못된 키는 스크립트 로드가 성공한 뒤 이 전역 콜백으로만 알려지고 라이브러리 상태에 반영되지 않는다.
// 페이지당 한 번만 불리므로 나중에 여는 지도도 알 수 있게 모듈에 남긴다
let authFailed = false
const authListeners = new Set<() => void>()

function subscribeAuthFailure(listener: () => void) {
  window.gm_authFailure = () => {
    authFailed = true
    authListeners.forEach((notify) => notify())
  }
  authListeners.add(listener)
  return () => {
    authListeners.delete(listener)
  }
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {children}
    </p>
  )
}

/** 일정이 바뀌면 지도 범위를 다시 맞춘다. 값이 그대로면 사용자가 옮긴 화면을 건드리지 않는다 */
function FitToStops({ stops }: { stops: MapStop[] }) {
  const map = useMap()
  const { south, west, north, east } = boundsOf(stops)
  useEffect(() => {
    map?.fitBounds({ south, west, north, east }, BOUNDS_PADDING_PX)
  }, [map, south, west, north, east])
  return null
}

function RouteMap({ stops }: { stops: MapStop[] }) {
  const status = useApiLoadingStatus()
  const path = useMemo(() => stops.map((s) => s.position), [stops])

  if (
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE
  )
    return <Notice>{m.loadFailed}</Notice>

  return (
    <div className="h-64 w-full overflow-hidden rounded-lg border">
      <Map
        defaultBounds={{ ...boundsOf(stops), padding: BOUNDS_PADDING_PX }}
        reuseMaps
        gestureHandling="cooperative"
        disableDefaultUI
        clickableIcons={false}
      >
        <FitToStops stops={stops} />
        {path.length > 1 && (
          <Polyline
            path={path}
            strokeColor="#2563eb"
            strokeOpacity={0.8}
            strokeWeight={3}
          />
        )}
        {/* AdvancedMarker는 Map ID가 필요한데 설정된 값이 없어 기본 Marker를 쓴다 */}
        {stops.map((stop) => (
          <Marker
            key={stop.itemId}
            position={stop.position}
            title={stop.nameKo}
            label={{
              text: String(stop.number),
              color: '#ffffff',
              fontWeight: '600',
            }}
          />
        ))}
      </Map>
    </div>
  )
}

/** 연 날짜만 마운트한다 (지도 로드마다 과금). 키가 없거나 로드에 실패해도 번호 목록은 보여 준다 */
export function DayMap({ items }: { items: ItineraryItem[] }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as
    string | undefined
  const stops = useMemo(() => stopsOf(items), [items])
  const authFailure = useSyncExternalStore(
    subscribeAuthFailure,
    () => authFailed,
  )

  if (stops.length === 0)
    return <p className="text-sm text-muted-foreground">{m.noStops}</p>

  return (
    <div className="flex flex-col gap-2">
      {!apiKey ? (
        <Notice>{m.noKey}</Notice>
      ) : authFailure ? (
        <Notice>{m.loadFailed}</Notice>
      ) : (
        <APIProvider apiKey={apiKey} language="ko">
          <RouteMap stops={stops} />
        </APIProvider>
      )}
      <p className="text-xs text-muted-foreground">{m.straightLine}</p>
      <ol aria-label={m.stopList} className="flex flex-col gap-1 text-sm">
        {stops.map((stop) => (
          <li key={stop.itemId} className="flex items-center gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {stop.number}
            </span>
            <span className="min-w-0 wrap-break-word">{stop.nameKo}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
