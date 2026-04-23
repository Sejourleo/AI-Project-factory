'use client'

import { Eye, Heart, MessageCircle, Share2 } from 'lucide-react'
import { PLATFORMS, type ContentItem } from '@/lib/types'
import { cn } from '@/lib/utils'

function fmtNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n}`
}

export function ContentCard({ item }: { item: ContentItem }) {
  const platform = PLATFORMS.find((p) => p.id === item.platform)
  const authorInitial = item.author.slice(0, 1)
  const heatPct = Math.max(0, Math.min(100, item.hotScore))

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group bg-white rounded-xl border border-neutral-100 px-6 py-5 flex gap-6 transition-colors hover:bg-neutral-50/60"
    >
      <div className="w-[72px] shrink-0 flex flex-col items-center pt-1">
        <div className="text-3xl font-semibold text-rose-500 tabular-nums leading-none">
          {item.hotScore}
        </div>
        <div className="text-[11px] text-neutral-400 mt-1.5">热度</div>
        <div className="mt-3 w-full h-[2px] bg-neutral-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-rose-500 rounded-full"
            style={{ width: `${heatPct}%` }}
          />
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5 text-[11px]">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium"
            style={{
              backgroundColor: `${platform?.color}15`,
              color: platform?.color,
            }}
          >
            <span className="text-[12px] leading-none">{platform?.icon}</span>
            {platform?.name}
          </span>
          <span className="inline-flex items-center gap-1.5 text-neutral-500">
            <span
              className="inline-flex items-center justify-center size-5 rounded-full bg-neutral-100 text-[10px] text-neutral-500"
              aria-hidden
            >
              {authorInitial}
            </span>
            {item.author}
          </span>
        </div>

        <h3 className="text-[15px] font-semibold text-neutral-900 leading-snug line-clamp-2">
          {item.title}
        </h3>

        <p className="text-xs text-neutral-500 leading-relaxed truncate">
          {item.summary}
        </p>

        <div className="flex items-center justify-between gap-3 mt-1">
          <div className="flex items-center gap-5 text-[11px] text-neutral-500">
            <span className="inline-flex items-center gap-1">
              <Heart size={12} /> {fmtNum(item.stats.likes)}
            </span>
            {item.stats.comments !== undefined && (
              <span className="inline-flex items-center gap-1">
                <MessageCircle size={12} /> {fmtNum(item.stats.comments)}
              </span>
            )}
            {item.stats.shares !== undefined && (
              <span className="inline-flex items-center gap-1">
                <Share2 size={12} /> {fmtNum(item.stats.shares)}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Eye size={12} /> {fmtNum(item.stats.views)}
            </span>
          </div>
          {item.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {item.tags.map((t) => (
                <span
                  key={t}
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-md border border-neutral-200',
                    'text-[11px] text-neutral-500'
                  )}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </a>
  )
}
