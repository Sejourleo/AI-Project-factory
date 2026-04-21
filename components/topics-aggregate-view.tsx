'use client'

import { useEffect, useMemo, useState } from 'react'
import { TopicCard } from '@/components/topic-card'
import { getTopicsByRange } from '@/lib/data/reports'
import type { TopicSuggestion } from '@/lib/types'
import { cn } from '@/lib/utils'

type Range = 7 | 30
type Topic = TopicSuggestion & { reportDate: string }

export function TopicsAggregateView({
  categoryId,
  onJumpToReport,
}: {
  categoryId: string
  onJumpToReport: (date: string) => void
}) {
  const [range, setRange] = useState<Range>(7)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [allTopics, setAllTopics] = useState<Topic[]>([])

  useEffect(() => {
    getTopicsByRange(categoryId, range).then(setAllTopics)
    setSelectedTags([])
  }, [categoryId, range])

  const availableTags = useMemo(() => {
    const set = new Set<string>()
    allTopics.forEach((t) => t.tags.forEach((tag) => set.add(tag)))
    return Array.from(set).sort()
  }, [allTopics])

  const topics = useMemo(() => {
    if (selectedTags.length === 0) return allTopics
    return allTopics.filter((t) =>
      selectedTags.some((tag) => t.tags.includes(tag))
    )
  }, [allTopics, selectedTags])

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-4 flex-wrap mb-4">
        <div className="flex gap-0.5 bg-neutral-100 p-0.5 rounded-md text-xs">
          {([7, 30] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                'px-3 py-1 rounded transition-colors',
                range === r
                  ? 'bg-white text-neutral-900 shadow-sm font-medium'
                  : 'text-neutral-500 hover:text-neutral-700'
              )}
            >
              近 {r} 天
            </button>
          ))}
        </div>
        <span className="text-xs text-neutral-400">共命中 {topics.length} 个选题</span>
      </div>

      {availableTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-6 pb-5 border-b border-neutral-100">
          <span className="text-xs text-neutral-400 shrink-0">标签</span>
          {availableTags.map((tag) => {
            const active = selectedTags.includes(tag)
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  'text-[11px] px-2.5 py-1 rounded-full transition-colors',
                  active
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70'
                )}
              >
                {tag}
              </button>
            )
          })}
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="text-[11px] text-neutral-400 hover:text-neutral-700 ml-1"
            >
              清空
            </button>
          )}
        </div>
      )}

      {topics.length === 0 ? (
        <div className="py-16 text-center text-sm text-neutral-400">
          调整筛选条件或等待更多报告生成
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((t) => (
            <TopicCard
              key={`${t.reportDate}-${t.id}`}
              topic={t}
              reportDate={t.reportDate}
              onJumpToReport={onJumpToReport}
            />
          ))}
        </div>
      )}
    </div>
  )
}
