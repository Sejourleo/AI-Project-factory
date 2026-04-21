'use client'

import dayjs from 'dayjs'
import { cn } from '@/lib/utils'
import { formatDow } from '@/lib/utils/dates'

type Item = { id: string; date: string; summary: string }

export function ReportList({
  items,
  selectedDate,
  onSelect,
}: {
  items: Item[]
  selectedDate: string
  onSelect: (date: string) => void
}) {
  if (items.length === 0) {
    return <div className="p-6 text-sm text-neutral-400">暂无历史报告</div>
  }
  return (
    <div className="space-y-1.5">
      {items.map((r, idx) => {
        const active = r.date === selectedDate
        return (
          <button
            key={r.id}
            onClick={() => onSelect(r.date)}
            className={cn(
              'w-full text-left p-3.5 rounded-xl transition-colors',
              active
                ? 'bg-neutral-900 text-white'
                : 'bg-transparent text-neutral-700 hover:bg-neutral-100/70'
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={cn(
                'text-xs',
                active ? 'text-white/70' : 'text-neutral-500'
              )}>
                {dayjs(r.date).format('M 月 D 日')} · {formatDow(r.date)}
              </span>
              {idx === 0 && (
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded',
                  active ? 'bg-white/15 text-white' : 'bg-neutral-900/5 text-neutral-500'
                )}>
                  最新
                </span>
              )}
            </div>
            <div className={cn(
              'text-xs line-clamp-2 leading-relaxed',
              active ? 'text-white/90' : 'text-neutral-700'
            )}>
              {r.summary}
            </div>
          </button>
        )
      })}
    </div>
  )
}
