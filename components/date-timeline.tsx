'use client'

import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { getDateBuckets, type DateBucket } from '@/lib/data/contents'
import { PLATFORMS, type KeywordConfig, type Platform } from '@/lib/types'
import { formatDow } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'

const DAY_COUNT = 11

function relativeLabel(date: string, todayStr: string): string {
  const diff = dayjs(todayStr).diff(dayjs(date), 'day')
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff === 2) return '前天'
  if (diff <= 6) return `${diff}天前`
  return dayjs(date).format('M月D日')
}

export function DateTimeline({
  categoryId,
  value,
  platformFilter,
  keywords,
  onChange,
}: {
  categoryId: string
  value: string
  platformFilter: Platform | null
  keywords?: KeywordConfig[]
  onChange: (date: string) => void
}) {
  const [buckets, setBuckets] = useState<DateBucket[]>([])
  const todayStr = dayjs().format('YYYY-MM-DD')

  useEffect(() => {
    let cancelled = false
    getDateBuckets(categoryId, DAY_COUNT + 1, keywords).then((all) => {
      if (cancelled) return
      // Exclude "today" since default view is yesterday-back.
      const past = all.filter((b) => b.date !== todayStr).slice(-DAY_COUNT)
      setBuckets(past.reverse()) // newest (yesterday) first
    })
    return () => { cancelled = true }
  }, [categoryId, todayStr, keywords])

  return (
    <div className="grid grid-cols-11 gap-2">
      {buckets.map((b) => {
        const active = b.date === value
        const activeCount = platformFilter
          ? b.platforms[platformFilter]
          : b.count
        const dots = PLATFORMS
          .filter((p) => b.platforms[p.id] > 0)
          .filter((p) => !platformFilter || p.id === platformFilter)
          .slice(0, 4)
        return (
          <button
            key={b.date}
            onClick={() => onChange(b.date)}
            className={cn(
              'rounded-xl px-2 py-3 flex flex-col items-center gap-1 transition-colors',
              active
                ? 'bg-blue-500 text-white shadow-sm'
                : activeCount === 0
                  ? 'bg-white border border-neutral-100 text-neutral-400 hover:bg-neutral-50'
                  : 'bg-white border border-neutral-100 text-neutral-700 hover:bg-neutral-50'
            )}
          >
            <span className={cn(
              'text-[11px] leading-none',
              active ? 'text-white/80' : 'text-neutral-400'
            )}>
              {relativeLabel(b.date, todayStr)}
            </span>
            <span className={cn(
              'text-2xl font-semibold leading-none tabular-nums',
              active ? 'text-white' : 'text-neutral-900'
            )}>
              {dayjs(b.date).format('D')}
            </span>
            <span className={cn(
              'text-[11px] leading-none',
              active ? 'text-white/80' : 'text-neutral-400'
            )}>
              {formatDow(b.date)}
            </span>
            <div className="h-2 flex items-center gap-1 mt-0.5">
              {dots.map((p) => (
                <span
                  key={p.id}
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: active ? 'rgba(255,255,255,0.9)' : p.color }}
                />
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}
