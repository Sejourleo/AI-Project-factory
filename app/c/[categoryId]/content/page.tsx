'use client'

import { use } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { CalendarGrid } from '@/components/calendar-grid'
import { StatPanel } from '@/components/stat-panel'
import { yesterday } from '@/lib/utils/dates'

export default function ContentPage({
  params,
}: {
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = use(params)
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const selectedDate = search.get('date') ?? yesterday()

  function setDate(date: string) {
    const qs = new URLSearchParams(search.toString())
    qs.set('date', date)
    router.replace(`${pathname}?${qs.toString()}`)
  }

  return (
    <div className="p-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
      <div className="flex flex-col gap-6 min-w-0">
        <CalendarGrid
          categoryId={categoryId}
          value={selectedDate}
          onChange={setDate}
        />
        <div className="bg-white rounded-2xl p-10 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] text-sm text-neutral-400 text-center">
          内容网格将在 Task 12 实现（已选日期：{selectedDate}）
        </div>
      </div>
      <StatPanel categoryId={categoryId} />
    </div>
  )
}
