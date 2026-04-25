'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Loader2 } from 'lucide-react'
import dayjs from 'dayjs'
import { PLATFORMS } from '@/lib/types'
import type { QueryDetail } from '@/lib/db/queries'
import { cn } from '@/lib/utils'

type Mode = 'snapshot' | 'compare'

export function HistoryDetail({
  categoryId,
  queryId,
}: {
  categoryId: string
  queryId: number
}) {
  const [data, setData] = useState<QueryDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('snapshot')

  useEffect(() => {
    fetch(`/api/queries/${queryId}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return (await r.json()) as QueryDetail
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [queryId])

  if (error) return <div className="p-8 text-sm text-red-600">加载失败：{error}</div>
  if (!data) return <div className="p-8"><Loader2 className="animate-spin" /></div>

  const { query, notes } = data
  const platform = PLATFORMS.find((p) => p.id === query.platform)
  const durationMs = query.finishedAt
    ? dayjs(query.finishedAt).diff(dayjs(query.startedAt))
    : 0

  return (
    <div className="p-8 max-w-5xl flex flex-col gap-6">
      <Link
        href={`/c/${categoryId}/history`}
        className="self-start inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
      >
        <ChevronLeft size={14} /> 返回历史
      </Link>

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-3">
          <span>{query.keyword}</span>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-white text-xs"
            style={{ backgroundColor: platform?.color ?? '#666' }}
          >
            <span>{platform?.icon}</span>{platform?.name}
          </span>
          <span className="text-neutral-400 text-sm font-normal">
            {dayjs(query.startedAt).format('YYYY-MM-DD HH:mm:ss')}
          </span>
        </h2>
        <p className="text-sm text-neutral-500">
          抓到 {query.returnedCount} 条 · 用时 {(durationMs / 1000).toFixed(1)}s
        </p>
      </div>

      <div className="flex gap-2">
        <ModeChip active={mode === 'snapshot'} onClick={() => setMode('snapshot')}>只看本次快照</ModeChip>
        <ModeChip active={mode === 'compare'} onClick={() => setMode('compare')}>对比最新</ModeChip>
      </div>

      {notes.length === 0 ? (
        <div className="text-sm text-neutral-400 py-12 text-center">本次查询没有命中笔记</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {notes.map((n) => <NoteCard key={n.id} note={n} mode={mode} />)}
        </div>
      )}
    </div>
  )
}

function ModeChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-xs rounded-full transition-colors',
        active ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
      )}
    >{children}</button>
  )
}

function NoteCard({
  note,
  mode,
}: {
  note: QueryDetail['notes'][number]
  mode: Mode
}) {
  const snap = note.snapshot
  return (
    <a
      href={note.url}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-white rounded-xl shadow-sm p-4 flex gap-3 hover:shadow-md transition-shadow"
    >
      {note.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={note.coverImage} alt="" className="w-24 h-24 object-cover rounded-lg shrink-0" />
      ) : (
        <div className="w-24 h-24 bg-neutral-100 rounded-lg shrink-0" />
      )}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="text-sm text-neutral-900 line-clamp-2">{note.title}</div>
        <div className="text-xs text-neutral-500 truncate">{note.author}</div>
        <div className="mt-auto text-xs text-neutral-600 flex flex-wrap gap-x-3">
          <Stat label="热度" snap={snap.hotScore} now={note.hotScore} mode={mode} />
          <Stat label="赞" snap={snap.likes} now={note.stats.likes ?? null} mode={mode} />
          {(snap.comments != null || note.stats.comments != null) && (
            <Stat label="评" snap={snap.comments} now={note.stats.comments ?? null} mode={mode} />
          )}
          <Stat label="阅" snap={snap.views} now={note.stats.views ?? null} mode={mode} />
        </div>
      </div>
    </a>
  )
}

function Stat({
  label, snap, now, mode,
}: { label: string; snap: number | null; now: number | null; mode: Mode }) {
  if (snap == null && now == null) return null
  if (mode === 'snapshot') return <span>{label} {snap ?? '-'}</span>
  if (snap == null || now == null || snap === now) return <span>{label} {now ?? snap ?? '-'}</span>
  return (
    <span>
      {label} <span className="text-neutral-400">{snap}→</span>
      <span className={now > snap ? 'text-emerald-600' : 'text-neutral-700'}>{now}</span>
    </span>
  )
}
