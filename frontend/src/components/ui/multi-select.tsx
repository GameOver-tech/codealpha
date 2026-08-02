import { useMemo, useRef, useState, useEffect } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { Badge, Button, Input } from './index'
import { cn } from '@/lib/utils'

export interface MultiSelectOption {
  key: string
  label: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  selected: string[]
  onChange: (keys: string[]) => void
  placeholder?: string
  className?: string
  id?: string
}

/**
 * Searchable multi-select dropdown with removable chip badges.
 *
 * Follows the AdminUpload candidate-picker pattern: a self-contained
 * dropdown with outside-click close, keyboard support, and Framer-style
 * animation. Selected items render as removable badges below the trigger.
 */
export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select…',
  className,
  id,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on outside click.
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.key.toLowerCase().includes(q),
    )
  }, [options, query])

  const toggle = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key))
    } else {
      onChange([...selected, key])
    }
  }

  const toggleAll = () => {
    if (filtered.length === 0) return
    const allFilteredSelected = filtered.every((o) => selected.includes(o.key))
    if (allFilteredSelected) {
      const remaining = selected.filter((k) => !filtered.some((o) => o.key === k))
      onChange(remaining)
    } else {
      const merged = [...selected]
      for (const o of filtered) {
        if (!merged.includes(o.key)) merged.push(o.key)
      }
      onChange(merged)
    }
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selected.includes(o.key))

  return (
    <div ref={containerRef} className={cn('relative space-y-2', className)}>
      {/* Trigger */}
      <button
        id={id}
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          setQuery('')
          if (!open) setTimeout(() => inputRef.current?.focus(), 0)
        }}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn('truncate', selected.length === 0 && 'text-muted-foreground')}>
          {selected.length === 0 ? placeholder : `${selected.length} selected`}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-border bg-popover shadow-card">
          {/* Search */}
          <div className="border-b border-border/60 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search criteria…"
                className="pl-9"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Select all */}
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {allFilteredSelected ? 'Deselect all' : 'Select all'}
            </button>
            <span className="text-xs text-muted-foreground">
              {selected.length}/{options.length} selected
            </span>
          </div>

          {/* Options */}
          <div role="listbox" className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No criteria match “{query}”.
              </p>
            ) : (
              filtered.map((option) => {
                const active = selected.includes(option.key)
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => toggle(option.key)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                      active ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                        active ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                      )}
                    >
                      {active && <Check className="h-3 w-3" />}
                    </span>
                    <span className="truncate">{option.label}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options
            .filter((o) => selected.includes(o.key))
            .map((option) => (
              <Badge key={option.key} variant="secondary" className="gap-1 pl-2.5 pr-1.5">
                {option.label}
                <button
                  type="button"
                  aria-label={`Remove ${option.label}`}
                  onClick={() => toggle(option.key)}
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          {selected.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onChange([])}
            >
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
