import { cn } from '@/lib/utils'

export function MinuteSelector<T extends number>({
  name,
  legend,
  hint,
  options,
  optionLabel,
  value,
  onChange,
}: {
  name: string
  legend: string
  hint: string
  options: readonly T[]
  optionLabel: (min: number) => string
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium">{legend}</legend>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {options.map((min) => (
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
              name={name}
              value={min}
              checked={value === min}
              onChange={() => onChange(min)}
              className="sr-only"
            />
            {optionLabel(min)}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
