'use client'

import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { Loader2 } from 'lucide-react'
import { listInsightSnapshots, type SnapshotListItem } from '@/lib/data/reports'
import { cn } from '@/lib/utils'

export function TopicsAggregateView({
  categoryId,
  activeId,
  onPick,
}: {
  categoryId: string
  activeId?: number
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
      <div className="bg-white rounded-xl border border-neutral-100 p-8 text-center text-sm text-neutral-400">
        暂无历史快照,先点「重新生成」
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((it) => (
        <SnapshotRow
          key={it.id}
          item={it}
          active={it.id === activeId}
          onPick={onPick}
        />
      ))}
      {!done && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="self-center mt-2 px-4 py-2 text-xs text-neutral-500 hover:text-neutral-900 disabled:opacity-50"
        >
          {loading ? <Loader2 size={13} className="animate-spin inline" /> : '加载更多'}
        </button>
      )}
    </div>
  )
}

function SnapshotRow({
  item, active, onPick,
}: {
  item: SnapshotListItem
  active: boolean
  onPick: (id: number) => void
}) {
  const failed = item.status === 'error'
  const date = dayjs(item.generatedAt)

  return (
    <button
      onClick={() => !failed && onPick(item.id)}
      disabled={failed}
      className={cn(
        'w-full text-left rounded-xl border px-4 py-3 flex flex-col gap-2 transition-colors',
        active
          ? 'bg-rose-50/60 border-rose-200'
          : 'bg-white border-neutral-100',
        !failed && !active && 'hover:bg-neutral-50 cursor-pointer',
        failed && 'cursor-default opacity-70'
      )}
    >
      <span className={cn(
        'text-sm font-medium tabular-nums',
        active ? 'text-rose-700' : 'text-neutral-900'
      )}>
        {date.format('YYYY-MM-DD')}
      </span>

      {failed ? (
        <div className="text-[11px] text-red-600 truncate" title={item.errorMessage}>
          ✗ {item.errorMessage ?? '失败'}
        </div>
      ) : (
        <div className="text-[11px] text-neutral-500">
          {item.insightsCount} 条 · 基于 {item.sourceCount} 篇
        </div>
      )}
    </button>
  )
}
