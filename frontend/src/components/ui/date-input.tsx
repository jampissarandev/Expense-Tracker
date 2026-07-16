import { useState, useCallback } from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { formatDateInput, parseDateInput } from "@/lib/format"

interface DateInputProps {
  id?: string
  /** ISO "yyyy-mm-dd" or "" */
  value: string
  /** Always emits ISO "yyyy-mm-dd" or "" */
  onChange: (iso: string) => void
  placeholder?: string
  className?: string
}

export function DateInput({
  id,
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
  className,
}: DateInputProps) {
  const [open, setOpen] = useState(false)
  // Local display state lets the user type freely without the controlled
  // value fighting each keystroke.
  const [displayValue, setDisplayValue] = useState(() => formatDateInput(value))
  // Track the parent `value` we derived `displayValue` from so we can
  // resync when the parent changes it (e.g. reset button) — done during
  // render instead of in an effect to avoid cascading renders.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setDisplayValue(formatDateInput(value))
  }

  const selectedDate = value ? new Date(value + "T00:00:00") : undefined

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      // Allow only digits and slashes while typing
      const cleaned = raw.replace(/[^\d/]/g, "")
      setDisplayValue(cleaned)
      const parsed = parseDateInput(cleaned)
      if (parsed !== null) {
        onChange(parsed)
      }
    },
    [onChange],
  )

  const handleTextBlur = useCallback(() => {
    const raw = displayValue.trim()
    const parsed = raw === "" ? null : parseDateInput(raw)
    if (parsed !== null) {
      onChange(parsed)
      // Re-sync display to the canonical formatted form of the new value.
      // Note: `value` in this closure is the stale prop — do NOT use it
      // here, or the display will flicker back to the old value before
      // the parent re-renders. The render-phase resync above (see
      // lastValue) keeps display aligned with the parent afterwards.
      setDisplayValue(formatDateInput(parsed))
    } else {
      // Invalid or empty input on blur: snap display back to the parent's
      // current ISO value. Only emit onChange("") when the parent was
      // already empty (i.e. user is confirming an empty field); otherwise
      // a stray keystroke clearing the field would wipe a real value.
      if (raw === "" && value === "") {
        onChange("")
      } else {
        setDisplayValue(formatDateInput(value))
      }
    }
  }, [displayValue, onChange, value])

  const handleCalendarSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) {
        onChange("")
        setOpen(false)
        return
      }
      // format with date-fns in local timezone — no UTC shift
      const iso = format(date, "yyyy-MM-dd")
      onChange(iso)
      setOpen(false)
    },
    [onChange],
  )

  return (
    <div className={className}>
      <div className="relative flex h-8 items-center">
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          value={displayValue}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          className="h-8 w-full pr-8"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute right-0.5 top-0.5 size-7"
                aria-label="เลือกวันที่"
              />
            }
          >
            <CalendarIcon className="size-3.5 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={4}>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleCalendarSelect}
              defaultMonth={selectedDate}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
