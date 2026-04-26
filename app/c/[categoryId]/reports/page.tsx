'use client'

import { use, useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { ReportViewer } from '@/components/report-viewer'
import { TopicsAggregateView } from '@/components/topics-aggregate-view'
import { getLatestInsight, getInsightSnapshot } from '@/lib/data/reports'
import type { InsightSnapshot } from '@/lib/types'
import { cn } from '@/lib/utils'

type View = 'latest' | 'history'

export default function ReportsPage({
  params,
}: {
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = use(params)
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const view = (search.get('view') as View) ?? 'latest'
  const snapshotIdParam = search.get('snapshot')

  const [snapshot, setSnapshot] = useState<InsightSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const loader = snapshotIdParam
      ? getInsightSnapshot(Number(snapshotIdParam))
      : getLatestInsight(categoryId)
    loader.then((s) => { if (alive) { setSnapshot(s); setLoading(false) } })
    return () => { alive = false }
  }, [categoryId, snapshotIdParam, refreshKey])

  function setView(v: View) {
    const qs = new URLSearchParams(search.toString())
    qs.set('view', v)
    qs.delete('snapshot')
    router.replace(`${pathname}?${qs}`)
  }

  function jumpToSnapshot(id: number) {
    const qs = new URLSearchParams()
    qs.set('view', 'latest')
    qs.set('snapshot', String(id))
    router.replace(`${pathname}?${qs}`)
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex gap-0.5 bg-neutral-200/50 p-0.5 rounded-lg">
          <ViewTab active={view === 'latest'} onClick={() => setView('latest')}>
            最新洞察
          </ViewTab>
          <ViewTab active={view === 'history'} onClick={() => setView('history')}>
            历史快照
          </ViewTab>
        </div>
      </div>

      {view === 'latest' ? (
        <ReportViewer
          categoryId={categoryId}
          snapshot={snapshot}
          loading={loading}
          onRegenerated={() => setRefreshKey((k) => k + 1)}
        />
      ) : (
        <TopicsAggregateView
          categoryId={categoryId}
          onPick={jumpToSnapshot}
        />
      )}
    </div>
  )
}

function ViewTab({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-1.5 text-sm rounded-md transition-colors',
        active
          ? 'bg-white text-neutral-900 shadow-sm font-medium'
          : 'text-neutral-500 hover:text-neutral-700'
      )}
    >
      {children}
    </button>
  )
}
