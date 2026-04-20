'use client'

import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Inbox } from 'lucide-react'
import type { ContentItem, Platform } from '@/lib/types'
import { ContentCard } from '@/components/content-card'
import { PlatformFilter } from '@/components/platform-filter'
import { cn } from '@/lib/utils'

type SortBy = 'hot' | 'time'

export function ContentGrid({
  items,
  platformCounts,
  selectedPlatforms,
  onPlatformChange,
}: {
  items: ContentItem[]
  platformCounts: Record<Platform, number>
  selectedPlatforms: Platform[]
  onPlatformChange: (next: Platform[]) => void
}) {
  const [sortBy, setSortBy] = useState<SortBy>('hot')

  const sorted = useMemo(() => {
    if (sortBy === 'hot') return [...items].sort((a, b) => b.hotScore - a.hotScore)
    return [...items].sort((a, b) => dayjs(b.publishedAt).unix() - dayjs(a.publishedAt).unix())
  }, [items, sortBy])

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <PlatformFilter
          counts={platformCounts}
          selected={selectedPlatforms}
          onChange={onPlatformChange}
        />
        <div className="flex items-center gap-3 text-xs">
          <span className="text-neutral-400">共 {items.length} 条</span>
          <div className="flex gap-0.5 bg-neutral-100 p-0.5 rounded-md">
            <button
              onClick={() => setSortBy('hot')}
              className={cn(
                'px-2.5 py-1 rounded transition-colors',
                sortBy === 'hot' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
              )}
            >
              按热度
            </button>
            <button
              onClick={() => setSortBy('time')}
              className={cn(
                'px-2.5 py-1 rounded transition-colors',
                sortBy === 'time' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
              )}
            >
              按时间
            </button>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-300">
          <Inbox size={40} strokeWidth={1.5} className="mb-3" />
          <div className="text-sm">该日尚未采集到内容</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
