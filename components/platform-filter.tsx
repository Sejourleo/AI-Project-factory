'use client'

import { cn } from '@/lib/utils'
import { PLATFORMS, type Platform } from '@/lib/types'

export function PlatformFilter({
  counts,
  selected,
  onChange,
}: {
  counts: Record<Platform, number>
  selected: Platform[]
  onChange: (next: Platform[]) => void
}) {
  const total = PLATFORMS.reduce((s, p) => s + (counts[p.id] ?? 0), 0)
  const allSelected = selected.length === 0

  function togglePlatform(p: Platform) {
    if (allSelected) {
      onChange([p])
    } else if (selected.includes(p)) {
      const next = selected.filter((s) => s !== p)
      onChange(next.length === 0 ? [] : next)
    } else {
      onChange([...selected, p])
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onChange([])}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-colors',
          allSelected
            ? 'bg-neutral-900 text-white'
            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70'
        )}
      >
        全部
        <span className={cn(
          'text-[10px]',
          allSelected ? 'text-white/60' : 'text-neutral-400'
        )}>
          {total}
        </span>
      </button>
      {PLATFORMS.map((p) => {
        const isSelected = selected.includes(p.id)
        const count = counts[p.id] ?? 0
        const muted = count === 0 && !isSelected
        return (
          <button
            key={p.id}
            onClick={() => togglePlatform(p.id)}
            disabled={muted}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-colors',
              isSelected
                ? 'bg-neutral-900 text-white'
                : muted
                  ? 'bg-neutral-50 text-neutral-300 cursor-not-allowed'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70'
            )}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: isSelected ? '#ffffff' : p.color, opacity: muted ? 0.4 : 1 }}
            />
            {p.name}
            <span className={cn(
              'text-[10px]',
              isSelected ? 'text-white/60' : muted ? 'text-neutral-300' : 'text-neutral-400'
            )}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
