import { IMMIGRATION_OPTIONS } from '@/api/transfers'
import { messages } from '@/constants/messages'
import { useTransferSettings } from '@/stores/transferSettings'
import { MinuteSelector } from './MinuteSelector'

const m = messages.transfer

export function ImmigrationSelector() {
  const value = useTransferSettings((s) => s.immigrationMin)
  const setValue = useTransferSettings((s) => s.setImmigrationMin)
  return (
    <MinuteSelector
      name="immigrationMin"
      legend={m.immigration}
      hint={m.immigrationHint}
      options={IMMIGRATION_OPTIONS}
      optionLabel={m.immigrationOption}
      value={value}
      onChange={setValue}
    />
  )
}
