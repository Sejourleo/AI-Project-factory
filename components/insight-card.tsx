'use client'

import type { TopicInsight } from '@/lib/types'
import { cn } from '@/lib/utils'

export function InsightCard({
  insight,
  index,
}: {
  insight: TopicInsight
  index: number
}) {
  const rank = String(index + 1).padStart(2, '0')

  return (
    <div className="bg-white rounded-xl border border-neutral-100 p-6 flex gap-6">
      <div className="w-14 shrink-0 flex flex-col items-center pt-1">
        <span className="text-[11px] text-neutral-400 leading-none">#{index + 1}</span>
        <span className="text-3xl font-semibold text-rose-500 tabular-nums leading-none mt-2">
          {rank}
        </span>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h3 className="text-[15px] font-semibold text-neutral-900 leading-snug flex-1 min-w-0">
            {insight.title}
          </h3>
          {insight.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 shrink-0">
              {insight.tags.slice(0, 3).map((t, i) => (
                <span
                  key={t}
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-md text-[11px]',
                    i === 0
                      ? 'bg-rose-50 text-rose-600'
                      : 'bg-neutral-100 text-neutral-500'
                  )}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <p className="text-sm text-neutral-600 leading-relaxed">
          <span className="text-neutral-400">切入点 · </span>
          {insight.angle}
        </p>

        <Section icon="👥" label="目标受众" tone="rose">
          {insight.audience}
        </Section>
        <Section icon="📝" label="形式建议" tone="neutral">
          {insight.contentFormat}
        </Section>
        <Section icon="🚀" label="差异化突破点" tone="emerald">
          {insight.differentiation}
        </Section>

        {insight.evidenceNoteIds.length > 0 && (
          <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 pt-1 min-w-0">
            <span className="shrink-0">📌 论据笔记 · {insight.evidenceNoteIds.length} 篇 ·</span>
            <span className="truncate">{insight.evidenceNoteIds.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({
  icon, label, tone, children,
}: {
  icon: string
  label: string
  tone: 'rose' | 'neutral' | 'emerald'
  children: React.ReactNode
}) {
  const labelColor = {
    rose: 'text-rose-600',
    neutral: 'text-neutral-700',
    emerald: 'text-emerald-600',
  }[tone]
  return (
    <div className="bg-neutral-50 rounded-lg px-4 py-3 flex flex-col gap-1.5">
      <div className={cn('text-xs font-medium flex items-center gap-1.5', labelColor)}>
        <span aria-hidden>{icon}</span>
        <span>{label}</span>
      </div>
      <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-line">
        {children}
      </p>
    </div>
  )
}
