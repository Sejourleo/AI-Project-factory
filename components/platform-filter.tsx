'use client'

import { cn } from '@/lib/utils'
import { PLATFORMS, type Platform } from '@/lib/types'

export function PlatformFilter({
  selected,
  onChange,
}: {
  selected: Platform | null
  onChange: (next: Platform | null) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange(null)}
        className={cn(
          'inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg transition-colors',
          selected === null
            ? 'bg-blue-500 text-white shadow-sm'
            : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
        )}
      >
        全部平台
      </button>
      {PLATFORMS.map((p) => {
        const active = selected === p.id
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg transition-colors',
              active
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
            )}
          >
            <span className="text-[15px] leading-none">{p.icon}</span>
            {p.name}
          </button>
        )
      })}
    </div>
  )
}
