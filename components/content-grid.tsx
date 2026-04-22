'use client'

import { useMemo } from 'react'
import { Inbox } from 'lucide-react'
import type { ContentItem } from '@/lib/types'
import { ContentCard } from '@/components/content-card'

export function ContentGrid({
  items,
  date,
}: {
  items: ContentItem[]
  date: string
}) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => b.hotScore - a.hotScore),
    [items]
  )

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm text-neutral-900">
          <span className="tabular-nums">{date}</span>
          <span className="text-neutral-400 ml-3">共 {items.length} 条内容</span>
        </h2>
        <span className="text-xs text-neutral-500">按热度排序</span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-300">
          <Inbox size={40} strokeWidth={1.5} className="mb-3" />
          <div className="text-sm">该日尚未采集到内容</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
