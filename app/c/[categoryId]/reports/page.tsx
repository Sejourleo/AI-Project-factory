'use client'

import { use, useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { ReportViewer } from '@/components/report-viewer'
import { TopicsAggregateView } from '@/components/topics-aggregate-view'
import { getLatestInsight, getInsightSnapshot } from '@/lib/data/reports'
import { useCategories } from '@/components/categories-provider'
import type { InsightSnapshot } from '@/lib/types'

export default function ReportsPage({
  params,
}: {
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = use(params)
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
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

  function pickSnapshot(id: number) {
    const qs = new URLSearchParams(search.toString())
    qs.set('snapshot', String(id))
    router.replace(`${pathname}?${qs}`)
  }

  return (
    <div className="p-8 flex gap-6">
      <aside className="w-52 shrink-0 flex flex-col gap-3">
        <h2 className="text-xs tracking-wider text-neutral-400 px-1">报告列表</h2>
        <TopicsAggregateView
          categoryId={categoryId}
          activeId={snapshot?.id}
          onPick={pickSnapshot}
        />
      </aside>

      <main className="flex-1 min-w-0">
        <ReportViewer
          categoryId={categoryId}
          snapshot={snapshot}
          loading={loading}
          onRegenerated={() => setRefreshKey((k) => k + 1)}
          configuredKeywords={configuredKeywords}
        />
      </main>
    </div>
  )
}
