import { IMMIGRATION_OPTIONS } from '@/api/transfers'
import { messages } from '@/constants/messages'
import { cn } from '@/lib/utils'
import { useTransferSettings } from '@/stores/transferSettings'

const m = messages.transfer

export function ImmigrationSelector() {
  const value = useTransferSettings((s) => s.immigrationMin)
  const setValue = useTransferSettings((s) => s.setImmigrationMin)
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium">{m.immigration}</legend>
      <p className="text-xs text-muted-foreground">{m.immigrationHint}</p>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {IMMIGRATION_OPTIONS.map((min) => (
          <label
            key={min}
            className={cn(
              'flex min-h-10 cursor-pointer items-center justify-center rounded-md text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
              value === min
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground',
            )}
          >
            <input
              type="radio"
              name="immigrationMin"
              value={min}
              checked={value === min}
              onChange={() => setValue(min)}
              className="sr-only"
            />
            {m.immigrationOption(min)}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
