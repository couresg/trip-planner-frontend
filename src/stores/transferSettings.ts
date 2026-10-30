import { create } from 'zustand'
import type { ImmigrationMin } from '@/api/transfers'

interface TransferSettingsState {
  immigrationMin: ImmigrationMin
  setImmigrationMin: (value: ImmigrationMin) => void
}

export const DEFAULT_IMMIGRATION_MIN: ImmigrationMin = 60

export const useTransferSettings = create<TransferSettingsState>((set) => ({
  immigrationMin: DEFAULT_IMMIGRATION_MIN,
  setImmigrationMin: (immigrationMin) => set({ immigrationMin }),
}))
