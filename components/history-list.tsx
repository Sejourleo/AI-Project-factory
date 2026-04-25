'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Loader2 } from 'lucide-react'
import dayjs from 'dayjs'
import { PLATFORMS, type Platform } from '@/lib/types'
import type { QuerySummary, QueryStatus } from '@/lib/db/queries'
import { cn } from '@/lib/utils'

type ListResult = { items: QuerySummary[]; nextCursor?: string }

export function HistoryList({ categoryId }: { categoryId: string }) {
  const [keyword, setKeyword] = useState('')
  const [platform, setPlatform] = useState<Platform | ''>('')
  const [status, setStatus] = useState<QueryStatus | ''>('')
  const [items, setItems] = useState<QuerySummary[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  function buildUrl(c?: string) {
    const qs = new URLSearchParams({ categoryId, limit: '30' })
    if (keyword.trim()) qs.set('keyword', keyword.trim())
    if (platform) qs.set('platform', platform)
    if (status) qs.set('status', status)
    if (c) qs.set('cursor', c)
    return `/api/queries?${qs}`
  }

  useEffect(() => {
    let alive = true
    setLoading(true); setDone(false); setCursor(undefined); setItems([])
    fetch(buildUrl(), { cache: 'no-store' })
      .then((r) => r.json() as Promise<ListResult>)
      .then((data) => {
        if (!alive) return
        setItems(data.items)
        setCursor(data.nextCursor)
        if (!data.nextCursor) setDone(true)
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [categoryId, keyword, platform, status])

  async function loadMore() {
    if (!cursor || loading) return
    setLoading(true)
    try {
      const res = await fetch(buildUrl(cursor), { cache: 'no-store' })
      const data = (await res.json()) as ListResult
      setItems((prev) => [...prev, ...data.items])
      setCursor(data.nextCursor)
      if (!data.nextCursor) setDone(true)
    } finally { setLoading(false) }
  }

  return (
    <div className="p-8 flex flex-col gap-4 max-w-4xl">
      <div className="flex gap-3 items-center">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="按关键词过滤"
          className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg w-56"
        />
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform | '')}
          className="px-2 py-1.5 text-sm border border-neutral-200 rounded-lg"
        >
          <option value="">全部平台</option>
          {PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as QueryStatus | '')}
          className="px-2 py-1.5 text-sm border border-neutral-200 rounded-lg"
        >
          <option value="">全部状态</option>
          <option value="success">成功</option>
          <option value="error">失败</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm divide-y divide-neutral-100">
        {items.length === 0 && !loading ? (
          <div className="p-12 text-center text-sm text-neutral-400">
            暂无查询记录,先去「内容」Tab 点一次「更新数据」吧
          </div>
        ) : (
          items.map((q) => <Row key={q.id} q={q} categoryId={categoryId} />)
        )}
      </div>

      {!done && items.length > 0 && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="self-center px-4 py-2 text-sm text-neutral-500 hover:text-neutral-900 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin inline" /> : '加载更多'}
        </button>
      )}
    </div>
  )
}

function Row({ q, categoryId }: { q: QuerySummary; categoryId: string }) {
  const platform = PLATFORMS.find((p) => p.id === q.platform)
  const failed = q.status === 'error'
  const inner = (
    <div className={cn(
      'flex items-center gap-4 px-5 py-3.5 text-sm',
      !failed && 'hover:bg-neutral-50 cursor-pointer'
    )}>
      <span className="text-neutral-400 tabular-nums w-28">
        {dayjs(q.startedAt).format('MM-DD HH:mm')}
      </span>
      <span className="text-neutral-900 w-44 truncate">{q.keyword}</span>
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-white text-xs"
        style={{ backgroundColor: platform?.color ?? '#666' }}
      >
        <span>{platform?.icon}</span>
        <span>{platform?.name ?? q.platform}</span>
      </span>
      <span className="flex-1" />
      {failed ? (
        <span className="text-red-600 text-xs truncate max-w-[280px]">
          ✗ {q.errorMessage ?? '失败'}
        </span>
      ) : (
        <span className="text-neutral-700">✓ {q.returnedCount} 条</span>
      )}
      {!failed && <ChevronRight size={14} className="text-neutral-400" />}
    </div>
  )
  if (failed) return inner
  return <Link href={`/c/${categoryId}/history/${q.id}`}>{inner}</Link>
}
