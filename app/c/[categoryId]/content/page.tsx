'use client'

import { use, useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { DateStrip } from '@/components/date-strip'
import { getDateBuckets } from '@/lib/data/contents'
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

  const [buckets, setBuckets] = useState<Array<{ date: string; count: number }>>([])

  useEffect(() => {
    getDateBuckets(categoryId, 14).then(setBuckets)
  }, [categoryId])

  function setDate(date: string) {
    const qs = new URLSearchParams(search.toString())
    qs.set('date', date)
    router.replace(`${pathname}?${qs.toString()}`)
  }

  return (
    <div className="flex flex-col">
      <DateStrip buckets={buckets} value={selectedDate} onChange={setDate} />
      <div className="px-8 py-10 text-sm text-neutral-400">
        已选日期：{selectedDate}（内容网格将在 Task 12 实现）
      </div>
    </div>
  )
}
