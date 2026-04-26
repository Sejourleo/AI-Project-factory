'use client'

import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { ChevronRight, Loader2 } from 'lucide-react'
import { listInsightSnapshots, type SnapshotListItem } from '@/lib/data/reports'
import { cn } from '@/lib/utils'

export function TopicsAggregateView({
  categoryId,
  onPick,
}: {
  categoryId: string
  onPick: (id: number) => void
}) {
  const [items, setItems] = useState<SnapshotListItem[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true); setDone(false); setCursor(undefined); setItems([])
    listInsightSnapshots(categoryId, { limit: 20 }).then((r) => {
      if (!alive) return
      setItems(r.items)
      setCursor(r.nextCursor)
      if (!r.nextCursor) setDone(true)
      setLoading(false)
    })
    return () => { alive = false }
  }, [categoryId])

  async function loadMore() {
    if (!cursor || loading) return
    setLoading(true)
    const r = await listInsightSnapshots(categoryId, { limit: 20, cursor })
    setItems((prev) => [...prev, ...r.items])
    setCursor(r.nextCursor)
    if (!r.nextCursor) setDone(true)
    setLoading(false)
  }

  if (loading && items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-100 p-12 text-center text-sm text-neutral-400">
        <Loader2 className="animate-spin inline mr-2" size={14} />加载中…
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-100 p-12 text-center text-sm text-neutral-400">
        暂无历史快照,先点「最新洞察」→「重新生成」
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm divide-y divide-neutral-100">
      {items.map((it) => {
        const failed = it.status === 'error'
        return (
          <button
            key={it.id}
            onClick={() => !failed && onPick(it.id)}
            disabled={failed}
            className={cn(
              'w-full flex items-center gap-4 px-5 py-3.5 text-sm text-left',
              !failed && 'hover:bg-neutral-50 cursor-pointer',
              failed && 'cursor-default'
            )}
          >
            <span className="text-neutral-400 tabular-nums w-36">
              {dayjs(it.generatedAt).format('YYYY-MM-DD HH:mm')}
            </span>
            <span className="text-[11px] text-neutral-400 w-32 truncate">{it.model}</span>
            <span className="flex-1" />
            {failed ? (
              <span className="text-red-600 text-xs truncate max-w-[300px]">
                ✗ {it.errorMessage ?? '失败'}
              </span>
            ) : (
              <span className="text-neutral-700">
                {it.insightsCount} 条 · 基于 {it.sourceCount} 篇
              </span>
            )}
            {!failed && <ChevronRight size={14} className="text-neutral-400" />}
          </button>
        )
      })}
      {!done && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="w-full py-3 text-sm text-neutral-500 hover:text-neutral-900 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin inline" /> : '加载更多'}
        </button>
      )}
    </div>
  )
}
