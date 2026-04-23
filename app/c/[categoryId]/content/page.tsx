'use client'

import { use, useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { DateTimeline } from '@/components/date-timeline'
import { PlatformFilter } from '@/components/platform-filter'
import { StatPanel } from '@/components/stat-panel'
import { ContentGrid } from '@/components/content-grid'
import { useCategories } from '@/components/categories-provider'
import { getContentsByDate } from '@/lib/data/contents'
import { yesterday } from '@/lib/utils/dates'
import type { ContentItem, Platform } from '@/lib/types'

export default function ContentPage({
  params,
}: {
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = use(params)
  const { getById } = useCategories()
  const wechatKeywords = getById(categoryId)?.settings.keywords
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const selectedDate = search.get('date') ?? yesterday()
  const platformParam = search.get('platform')
  const selectedPlatform: Platform | null =
    (platformParam as Platform | null) ?? null

  const [items, setItems] = useState<ContentItem[]>([])

  useEffect(() => {
    const ps = selectedPlatform ? [selectedPlatform] : undefined
    getContentsByDate(categoryId, selectedDate, ps, wechatKeywords).then(setItems)
  }, [categoryId, selectedDate, selectedPlatform, wechatKeywords])

  function updateParam(key: string, value: string | null) {
    const qs = new URLSearchParams(search.toString())
    if (value === null || value === '') qs.delete(key)
    else qs.set(key, value)
    router.replace(`${pathname}${qs.toString() ? `?${qs}` : ''}`)
  }

  return (
    <div className="p-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
      <div className="flex flex-col gap-6 min-w-0">
        <PlatformFilter
          selected={selectedPlatform}
          onChange={(p) => updateParam('platform', p)}
        />
        <DateTimeline
          categoryId={categoryId}
          value={selectedDate}
          platformFilter={selectedPlatform}
          wechatKeywords={wechatKeywords}
          onChange={(d) => updateParam('date', d)}
        />
        <ContentGrid items={items} date={selectedDate} />
      </div>
      <StatPanel categoryId={categoryId} />
    </div>
  )
}
