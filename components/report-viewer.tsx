'use client'

import { useState } from 'react'
import dayjs from 'dayjs'
import { RefreshCw, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { InsightSnapshot } from '@/lib/types'
import { regenerateInsight } from '@/lib/data/reports'
import { InsightCard } from '@/components/insight-card'
import { cn } from '@/lib/utils'

export function ReportViewer({
  categoryId,
  snapshot,
  loading,
  onRegenerated,
}: {
  categoryId: string
  snapshot: InsightSnapshot | null
  loading: boolean
  onRegenerated: () => void
}) {
  const [regenerating, setRegenerating] = useState(false)

  async function handleRegenerate() {
    setRegenerating(true)
    const r = await regenerateInsight(categoryId)
    setRegenerating(false)
    if (!r.ok) {
      toast.error(`生成失败：${r.error}`)
      return
    }
    toast.success(`已生成 ${r.insightsCount} 条洞察(基于 ${r.sourceCount} 篇笔记)`)
    onRegenerated()
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] p-12 text-center text-sm text-neutral-400">
        <Loader2 className="animate-spin inline mr-2" size={14} />加载中…
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] p-12 flex flex-col items-center gap-4">
        <Sparkles size={28} className="text-neutral-300" />
        <p className="text-sm text-neutral-500">该分类暂无 AI 洞察</p>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 transition-colors',
            regenerating && 'cursor-wait opacity-60'
          )}
        >
          {regenerating
            ? <Loader2 size={13} className="animate-spin" />
            : <Sparkles size={13} />}
          {regenerating ? '生成中…' : '生成洞察'}
        </button>
      </div>
    )
  }

  if (snapshot.status === 'error') {
    return (
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] p-8 flex flex-col gap-4">
        <p className="text-sm text-red-600">
          上次生成失败：{snapshot.errorMessage ?? '未知错误'}
        </p>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className={cn(
            'self-start inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70 transition-colors',
            regenerating && 'cursor-wait opacity-60'
          )}
        >
          <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
          {regenerating ? '生成中…' : '重新生成'}
        </button>
      </div>
    )
  }

  return (
    <article className="space-y-6">
      <header className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] p-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900 mb-1.5">
            选题洞察
          </h2>
          <p className="text-xs text-neutral-400">
            生成于 {dayjs(snapshot.generatedAt).format('YYYY-MM-DD HH:mm')} ·
            模型 {snapshot.model} ·
            基于 {snapshot.sourceNoteIds.length} 篇笔记 · {snapshot.insights.length} 条洞察
          </p>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className={cn(
            'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70 transition-colors',
            regenerating && 'cursor-wait opacity-60'
          )}
        >
          <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
          {regenerating ? '分析中…' : '重新生成'}
        </button>
      </header>

      <div className="space-y-3">
        {snapshot.insights.map((it, i) => (
          <InsightCard key={`${snapshot.id}-${i}`} insight={it} index={i} />
        ))}
      </div>
    </article>
  )
}
