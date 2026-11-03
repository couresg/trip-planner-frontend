import { create } from 'zustand'
import { AIRPORT_BUFFER_OPTIONS } from '@/api/transfers'
import type { AirportBufferMin, ImmigrationMin } from '@/api/transfers'
import { getJSON, setJSON } from '@/lib/storage'

const AIRPORT_BUFFER_KEY = 'airportBufferMin'

interface TransferSettingsState {
  immigrationMin: ImmigrationMin
  setImmigrationMin: (value: ImmigrationMin) => void
  airportBufferMin: AirportBufferMin
  setAirportBufferMin: (value: AirportBufferMin) => void
}

export const DEFAULT_IMMIGRATION_MIN: ImmigrationMin = 60
export const DEFAULT_AIRPORT_BUFFER_MIN: AirportBufferMin = 120

const storedAirportBuffer = () => {
  const stored = getJSON<unknown>(AIRPORT_BUFFER_KEY, null)
  return (
    AIRPORT_BUFFER_OPTIONS.find((min) => min === stored) ??
    DEFAULT_AIRPORT_BUFFER_MIN
  )
}

export const useTransferSettings = create<TransferSettingsState>((set) => ({
  immigrationMin: DEFAULT_IMMIGRATION_MIN,
  setImmigrationMin: (immigrationMin) => set({ immigrationMin }),
  airportBufferMin: storedAirportBuffer(),
  setAirportBufferMin: (airportBufferMin) => {
    setJSON(AIRPORT_BUFFER_KEY, airportBufferMin)
    set({ airportBufferMin })
  },
}))
