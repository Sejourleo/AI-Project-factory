'use client'

import { use, useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { CalendarGrid } from '@/components/calendar-grid'
import { StatPanel } from '@/components/stat-panel'
import { ContentGrid } from '@/components/content-grid'
import {
  getContentsByDate,
  getPlatformCounts,
} from '@/lib/data/contents'
import { yesterday } from '@/lib/utils/dates'
import type { ContentItem, Platform } from '@/lib/types'

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
  const platformsParam = search.get('platforms')
  const selectedPlatforms: Platform[] = platformsParam
    ? (platformsParam.split(',').filter(Boolean) as Platform[])
    : []

  const [platformCounts, setPlatformCounts] = useState<Record<Platform, number>>({
    douyin: 0, xiaohongshu: 0, weibo: 0, bilibili: 0,
  })
  const [items, setItems] = useState<ContentItem[]>([])

  useEffect(() => {
    getPlatformCounts(categoryId, selectedDate).then(setPlatformCounts)
  }, [categoryId, selectedDate])

  useEffect(() => {
    getContentsByDate(categoryId, selectedDate, selectedPlatforms).then(setItems)
  }, [categoryId, selectedDate, platformsParam])

  function updateParam(key: string, value: string | null) {
    const qs = new URLSearchParams(search.toString())
    if (value === null || value === '') qs.delete(key)
    else qs.set(key, value)
    router.replace(`${pathname}${qs.toString() ? `?${qs}` : ''}`)
  }

  return (
    <div className="p-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
      <div className="flex flex-col gap-6 min-w-0">
        <CalendarGrid
          categoryId={categoryId}
          value={selectedDate}
          onChange={(d) => updateParam('date', d)}
        />
        <ContentGrid
          items={items}
          platformCounts={platformCounts}
          selectedPlatforms={selectedPlatforms}
          onPlatformChange={(ps) =>
            updateParam('platforms', ps.length === 0 ? null : ps.join(','))
          }
        />
      </div>
      <StatPanel categoryId={categoryId} />
    </div>
  )
}
