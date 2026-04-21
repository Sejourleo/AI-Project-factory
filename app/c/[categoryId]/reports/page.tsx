'use client'

import { use, useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { ReportList } from '@/components/report-list'
import { ReportViewer } from '@/components/report-viewer'
import { TopicsAggregateView } from '@/components/topics-aggregate-view'
import { getReportByDate, getReportList } from '@/lib/data/reports'
import type { DailyReport } from '@/lib/types'
import { cn } from '@/lib/utils'

type View = 'by-date' | 'by-topic'

export default function ReportsPage({
  params,
}: {
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = use(params)
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const view = (search.get('view') as View) ?? 'by-date'
  const selectedDate = search.get('date')

  const [list, setList] = useState<Array<{ id: string; date: string; summary: string }>>([])
  const [report, setReport] = useState<DailyReport | null>(null)

  useEffect(() => {
    getReportList(categoryId).then((items) => {
      setList(items)
      if (!selectedDate && items[0]) {
        const qs = new URLSearchParams(search.toString())
        qs.set('date', items[0].date)
        router.replace(`${pathname}?${qs.toString()}`)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId])

  const currentDate = selectedDate ?? list[0]?.date ?? ''

  useEffect(() => {
    if (!currentDate) {
      setReport(null)
      return
    }
    getReportByDate(categoryId, currentDate).then(setReport)
  }, [categoryId, currentDate])

  function updateParam(key: string, value: string | null) {
    const qs = new URLSearchParams(search.toString())
    if (value === null) qs.delete(key)
    else qs.set(key, value)
    router.replace(`${pathname}${qs.toString() ? `?${qs}` : ''}`)
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex gap-0.5 bg-neutral-200/50 p-0.5 rounded-lg">
          <ViewTab active={view === 'by-date'} onClick={() => updateParam('view', 'by-date')}>
            按日期
          </ViewTab>
          <ViewTab active={view === 'by-topic'} onClick={() => updateParam('view', 'by-topic')}>
            按选题
          </ViewTab>
        </div>
      </div>

      {view === 'by-date' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-6">
          <aside className="bg-white rounded-2xl p-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
            <ReportList
              items={list}
              selectedDate={currentDate}
              onSelect={(d) => updateParam('date', d)}
            />
          </aside>
          <section className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] min-w-0">
            <ReportViewer report={report} />
          </section>
        </div>
      ) : (
        <TopicsAggregateView
          categoryId={categoryId}
          onJumpToReport={(d) => {
            const qs = new URLSearchParams()
            qs.set('view', 'by-date')
            qs.set('date', d)
            router.replace(`${pathname}?${qs.toString()}`)
          }}
        />
      )}
    </div>
  )
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
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
