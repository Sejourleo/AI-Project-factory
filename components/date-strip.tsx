'use client'

import { cn } from '@/lib/utils'
import { formatDow, yesterday } from '@/lib/utils/dates'
import dayjs from 'dayjs'

type Bucket = { date: string; count: number }

export function DateStrip({
  buckets,
  value,
  onChange,
}: {
  buckets: Bucket[]
  value: string
  onChange: (date: string) => void
}) {
  const todayStr = dayjs().format('YYYY-MM-DD')
  const yesterdayStr = yesterday()

  return (
    <div className="flex gap-2 overflow-x-auto py-5 px-8 bg-white">
      {buckets.map((b) => {
        const active = b.date === value
        const label =
          b.date === todayStr ? '今天' :
          b.date === yesterdayStr ? '昨天' :
          formatDow(b.date)
        const day = dayjs(b.date).date()
        const empty = b.count === 0

        return (
          <button
            key={b.date}
            onClick={() => onChange(b.date)}
            className={cn(
              'shrink-0 min-w-[60px] py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors',
              active
                ? 'bg-neutral-900 text-white shadow-sm'
                : empty
                  ? 'text-neutral-300 hover:bg-neutral-100/70'
                  : 'text-neutral-700 hover:bg-neutral-100/70'
            )}
          >
            <span className={cn('text-[10px]', active ? 'text-white/60' : 'text-neutral-400')}>
              {label}
            </span>
            <span className="text-lg font-semibold leading-none">{day}</span>
            <span className={cn(
              'text-[10px] leading-none mt-1',
              active ? 'text-white/50' : empty ? 'text-neutral-300' : 'text-neutral-400'
            )}>
              {empty ? '—' : b.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
