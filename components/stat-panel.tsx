'use client'

import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { PLATFORMS, type ContentItem } from '@/lib/types'
import {
  getCategoryStats,
  getRecentContents,
  type CategoryStats,
} from '@/lib/data/contents'
import { getHotTags } from '@/lib/data/reports'

export function StatPanel({ categoryId }: { categoryId: string }) {
  const [stats, setStats] = useState<CategoryStats | null>(null)
  const [tags, setTags] = useState<Array<{ tag: string; count: number }>>([])
  const [recent, setRecent] = useState<ContentItem[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getCategoryStats(categoryId),
      getHotTags(categoryId, 7, 6),
      getRecentContents(categoryId, 5),
    ]).then(([s, t, r]) => {
      if (cancelled) return
      setStats(s)
      setTags(t)
      setRecent(r)
    })
    return () => { cancelled = true }
  }, [categoryId])

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
        <h3 className="text-sm font-medium text-neutral-500 mb-4">概览</h3>
        <div className="grid grid-cols-2 gap-5">
          <Metric
            label="内容总数"
            value={stats ? stats.totalCount.toLocaleString() : '—'}
            sub={stats ? `本周新增 ${stats.weekCount}` : ''}
          />
          <Metric
            label="覆盖平台"
            value={stats ? `${stats.platformsCovered} / ${PLATFORMS.length}` : '—'}
            sub={stats?.topPlatform ? `主力 · ${stats.topPlatform.name}` : ''}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-medium text-neutral-500">热门话题</h3>
          <span className="text-[11px] text-neutral-400">近 7 天</span>
        </div>
        {tags.length === 0 ? (
          <p className="text-sm text-neutral-400">暂无</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t.tag}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-700 text-xs"
              >
                <span>{t.tag}</span>
                <span className="text-neutral-400 text-[10px]">{t.count}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
        <h3 className="text-sm font-medium text-neutral-500 mb-4">最新动态</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-neutral-400">暂无</p>
        ) : (
          <ul className="space-y-3">
            {recent.map((c) => {
              const platform = PLATFORMS.find((p) => p.id === c.platform)
              return (
                <li key={c.id} className="flex items-start gap-3">
                  <span
                    className="shrink-0 size-1.5 rounded-full mt-2"
                    style={{ backgroundColor: platform?.color ?? '#999' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-neutral-800 truncate">{c.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-400">
                      <span>{platform?.name ?? c.platform}</span>
                      <span>·</span>
                      <span>{c.author}</span>
                      <span>·</span>
                      <span>{dayjs(c.collectedAt).format('M/D')}</span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-400 mb-1.5">{label}</div>
      <div className="text-2xl font-semibold tracking-tight text-neutral-900 leading-none">
        {value}
      </div>
      {sub && <div className="text-[11px] text-neutral-400 mt-1.5">{sub}</div>}
    </div>
  )
}
