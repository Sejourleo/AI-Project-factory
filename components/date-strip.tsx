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
    <div className="flex gap-2 overflow-x-auto py-2 px-6 border-b border-neutral-200 bg-white">
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
              'shrink-0 w-14 py-2 rounded-lg border flex flex-col items-center justify-center transition-colors',
              active
                ? 'bg-neutral-900 text-white border-neutral-900'
                : empty
                  ? 'bg-white text-neutral-400 border-neutral-200 hover:border-neutral-300'
                  : 'bg-white text-neutral-900 border-neutral-200 hover:border-neutral-400'
            )}
          >
            <span className={cn('text-[10px]', active ? 'text-white/70' : 'text-neutral-500')}>
              {label}
            </span>
            <span className="text-lg font-semibold leading-tight">{day}</span>
            {!empty && (
              <span className={cn(
                'text-[10px] px-1.5 rounded-full leading-4',
                active ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'
              )}>
                {b.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
