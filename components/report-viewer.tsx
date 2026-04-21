'use client'

import { useState } from 'react'
import dayjs from 'dayjs'
import { RefreshCw, Flame } from 'lucide-react'
import { toast } from 'sonner'
import type { DailyReport } from '@/lib/types'
import { regenerateReport } from '@/lib/data/reports'
import { formatDow } from '@/lib/utils/dates'
import { TopicCard } from '@/components/topic-card'
import { cn } from '@/lib/utils'

export function ReportViewer({ report }: { report: DailyReport | null }) {
  const [regenerating, setRegenerating] = useState(false)

  if (!report) {
    return (
      <div className="p-10 text-sm text-neutral-400">该日尚未生成报告</div>
    )
  }

  async function handleRegenerate() {
    if (!report) return
    setRegenerating(true)
    await regenerateReport(report.categoryId, report.date)
    setRegenerating(false)
    toast.success('AI 分析完成（原型演示）')
  }

  return (
    <article className="p-8 space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900 mb-1.5">
            {dayjs(report.date).format('M 月 D 日')} · {formatDow(report.date)} 选题分析报告
          </h2>
          <p className="text-xs text-neutral-400">
            覆盖 4 个平台 · 分析 Top {report.analyzedContentIds.length} 热门内容 · {report.topics.length} 个核心选题
          </p>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className={cn(
            'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70 transition-colors',
            regenerating && 'cursor-not-allowed opacity-60'
          )}
        >
          <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
          {regenerating ? '分析中…' : '重新生成'}
        </button>
      </header>

      <section>
        <div className="flex items-center gap-1.5 mb-3">
          <Flame size={13} className="text-neutral-400" />
          <span className="text-sm text-neutral-500">前一天热点</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {report.yesterdayHotspots.map((h) => (
            <span
              key={h}
              className="inline-flex items-center px-2.5 py-1 rounded-md bg-neutral-100 text-xs text-neutral-700"
            >
              {h}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm text-neutral-500 mb-3">选题建议</h3>
        <div className="space-y-3">
          {report.topics.map((t) => (
            <TopicCard key={t.id} topic={t} />
          ))}
        </div>
      </section>
    </article>
  )
}
