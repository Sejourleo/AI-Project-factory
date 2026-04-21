'use client'

import { useState } from 'react'
import { ChevronDown, Sparkles, TrendingUp, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TopicSuggestion } from '@/lib/types'

export function TopicCard({
  topic,
  reportDate,
  onJumpToReport,
}: {
  topic: TopicSuggestion
  reportDate?: string
  onJumpToReport?: (date: string) => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="bg-neutral-50/60 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-[15px] font-medium text-neutral-900 leading-snug">
          {topic.title}
        </h3>
        {reportDate && onJumpToReport && (
          <button
            onClick={() => onJumpToReport(reportDate)}
            className="shrink-0 text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
          >
            来自 {reportDate} ↗
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {topic.tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center px-2 py-0.5 rounded-md bg-white text-xs text-neutral-600"
          >
            {t}
          </span>
        ))}
      </div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors mb-3"
      >
        <ChevronDown
          size={14}
          className={cn('transition-transform', !expanded && '-rotate-90')}
        />
        {expanded ? '收起详情' : '展开详情'}
      </button>
      {expanded && (
        <dl className="space-y-3.5">
          <BriefRow icon={<Lightbulb size={13} />} label="为什么做" text={topic.brief.why} />
          <BriefRow icon={<Sparkles size={13} />} label="爆点在哪" text={topic.brief.hook} />
          <BriefRow icon={<TrendingUp size={13} />} label="增长空间" text={topic.brief.growth} />
        </dl>
      )}
    </div>
  )
}

function BriefRow({
  icon,
  label,
  text,
}: {
  icon: React.ReactNode
  label: string
  text: string
}) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-20 text-xs text-neutral-500 flex items-center gap-1.5 pt-0.5">
        {icon}
        {label}
      </div>
      <div className="flex-1 text-neutral-700 leading-relaxed text-[13px]">
        {text}
      </div>
    </div>
  )
}
