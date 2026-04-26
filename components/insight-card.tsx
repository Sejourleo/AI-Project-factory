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
    <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] p-5 flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <span className="text-xs text-neutral-400 mt-1 tabular-nums w-6 shrink-0">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <h3 className="text-base font-medium text-neutral-900 leading-snug">
            {insight.title}
          </h3>
          <p className="text-sm text-neutral-600 leading-relaxed">
            <span className="text-neutral-400">切入点 · </span>
            {insight.angle}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pl-8 text-xs">
        <Field label="受众">{insight.audience}</Field>
        <Field label="形式建议">{insight.contentFormat}</Field>
        <Field label="差异化">{insight.differentiation}</Field>
      </div>

      {insight.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-8">
          {insight.tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center px-2 py-0.5 rounded-md bg-neutral-100 text-[11px] text-neutral-600"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {insight.evidenceNoteIds.length > 0 && (
        <div className="pl-8 text-[11px] text-neutral-400 flex items-center gap-1">
          <Sparkles size={11} />
          论据笔记: {insight.evidenceNoteIds.length} 篇 ·
          <span className="ml-1 truncate">{insight.evidenceNoteIds.join(', ')}</span>
        </div>
      )}
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
