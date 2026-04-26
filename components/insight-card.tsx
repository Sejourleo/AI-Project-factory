'use client'

import { Sparkles } from 'lucide-react'
import type { TopicInsight } from '@/lib/types'

export function InsightCard({
  insight,
  index,
}: {
  insight: TopicInsight
  index: number
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-100 px-6 py-5 flex gap-6">
      <div className="w-10 shrink-0 pt-0.5">
        <span className="text-2xl font-semibold text-neutral-300 tabular-nums leading-none">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-[15px] font-semibold text-neutral-900 leading-snug">
            {insight.title}
          </h3>
          <p className="text-xs text-neutral-500 leading-relaxed">
            <span className="text-neutral-400">切入点 · </span>
            {insight.angle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-2 text-xs">
          <Field label="受众">{insight.audience}</Field>
          <Field label="形式建议">{insight.contentFormat}</Field>
          <Field label="差异化">{insight.differentiation}</Field>
        </div>

        {insight.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {insight.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center px-2 py-0.5 rounded-md border border-neutral-200 text-[11px] text-neutral-500"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {insight.evidenceNoteIds.length > 0 && (
          <div className="text-[11px] text-neutral-400 flex items-center gap-1 min-w-0">
            <Sparkles size={11} className="shrink-0" />
            <span className="shrink-0">论据笔记: {insight.evidenceNoteIds.length} 篇 ·</span>
            <span className="ml-1 truncate">{insight.evidenceNoteIds.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-neutral-400">{label}</span>
      <span className="text-neutral-700 leading-relaxed">{children}</span>
    </div>
  )
}
