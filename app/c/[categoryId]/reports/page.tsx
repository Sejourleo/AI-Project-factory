'use client'

import { use, useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { ReportViewer } from '@/components/report-viewer'
import { TopicsAggregateView } from '@/components/topics-aggregate-view'
import { getLatestInsight, getInsightSnapshot } from '@/lib/data/reports'
import { useCategories } from '@/components/categories-provider'
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

  const { getById } = useCategories()
  const category = getById(categoryId)
  const configuredKeywords = (category?.settings.keywords ?? []).map((k) => k.value)

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
      <div className="flex items-center gap-6 border-b border-neutral-100">
        <ViewTab active={view === 'latest'} onClick={() => setView('latest')}>
          最新洞察
        </ViewTab>
        <ViewTab active={view === 'history'} onClick={() => setView('history')}>
          历史快照
        </ViewTab>
      </div>

      {view === 'latest' ? (
        <ReportViewer
          categoryId={categoryId}
          snapshot={snapshot}
          loading={loading}
          onRegenerated={() => setRefreshKey((k) => k + 1)}
          configuredKeywords={configuredKeywords}
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
        'pb-3 -mb-px text-sm border-b-2 transition-colors',
        active
          ? 'border-neutral-900 text-neutral-900 font-medium'
          : 'border-transparent text-neutral-400 hover:text-neutral-700'
      )}
    >
      {children}
    </button>
  )
}
